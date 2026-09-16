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

/** Renders a stage-neon "Happy Birthday" image for a student, returns mediaObjectId. */
async function renderBirthdayImage(
  student: { name: string; dateOfBirth: Date; batch?: string | null; course?: string | null },
  design: Record<string, unknown>,
): Promise<string> {
  const width = Number(design.width ?? 1920);
  const height = Number(design.height ?? 1080);
  const accent = String(design.accent ?? '#d946ef'); // magenta/purple neon
  const dob = student.dateOfBirth;
  const dateLine = `${dob.getUTCDate()}${ordinal(dob.getUTCDate())} ${MONTHS[dob.getUTCMonth()]}`;
  const nameLine = student.name.toUpperCase();
  const subLine = student.batch ? `(${student.batch})` : student.course ? `(${student.course})` : '';
  const rng = makeRng(dob.getUTCDate() * 131 + dob.getUTCMonth() * 977 + student.name.length * 17);

  // ── Concert-style spotlights from the top ──
  const beamColors = ['#d946ef', '#0ea5e9', '#facc15', '#facc15', '#0ea5e9', '#d946ef'];
  const beams = beamColors
    .map((c, i) => {
      const positions = [0.03, 0.14, 0.36, 0.59, 0.78, 0.97];
      const x = width * positions[i] + (rng() - 0.5) * 48;
      const spread = width * 0.16;
      return `<polygon points="${x - 14},0 ${x + 14},0 ${x + spread},${height * 0.92} ${x - spread},${height * 0.92}" fill="url(#beam${i})" opacity="0.42" filter="url(#soft)"/>
        <defs><linearGradient id="beam${i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${c}" stop-opacity="0.85"/><stop offset="1" stop-color="${c}" stop-opacity="0"/>
        </linearGradient></defs>`;
    })
    .join('');

  // ── Bokeh circles ──
  const bokehColors = ['#a855f7', '#ec4899', '#3b82f6', '#22d3ee', '#f5d0fe', '#facc15'];
  let bokeh = '';
  for (let i = 0; i < 52; i++) {
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

  // ── Neon side ribbons and star ornaments around the title ──
  const ribbonPaths = [
    `M ${width * 0.023} ${height * 0.542} C ${width * 0.083} ${height * 0.468}, ${width * 0.206} ${height * 0.463}, ${width * 0.375} ${height * 0.426}`,
    `M ${width * 0.977} ${height * 0.542} C ${width * 0.917} ${height * 0.468}, ${width * 0.794} ${height * 0.463}, ${width * 0.625} ${height * 0.426}`,
  ];
  const ribbons = ribbonPaths
    .map(
      (d) => `
        <path d="${d}" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" filter="url(#neon)" opacity="0.95"/>
        <path d="${d}" fill="none" stroke="#fce7ff" stroke-width="3.5" stroke-linecap="round" opacity="0.92"/>`,
    )
    .join('');

  const fourStar = (x: number, y: number, size: number, rotate = 0) => `
    <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${size / 56})" filter="url(#starGlow)">
      <path d="M0 -26 C5 -10 10 -5 26 0 C10 5 5 10 0 26 C-5 10 -10 5 -26 0 C-10 -5 -5 -10 0 -26Z" fill="none" stroke="#fff" stroke-width="5"/>
      <path d="M0 -18 C3 -7 7 -3 18 0 C7 3 3 7 0 18 C-3 7 -7 3 -18 0 C-7 -3 -3 -7 0 -18Z" fill="#fff" opacity="0.92"/>
    </g>`;
  const ornaments = [
    fourStar(width * 0.078, height * 0.139, 56),
    fourStar(width * 0.136, height * 0.208, 70, 18),
    fourStar(width * 0.095, height * 0.237, 82, 45),
    fourStar(width * 0.915, height * 0.204, 70, -18),
    fourStar(width * 0.942, height * 0.139, 56),
    fourStar(width * 0.936, height * 0.237, 82, -45),
  ].join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="42%" r="70%">
          <stop offset="0" stop-color="#321046"/><stop offset="48%" stop-color="#120519"/><stop offset="100%" stop-color="#020105"/>
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
        <filter id="whiteGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b"/>
          <feFlood flood-color="#d946ef" flood-opacity="0.42" result="c"/>
          <feComposite in="c" in2="b" operator="in" result="colored"/>
          <feMerge><feMergeNode in="colored"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="starGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="url(#bg)"/>
      ${beams}
      ${bokeh}
      ${ornaments}
      ${ribbons}
      ${confetti}
      <rect width="100%" height="100%" fill="none" stroke="rgba(0,0,0,0)" />

      <text x="50%" y="${height * 0.13}" text-anchor="middle" font-family="${SANS}" letter-spacing="16"
        font-size="${Math.round(height * 0.052)}" fill="#22d3ee" font-weight="900" filter="url(#glow)">${escapeXml(dateLine)}</text>

      <text x="50%" y="${height * 0.495}" text-anchor="middle" font-family="${SANS}" letter-spacing="6"
        font-size="${Math.round(height * 0.32)}" fill="#ffffff" font-weight="900" filter="url(#whiteGlow)">HAPPY</text>

      <text x="50%" y="${height * 0.72}" text-anchor="middle" font-family="${SCRIPT}"
        font-size="${Math.round(height * 0.19)}" fill="#ffffff" filter="url(#neon)">Birthday</text>

      <text x="50%" y="${height * 0.865}" text-anchor="middle" font-family="${SANS}" letter-spacing="4"
        font-size="${Math.round(height * 0.06)}" fill="#ffffff" font-weight="900" filter="url(#whiteGlow)">${escapeXml(nameLine)}</text>
      ${subLine ? `<text x="50%" y="${height * 0.94}" text-anchor="middle" font-family="${SANS}" letter-spacing="3"
        font-size="${Math.round(height * 0.045)}" fill="#ffffff" font-weight="900" filter="url(#glow)">${escapeXml(subLine)}</text>` : ''}
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

const NEON_DESIGN = { width: 1920, height: 1080, accent: '#d946ef', style: 'stage-neon-v2' };

async function defaultTemplate() {
  let tpl = await prisma.birthdayTemplate.findFirst({ where: { isDefault: true } });
  if (!tpl) tpl = await prisma.birthdayTemplate.findFirst();
  if (!tpl) {
    tpl = await prisma.birthdayTemplate.create({
      data: { name: 'Default', isDefault: true, defaultDurationSec: 10, design: NEON_DESIGN },
    });
  } else if ((tpl.design as Record<string, unknown> | null)?.style !== NEON_DESIGN.style) {
    // Upgrade an older plain template to the neon stage palette WITHOUT losing custom fields
    // like an uploaded backgroundMediaObjectId.
    const merged = { ...((tpl.design ?? {}) as Record<string, unknown>), ...NEON_DESIGN };
    tpl = await prisma.birthdayTemplate.update({ where: { id: tpl.id }, data: { design: merged } });
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
    const dob = student.dateOfBirth;
    const dateText = `${dob.getUTCDate()}${ordinal(dob.getUTCDate())} ${MONTHS[dob.getUTCMonth()]}`;

    // The player renders the permanent animated design from these overlay details.
    // The generated poster is kept as the media (admin thumbnail + offline fallback).
    const mediaObjectId = await renderBirthdayImage(student, design);
    const overlay = { name: student.name.toUpperCase(), dateText, batch: student.batch ?? undefined };

    const instance = await prisma.birthdayInstance.create({
      data: { studentId: student.id, templateId: tpl.id, forDate },
    });
    await prisma.content.create({
      data: {
        title: `Birthday — ${student.name}`,
        type: CONTENT_TYPE.BIRTHDAY,
        status: CONTENT_STATUS.DRAFT,
        defaultDurationSec: tpl.defaultDurationSec,
        ownerId: await systemOwnerId(),
        mediaObjectId,
        overlay: overlay as never,
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
