import { prisma } from '../../lib/prisma.js';
import { NotFound, Forbidden, BadRequest } from '../../lib/errors.js';
import { ROLES, CONTENT_STATUS, DEFAULTS, type ContentType, type RoleName } from '@dsm/shared';
import { storeUploadedMedia } from '../media/media.service.js';
import { toContentDto, contentInclude } from './content.mapper.js';

interface Actor {
  userId: string;
  role: RoleName;
}

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/**
 * Upload => always DRAFT. Never auto-published.
 * Owner is the uploading handler (or admin).
 */
export async function uploadContent(
  actor: Actor,
  file: UploadedFile | undefined,
  meta: { title: string; type: ContentType; fitMode?: 'COVER' | 'CONTAIN'; defaultDurationSec?: number },
  hints?: { width?: number; height?: number; durationSec?: number },
) {
  if (!file) throw BadRequest('File is required');
  const mediaObjectId = await storeUploadedMedia(file, hints);
  // Timetables must stay fully readable, so default them to CONTAIN; everything
  // else defaults to COVER (full-bleed) unless the uploader chose otherwise.
  const fitMode = meta.fitMode ?? (meta.type === 'TIMETABLE' ? 'CONTAIN' : 'COVER');
  const content = await prisma.content.create({
    data: {
      title: meta.title,
      type: meta.type,
      status: CONTENT_STATUS.DRAFT,
      fitMode,
      defaultDurationSec: meta.defaultDurationSec ?? DEFAULTS.IMAGE_DURATION_SEC,
      ownerId: actor.userId,
      mediaObjectId,
    },
    include: contentInclude,
  });
  return toContentDto(content);
}

/** Handlers see their own library; admins see everything. Optional type filter. */
export async function listContent(actor: Actor, filter?: { type?: ContentType; status?: string }) {
  const where: Record<string, unknown> = {};
  if (actor.role !== ROLES.ADMIN) where.ownerId = actor.userId;
  if (filter?.type) where.type = filter.type;
  if (filter?.status) where.status = filter.status;
  const items = await prisma.content.findMany({
    where,
    include: contentInclude,
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(items.map(toContentDto));
}

async function assertOwnership(actor: Actor, contentId: string) {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) throw NotFound('Content not found');
  if (actor.role !== ROLES.ADMIN && content.ownerId !== actor.userId)
    throw Forbidden('You can only modify your own content');
  return content;
}

export async function updateContent(
  actor: Actor,
  contentId: string,
  data: { title?: string; fitMode?: 'COVER' | 'CONTAIN'; defaultDurationSec?: number },
) {
  await assertOwnership(actor, contentId);
  const updated = await prisma.content.update({
    where: { id: contentId },
    data,
    include: contentInclude,
  });
  return toContentDto(updated);
}

/** Screen ids currently showing this content in their LIVE playlist. */
export async function liveScreenIdsForContent(contentId: string): Promise<string[]> {
  const items = await prisma.playlistItem.findMany({
    where: { contentId, stage: 'LIVE' },
    select: { playlist: { select: { screenId: true } } },
  });
  return [...new Set(items.map((i) => i.playlist.screenId))];
}

/** Deletes a DRAFT library item. Live/archived items are managed via playlist/history. */
export async function deleteContent(actor: Actor, contentId: string) {
  const content = await assertOwnership(actor, contentId);
  const liveUsage = await prisma.playlistItem.count({
    where: { contentId, stage: 'LIVE' },
  });
  if (liveUsage > 0) throw BadRequest('Content is live in a playlist; remove it from the queue first');
  await prisma.content.delete({ where: { id: content.id } });
}
