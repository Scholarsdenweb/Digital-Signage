import sharp from 'sharp';
import { nanoid } from 'nanoid';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../storage/index.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  MEDIA_KIND,
  type MediaInfo,
} from '@dsm/shared';

const imageMimes = new Set<string>(ALLOWED_IMAGE_MIME);
const videoMimes = new Set<string>(ALLOWED_VIDEO_MIME);

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** Validates a file and stores it, returning a persisted MediaObject id. */
export async function storeUploadedMedia(
  file: UploadedFile,
  hints?: { width?: number; height?: number; durationSec?: number },
): Promise<string> {
  const isImage = imageMimes.has(file.mimetype);
  const isVideo = videoMimes.has(file.mimetype);
  if (!isImage && !isVideo) throw BadRequest(`Unsupported file type: ${file.mimetype}`);

  let width = hints?.width ?? null;
  let height = hints?.height ?? null;
  let durationSec = hints?.durationSec ?? null;

  if (isImage) {
    try {
      const meta = await sharp(file.buffer).metadata();
      width = meta.width ?? width;
      height = meta.height ?? height;
    } catch {
      throw BadRequest('Corrupt or unreadable image file');
    }
  }

  const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
  const key = `media/${new Date().getFullYear()}/${nanoid()}.${ext}`;
  const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

  await storage().put({ key, body: file.buffer, contentType: file.mimetype });

  const media = await prisma.mediaObject.create({
    data: {
      provider: storage().name,
      storageKey: key,
      mimeType: file.mimetype,
      kind: isImage ? MEDIA_KIND.IMAGE : MEDIA_KIND.VIDEO,
      sizeBytes: file.size,
      width,
      height,
      durationSec,
      checksum,
    },
  });
  return media.id;
}

export async function mediaInfo(mediaObjectId: string, contentId: string): Promise<MediaInfo> {
  const m = await prisma.mediaObject.findUnique({ where: { id: mediaObjectId } });
  if (!m) throw NotFound('Media not found');
  return {
    kind: m.kind as MediaInfo['kind'],
    mimeType: m.mimeType,
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    sizeBytes: m.sizeBytes,
    url: await storage().resolveUrl(m.storageKey, contentId),
  };
}

/** Streams media by contentId (used by the local-provider proxy route). */
export async function streamContentMedia(contentId: string) {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { media: true },
  });
  if (!content) throw NotFound('Content not found');
  const stream = await storage().getStream(content.media.storageKey);
  return { stream, mimeType: content.media.mimeType, sizeBytes: content.media.sizeBytes };
}

/** Deletes a stored file only if no Content or ContentHistory still references it. */
export async function deleteMediaIfUnreferenced(mediaObjectId: string) {
  const [contentRefs, historyRefs] = await Promise.all([
    prisma.content.count({ where: { mediaObjectId } }),
    prisma.contentHistory.count({ where: { mediaObjectId } }),
  ]);
  if (contentRefs + historyRefs > 0) return false;
  const media = await prisma.mediaObject.findUnique({ where: { id: mediaObjectId } });
  if (!media) return false;
  await storage().delete(media.storageKey);
  await prisma.mediaObject.delete({ where: { id: mediaObjectId } });
  return true;
}
