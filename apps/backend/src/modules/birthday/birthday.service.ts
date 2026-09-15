import sharp from 'sharp';
import { nanoid } from 'nanoid';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../storage/index.js';
import { CONTENT_TYPE, CONTENT_STATUS, MEDIA_KIND, WS } from '@dsm/shared';
import { wsHub } from '../../ws/hub.js';
import { logger } from '../../lib/logger.js';

function todayUtcDate(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

/** Renders a birthday image from a template design + student, returns mediaObjectId. */
async function renderBirthdayImage(
  student: { name: string },
  design: Record<string, unknown>,
): Promise<string> {
  const width = Number(design.width ?? 1920);
  const height = Number(design.height ?? 1080);
  const bg = String(design.background ?? '#0f172a');
  const accent = String(design.accent ?? '#f59e0b');
  const message = String(design.message ?? 'Happy Birthday!');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text x="50%" y="38%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="${Math.round(height * 0.09)}" fill="${accent}" font-weight="bold">
        ${escapeXml(message)}
      </text>
      <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="${Math.round(height * 0.13)}" fill="#ffffff" font-weight="bold">
        ${escapeXml(student.name)}
      </text>
      <text x="50%" y="70%" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="${Math.round(height * 0.04)}" fill="#cbd5e1">
        Wishing you a wonderful day! 🎉
      </text>
    </svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const key = `media/birthday/${new Date().getFullYear()}/${nanoid()}.png`;
  await storage().put({ key, body: png, contentType: 'image/png' });
  const media = await prisma.mediaObject.create({
    data: {
      provider: storage().name,
      storageKey: key,
      mimeType: 'image/png',
      kind: MEDIA_KIND.IMAGE,
      sizeBytes: png.length,
      width,
      height,
      checksum: crypto.createHash('sha256').update(png).digest('hex'),
    },
  });
  return media.id;
}

async function defaultTemplate() {
  let tpl = await prisma.birthdayTemplate.findFirst({ where: { isDefault: true } });
  if (!tpl) tpl = await prisma.birthdayTemplate.findFirst();
  if (!tpl) {
    tpl = await prisma.birthdayTemplate.create({
      data: {
        name: 'Default',
        isDefault: true,
        defaultDurationSec: 10,
        design: { width: 1920, height: 1080, background: '#0f172a', accent: '#f59e0b', message: 'Happy Birthday!' },
      },
    });
  }
  return tpl;
}

/**
 * Automatic generation: for each active student whose birthday is `forDate`,
 * ensure a BirthdayInstance + generated BIRTHDAY content exists (idempotent).
 * Returns the generated instances (with content).
 */
export async function generateForDate(forDate = todayUtcDate()) {
  const month = forDate.getUTCMonth() + 1;
  const day = forDate.getUTCDate();
  const students = await prisma.student.findMany({
    where: { active: true, birthMonth: month, birthDay: day },
  });
  const tpl = await defaultTemplate();
  const design = tpl.design as Record<string, unknown>;

  const results = [];
  for (const student of students) {
    const existing = await prisma.birthdayInstance.findFirst({
      where: { studentId: student.id, forDate, screenId: null, screenGroupId: null },
      include: { content: true },
    });
    if (existing?.content) {
      results.push(existing);
      continue;
    }
    const mediaObjectId = await renderBirthdayImage(student, design);
    const instance = await prisma.birthdayInstance.create({
      data: { studentId: student.id, templateId: tpl.id, forDate },
    });
    await prisma.content.create({
      data: {
        title: `Birthday — ${student.name}`,
        type: CONTENT_TYPE.BIRTHDAY,
        status: CONTENT_STATUS.DRAFT,
        defaultDurationSec: tpl.defaultDurationSec,
        ownerId: (await systemOwnerId()),
        mediaObjectId,
        birthdayInstanceId: instance.id,
      },
    });
    results.push(instance);
  }
  logger.info({ count: results.length, forDate }, 'Birthday generation complete');
  return results;
}

// Birthday content is system-owned; use the first admin as nominal owner.
async function systemOwnerId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } });
  if (!admin) throw new Error('No admin user exists to own birthday content');
  return admin.id;
}

