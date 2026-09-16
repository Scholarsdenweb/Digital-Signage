import { storage } from '../../storage/index.js';
import type { ContentDto } from '@dsm/shared';

type ContentWithRelations = {
  id: string;
  title: string;
  type: string;
  status: string;
  fitMode: string;
  defaultDurationSec: number;
  ownerId: string;
  owner?: { name: string } | null;
  overlay?: unknown;
  media: {
    id: string;
    kind: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    durationSec: number | null;
    sizeBytes: number;
    storageKey: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

export async function toContentDto(c: ContentWithRelations): Promise<ContentDto> {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    status: c.status as ContentDto['status'],
    fitMode: (c.fitMode as ContentDto['fitMode']) ?? 'COVER',
    defaultDurationSec: c.defaultDurationSec,
    ownerId: c.ownerId,
    ownerName: c.owner?.name,
    media: {
      kind: c.media.kind as ContentDto['media']['kind'],
      mimeType: c.media.mimeType,
      width: c.media.width,
      height: c.media.height,
      durationSec: c.media.durationSec,
      sizeBytes: c.media.sizeBytes,
      url: await storage().resolveUrl(c.media.storageKey, c.id),
    },
    birthday: (c.overlay as ContentDto['birthday']) ?? undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export const contentInclude = {
  media: true,
  owner: { select: { name: true } },
} as const;
