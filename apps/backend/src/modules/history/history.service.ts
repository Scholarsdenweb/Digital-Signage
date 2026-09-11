import { prisma } from '../../lib/prisma.js';
import { NotFound, Forbidden, Gone } from '../../lib/errors.js';
import { ROLES, CONTENT_STATUS, type RoleName } from '@dsm/shared';
import { storage } from '../../storage/index.js';

interface Actor {
  userId: string;
  role: RoleName;
}

/** Admin sees all live history; handler sees only items they originally uploaded. */
export async function listHistory(actor: Actor, screenId?: string) {
  const where: Record<string, unknown> = { expiresAt: { gt: new Date() } };
  if (actor.role !== ROLES.ADMIN) where.ownerId = actor.userId;
  if (screenId) where.screenId = screenId;

  const items = await prisma.contentHistory.findMany({
    where,
    include: { media: true },
    orderBy: { archivedAt: 'desc' },
  });

  return Promise.all(
    items.map(async (h) => ({
      id: h.id,
      originalContentId: h.originalContentId,
      title: h.title,
      type: h.type,
      ownerId: h.ownerId,
      screenId: h.screenId,
      reason: h.reason,
      durationSec: h.durationSec,
      archivedAt: h.archivedAt.toISOString(),
      expiresAt: h.expiresAt.toISOString(),
      restoredAt: h.restoredAt?.toISOString() ?? null,
      canRestore: actor.role === ROLES.ADMIN || h.ownerId === actor.userId,
      media: {
        kind: h.media.kind,
        mimeType: h.media.mimeType,
        width: h.media.width,
        height: h.media.height,
        durationSec: h.media.durationSec,
        sizeBytes: h.media.sizeBytes,
        url: await storage().resolveUrl(h.media.storageKey, h.originalContentId),
      },
    })),
  );
}

/**
 * Restore to library ONLY. Returns the content to the owner's DRAFT library.
 * NEVER modifies any live playlist.
 */
export async function restoreToLibrary(actor: Actor, historyId: string) {
  const h = await prisma.contentHistory.findUnique({ where: { id: historyId } });
  if (!h) throw NotFound('History item not found');
  if (h.expiresAt < new Date()) throw Gone('History item has expired');
  // Handler may restore only their own uploads; admin may restore anything.
  if (actor.role !== ROLES.ADMIN && h.ownerId !== actor.userId)
    throw Forbidden('You can only restore content you originally uploaded');

  // The original content row still exists (ARCHIVED). Flip it back to DRAFT so it
  // reappears in the library. If it was hard-removed, recreate a draft content row.
  const existing = await prisma.content.findUnique({ where: { id: h.originalContentId } });
  let content;
  if (existing) {
    content = await prisma.content.update({
      where: { id: existing.id },
      data: { status: CONTENT_STATUS.DRAFT },
      include: { media: true, owner: { select: { name: true } } },
    });
  } else {
    content = await prisma.content.create({
      data: {
        title: h.title,
        type: h.type,
        status: CONTENT_STATUS.DRAFT,
        defaultDurationSec: h.durationSec,
        ownerId: h.ownerId,
        mediaObjectId: h.mediaObjectId,
      },
      include: { media: true, owner: { select: { name: true } } },
    });
  }

  await prisma.contentHistory.update({ where: { id: historyId }, data: { restoredAt: new Date() } });
  return content;
}