/**
 * Assign today's birthday content to screens / groups.
 *
 * The currently-running content is kept as-is; every birthday student's post
 * (10s each) is appended to each target screen's LIVE playlist so it cycles
 * alongside the existing content. Idempotent: re-running refreshes the birthday
 * items rather than duplicating them, and it auto-generates today's posts first.
 */
export async function assignToday(screenIds: string[], screenGroupIds: string[], forDate = todayUtcDate()) {
  // Make sure today's birthday posts exist (in case students were just added).
  await generateForDate(forDate);

  const groupScreens = await prisma.screen.findMany({
    where: { screenGroupId: { in: screenGroupIds } },
    select: { id: true },
  });
  const targetScreenIds = [...new Set([...screenIds, ...groupScreens.map((s) => s.id)])];

  const birthdayContents = await prisma.content.findMany({
    where: { type: CONTENT_TYPE.BIRTHDAY, birthdayInstance: { forDate } },
    include: { birthdayInstance: { include: { student: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const birthdayIds = birthdayContents.map((c) => c.id);

  for (const screenId of targetScreenIds) {
    const playlist = await prisma.playlist.upsert({
      where: { screenId },
      create: { screenId },
      update: {},
    });
    await prisma.$transaction(async (tx) => {
      // Remove any previously-assigned birthday items, keep everything else,
      // then re-pack positions and append today's birthday posts at the end.
      const live = await tx.playlistItem.findMany({
        where: { playlistId: playlist.id, stage: 'LIVE' },
        include: { content: { select: { type: true } } },
        orderBy: { position: 'asc' },
      });
      const kept = live.filter((l) => l.content.type !== CONTENT_TYPE.BIRTHDAY);

      await tx.playlistItem.deleteMany({ where: { playlistId: playlist.id, stage: 'LIVE' } });
      let pos = 0;
      for (const item of kept) {
        await tx.playlistItem.create({
          data: { playlistId: playlist.id, stage: 'LIVE', position: pos++, durationSec: item.durationSec, contentId: item.contentId },
        });
      }
      for (const c of birthdayContents) {
        await tx.playlistItem.create({
          data: { playlistId: playlist.id, stage: 'LIVE', position: pos++, durationSec: c.defaultDurationSec, contentId: c.id },
        });
      }
      if (birthdayIds.length > 0) {
        await tx.content.updateMany({ where: { id: { in: birthdayIds } }, data: { status: CONTENT_STATUS.LIVE } });
      }
      // Reset the draft so the handler's editor reflects the new live set.
      await tx.playlistItem.deleteMany({ where: { playlistId: playlist.id, stage: 'DRAFT' } });
      await tx.playlist.update({
        where: { id: playlist.id },
        data: { liveVersion: { increment: 1 }, livePublishedAt: new Date(), draftInitialized: false },
      });
    });
    wsHub.broadcastToScreen(screenId, { event: WS.PLAYLIST_UPDATED, data: { screenId } });
    wsHub.broadcastToDashboard({ event: WS.PLAYLIST_UPDATED, data: { screenId } });
  }
  return { assigned: birthdayContents.length, screens: targetScreenIds.length };
}

/** Removes birthday content that is no longer for today (daily cleanup). */
export async function cleanupBirthdayBefore(forDate = todayUtcDate()) {
  const stale = await prisma.content.findMany({
    where: { type: CONTENT_TYPE.BIRTHDAY, birthdayInstance: { forDate: { lt: forDate } } },
    select: { id: true, mediaObjectId: true },
  });
  for (const c of stale) {
    await prisma.playlistItem.deleteMany({ where: { contentId: c.id } });
    await prisma.content.delete({ where: { id: c.id } });
  }
  await prisma.birthdayInstance.deleteMany({ where: { forDate: { lt: forDate } } });
  return stale.length;
}
