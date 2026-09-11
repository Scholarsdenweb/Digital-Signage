/** Shared enums & constants used across backend, web and player. */

export const ROLES = {
  ADMIN: 'ADMIN',
  HANDLER: 'HANDLER',
} as const;
export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const CONTENT_TYPE = {
  TIMETABLE: 'TIMETABLE',
  ACHIEVEMENT: 'ACHIEVEMENT',
  GENERAL: 'GENERAL',
  BIRTHDAY: 'BIRTHDAY',
} as const;
export type ContentType = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE];

export const MEDIA_KIND = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
} as const;
export type MediaKind = (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];

/**
 * Content lifecycle:
 *   DRAFT  -> (published in a playlist) LIVE -> (replaced/removed) ARCHIVED (history)
 * Only content that was LIVE can enter history.
 */
export const CONTENT_STATUS = {
  DRAFT: 'DRAFT',
  LIVE: 'LIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ContentStatus = (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];

export const SCREEN_STATUS = {
  UNREGISTERED: 'UNREGISTERED',
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  DISABLED: 'DISABLED',
} as const;
export type ScreenStatus = (typeof SCREEN_STATUS)[keyof typeof SCREEN_STATUS];

export const ORIENTATION = {
  LANDSCAPE: 'LANDSCAPE',
  PORTRAIT: 'PORTRAIT',
} as const;
export type Orientation = (typeof ORIENTATION)[keyof typeof ORIENTATION];

export const DEVICE_COMMAND = {
  ENTER_MAINTENANCE: 'ENTER_MAINTENANCE',
  RESUME_DISPLAY: 'RESUME_DISPLAY',
  RELOAD_PLAYER: 'RELOAD_PLAYER',
  SYNC_CONTENT: 'SYNC_CONTENT',
  RESTART_PLAYER: 'RESTART_PLAYER',
} as const;
export type DeviceCommandType = (typeof DEVICE_COMMAND)[keyof typeof DEVICE_COMMAND];

export const MAINTENANCE_DURATIONS_MIN = [10, 30, 60] as const; // plus null = until resumed

export const DEFAULTS = {
  IMAGE_DURATION_SEC: 15,
  HEARTBEAT_INTERVAL_MS: 30_000,
  OFFLINE_THRESHOLD_MS: 90_000, // no heartbeat for 90s => offline
  PAIRING_CODE_TTL_MS: 15 * 60_000,
  HISTORY_RETENTION_DAYS: 7,
  PLAYER_VERSION: '1.0.0',
} as const;

export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm'] as const;
