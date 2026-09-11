import { prisma } from '../lib/prisma.js';
import { CONTENT_STATUS } from '@dsm/shared';
import { deleteMediaIfUnreferenced } from '../modules/media/media.service.js';
import { logger } from '../lib/logger.js';

/**
 * Deletes history metadata past its 7-day expiry, and the associated storage file
 * once it is no longer referenced by any content or history.
 */
export async function runHistoryCleanup(now = new Date()) {
  const expired = await prisma.contentHistory.findMany({ where: { expiresAt: { lt: now } } });
  let deletedFiles = 0;

  for (const h of expired) {
    await prisma.contentHistory.delete({ where: { id: h.id } });

    const content = await prisma.content.findUnique({ where: { id: h.originalContentId } });
    if (content && content.status === CONTENT_STATUS.ARCHIVED) {
      const [remainingHistory, inPlaylist] = await Promise.all([
        prisma.contentHistory.count({ where: { originalContentId: content.id } }),
        prisma.playlistItem.count({ where: { contentId: content.id } }),
      ]);
      if (remainingHistory === 0 && inPlaylist === 0) {
        const mediaId = content.mediaObjectId;
        await prisma.content.delete({ where: { id: content.id } });
        if (await deleteMediaIfUnreferenced(mediaId)) deletedFiles++;
      }
    } else {
      if (await deleteMediaIfUnreferenced(h.mediaObjectId)) deletedFiles++;
    }
  }

  if (expired.length) logger.info({ purged: expired.length, deletedFiles }, 'History cleanup done');
  return { purged: expired.length, deletedFiles };
}
