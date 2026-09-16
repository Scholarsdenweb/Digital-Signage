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

const SANS = "'DejaVu Sans','Liberation Sans','Arial','Helvetica',sans-serif";
const SCRIPT = "'Pacifico','Segoe Script','Snell Roundhand','Brush Script MT',cursive";
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

// Simple seeded PRNG so decorations are stable per render.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Renders a neon "Happy Birthday" image for a student, returns mediaObjectId. */
async function renderBirthdayImage(
  student: { name: string; dateOfBirth: Date; batch?: string | null; course?: string | null },
  design: Record<string, unknown>,
): Promise<string> {
  const width = Number(design.width ?? 1920);
  const height = Number(design.height ?? 1080);
  const accent = String(design.accent ?? '#c026d3'); // magenta/purple neon
  const dob = student.dateOfBirth;
  const dateLine = `${dob.getUTCDate()}${ordinal(dob.getUTCDate())} ${MONTHS[dob.getUTCMonth()]}`;
  const nameLine = student.name.toUpperCase();
  const subLine = student.batch ? `(${student.batch})` : student.course ? `(${student.course})` : '';
  const rng = makeRng(dob.getUTCDate() * 131 + dob.getUTCMonth() * 977 + student.name.length * 17);

  // ── Spotlight beams from the top ──
  const beamColors = ['#a855f7', '#3b82f6', '#ec4899', '#f59e0b', '#22d3ee'];
  const beams = beamColors
    .map((c, i) => {
      const x = (width * (i + 0.5)) / beamColors.length + (rng() - 0.5) * 120;
      const spread = width * 0.16;
      return `<polygon points="${x - 14},0 ${x + 14},0 ${x + spread},${height * 0.92} ${x - spread},${height * 0.92}" fill="url(#beam${i})" opacity="0.32" filter="url(#soft)"/>
        <defs><linearGradient id="beam${i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${c}" stop-opacity="0.85"/><stop offset="1" stop-color="${c}" stop-opacity="0"/>
        </linearGradient></defs>`;
    })
    .join('');

  // ── Bokeh circles ──
  const bokehColors = ['#a855f7', '#ec4899', '#3b82f6', '#22d3ee', '#f5d0fe'];
  let bokeh = '';
  for (let i = 0; i < 44; i++) {
    const cx = rng() * width;
    const cy = height * 0.45 + rng() * height * 0.55;
    const r = 6 + rng() * 34;
    bokeh += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${bokehColors[Math.floor(rng() * bokehColors.length)]}" opacity="${(0.06 + rng() * 0.22).toFixed(2)}" filter="url(#soft)"/>`;
  }

  // ── Confetti ──
  const confettiColors = ['#f472b6', '#c084fc', '#60a5fa', '#22d3ee', '#fde047', '#f87171', '#ffffff'];
  let confetti = '';
  for (let i = 0; i < 140; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const w = 3 + rng() * 5;
    const h = 8 + rng() * 12;
    const rot = Math.floor(rng() * 360);
    confetti += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="1.5" fill="${confettiColors[Math.floor(rng() * confettiColors.length)]}" opacity="${(0.5 + rng() * 0.5).toFixed(2)}" transform="rotate(${rot} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }

  // ── Neon swoosh ribbon around the title ──
  const cy = height * 0.52;
  const swoosh = `
    <path d="M ${width * 0.04} ${cy} C ${width * 0.28} ${cy + height * 0.16}, ${width * 0.42} ${cy + height * 0.13}, ${width * 0.5} ${cy + height * 0.05}
             C ${width * 0.58} ${cy + height * 0.13}, ${width * 0.72} ${cy + height * 0.16}, ${width * 0.96} ${cy}"
          fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" filter="url(#neon)" opacity="0.95"/>`;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="42%" r="75%">
          <stop offset="0" stop-color="#2a0f4a"/><stop offset="55%" stop-color="#140a26"/><stop offset="100%" stop-color="#050109"/>
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
        <filter id="neon" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="url(#bg)"/>
      ${beams}
      ${bokeh}
      ${confetti}
      ${swoosh}

      <text x="50%" y="${height * 0.13}" text-anchor="middle" font-family="${SANS}" letter-spacing="10"
        font-size="${Math.round(height * 0.035)}" fill="#f5d0fe" font-weight="bold">${escapeXml(dateLine)}</text>

      <text x="50%" y="${height * 0.4}" text-anchor="middle" font-family="${SANS}" letter-spacing="6"
        font-size="${Math.round(height * 0.2)}" fill="#ffffff" font-weight="bold" filter="url(#glow)">HAPPY</text>

      <text x="50%" y="${height * 0.63}" text-anchor="middle" font-family="${SCRIPT}"
        font-size="${Math.round(height * 0.17)}" fill="${accent}" filter="url(#neon)">Birthday</text>

      <text x="50%" y="${height * 0.84}" text-anchor="middle" font-family="${SANS}" letter-spacing="4"
        font-size="${Math.round(height * 0.06)}" fill="#ffffff" font-weight="bold" filter="url(#glow)">${escapeXml(nameLine)}</text>
      ${subLine ? `<text x="50%" y="${height * 0.92}" text-anchor="middle" font-family="${SANS}" letter-spacing="3"
        font-size="${Math.round(height * 0.045)}" fill="#e9d5ff" font-weight="bold">${escapeXml(subLine)}</text>` : ''}
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

const NEON_DESIGN = { width: 1920, height: 1080, accent: '#c026d3', style: 'neon' };

async function defaultTemplate() {
  let tpl = await prisma.birthdayTemplate.findFirst({ where: { isDefault: true } });
  if (!tpl) tpl = await prisma.birthdayTemplate.findFirst();
  if (!tpl) {
    tpl = await prisma.birthdayTemplate.create({
      data: { name: 'Default', isDefault: true, defaultDurationSec: 10, design: NEON_DESIGN },
    });
  } else if ((tpl.design as Record<string, unknown> | null)?.style !== 'neon') {
    // Upgrade an older plain template to the neon design.
    tpl = await prisma.birthdayTemplate.update({ where: { id: tpl.id }, data: { design: NEON_DESIGN } });
  }
  return tpl;
}

/**
 * Automatic generation: for each active student whose birthday is `forDate`,
 * ensure a BirthdayInstance + generated BIRTHDAY content exists (idempotent).
 * Returns the generated instances (with content).
 */
export async function generateForDate(forDate = todayUtcDate(), force = false) {
  const month = forDate.getUTCMonth() + 1;
  const day = forDate.getUTCDate();

  // Force re-render (e.g. after a template change): drop today's generated content first.
  if (force) {
    const todays = await prisma.content.findMany({
      where: { type: CONTENT_TYPE.BIRTHDAY, birthdayInstance: { forDate } },
      select: { id: true },
    });
    for (const c of todays) {
      await prisma.playlistItem.deleteMany({ where: { contentId: c.id } });
      await prisma.content.delete({ where: { id: c.id } });
    }
    await prisma.birthdayInstance.deleteMany({ where: { forDate } });
  }

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
