import { z } from 'zod';
import {
  CONTENT_TYPE,
  ORIENTATION,
  DEVICE_COMMAND,
  MEDIA_KIND,
  CONTENT_STATUS,
} from './constants.js';

// ── Auth ──
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

// ── Users ──
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'HANDLER']),
});
export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8).max(128).optional(),
  active: z.boolean().optional(),
});

// ── Device pairing ──
export const pairRequestSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  devicePixelRatio: z.number().positive().optional(),
  orientation: z.enum([ORIENTATION.LANDSCAPE, ORIENTATION.PORTRAIT]),
  userAgent: z.string().max(512).optional(),
  platform: z.string().max(120).optional(),
});
export type PairRequestInput = z.infer<typeof pairRequestSchema>;

export const claimPairingSchema = z.object({
  pairingCode: z.string().length(6),
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
  orientation: z.enum([ORIENTATION.LANDSCAPE, ORIENTATION.PORTRAIT]),
  screenGroupId: z.string().uuid().optional(),
  handlerIds: z.array(z.string().uuid()).default([]),
});
export type ClaimPairingInput = z.infer<typeof claimPairingSchema>;

export const deviceAuthSchema = z.object({ deviceToken: z.string().min(20) });

// ── Screens ──
export const updateScreenSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  location: z.string().max(200).optional(),
  orientation: z.enum([ORIENTATION.LANDSCAPE, ORIENTATION.PORTRAIT]).optional(),
  screenGroupId: z.string().uuid().nullable().optional(),
});
export const assignHandlersSchema = z.object({
  handlerIds: z.array(z.string().uuid()),
});

// ── Screen groups ──
export const screenGroupSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
});
/** Publish a set of content as the playlist for EVERY screen in a group (replaces live). */
export const groupPublishSchema = z.object({
  items: z
    .array(
      z.object({
        contentId: z.string().uuid(),
        durationSec: z.number().int().min(1).max(3600).optional(),
      }),
    )
    .min(1),
});

// ── Content ──
// Upload metadata (file itself comes via multipart)
export const createContentSchema = z.object({
  title: z.string().min(1).max(160),
  type: z.enum([
    CONTENT_TYPE.TIMETABLE,
    CONTENT_TYPE.ACHIEVEMENT,
    CONTENT_TYPE.GENERAL,
  ]),
  fitMode: z.enum(['COVER', 'CONTAIN']).optional(),
  defaultDurationSec: z.coerce.number().int().min(1).max(3600).optional(),
});
export const updateContentSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  fitMode: z.enum(['COVER', 'CONTAIN']).optional(),
  defaultDurationSec: z.number().int().min(1).max(3600).optional(),
});

// ── Playlist ──
export const addPlaylistItemSchema = z.object({
  contentId: z.string().uuid(),
  durationSec: z.number().int().min(1).max(3600).optional(),
  /** 0-based insertion index; omitted => append */
  position: z.number().int().min(0).optional(),
});
export const replacePlaylistItemSchema = z.object({
  contentId: z.string().uuid(),
  durationSec: z.number().int().min(1).max(3600).optional(),
});
export const updateItemDurationSchema = z.object({
  durationSec: z.number().int().min(1).max(3600),
});
export const reorderPlaylistSchema = z.object({
  /** full ordered list of playlistItemIds */
  itemIds: z.array(z.string().uuid()).min(1),
});

/** Publish this screen's playlist to additional screens and/or screen groups. */
export const publishToSchema = z.object({
  screenIds: z.array(z.string().uuid()).default([]),
  screenGroupIds: z.array(z.string().uuid()).default([]),
  includeSource: z.boolean().default(true),
});

// ── History ──
export const restoreHistorySchema = z.object({}).strict();

// ── Students ──
export const studentSchema = z.object({
  studentCode: z.string().min(1).max(60),
  name: z.string().min(1).max(160),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  batch: z.string().max(120).optional(),
  course: z.string().max(120).optional(),
});
export const updateStudentSchema = studentSchema.partial();
export const bulkStudentsSchema = z.object({
  students: z.array(studentSchema).min(1).max(5000),
});

// ── Birthday template ──
export const birthdayTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  /** template design JSON: background, text placement, colors, message */
  design: z.record(z.any()),
  defaultDurationSec: z.number().int().min(1).max(120).default(10),
  isDefault: z.boolean().optional(),
});
export const assignBirthdaySchema = z.object({
  screenIds: z.array(z.string().uuid()).default([]),
  screenGroupIds: z.array(z.string().uuid()).default([]),
});

// ── Device commands / maintenance ──
export const deviceCommandSchema = z.object({
  command: z.enum([
    DEVICE_COMMAND.ENTER_MAINTENANCE,
    DEVICE_COMMAND.RESUME_DISPLAY,
    DEVICE_COMMAND.RELOAD_PLAYER,
    DEVICE_COMMAND.SYNC_CONTENT,
    DEVICE_COMMAND.RESTART_PLAYER,
  ]),
});
export const maintenanceSchema = z.object({
  /** minutes; null => until manually resumed */
  durationMinutes: z.union([z.literal(10), z.literal(30), z.literal(60)]).nullable(),
});

// ── Shared response DTOs (types only) ──
export interface MediaInfo {
  kind: (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  sizeBytes: number;
  url: string; // resolvable media URL (proxied or signed)
}
export interface ContentDto {
  id: string;
  title: string;
  type: string;
  status: (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];
  fitMode: 'COVER' | 'CONTAIN';
  defaultDurationSec: number;
  ownerId: string;
  ownerName?: string;
  media: MediaInfo;
  /** Animated text the player overlays on the media (e.g. birthday name/date). */
  birthday?: { name: string; dateText: string; batch?: string };
  createdAt: string;
  updatedAt: string;
}
export interface PlaylistItemDto {
  id: string;
  position: number;
  durationSec: number;
  content: ContentDto;
}
export interface PlaylistDto {
  screenId: string;
  screenKey: string;
  version: number;
  items: PlaylistItemDto[];
  /** unpublished working copy differs from live */
  hasDraftChanges: boolean;
}
export interface ScreenConfigDto {
  screenId: string;
  screenKey: string;
  name: string;
  orientation: string;
  width: number;
  height: number;
  status: string;
  maintenanceUntil: string | null;
}
