import type { DeviceCommandType } from './constants.js';

/** WebSocket event names. Shared so server/player/web never drift. */
export const WS = {
  // ── Server → Player (screen room) ──
  PLAYLIST_UPDATED: 'PLAYLIST_UPDATED',
  CONTENT_ADDED: 'CONTENT_ADDED',
  CONTENT_REPLACED: 'CONTENT_REPLACED',
  CONTENT_REMOVED: 'CONTENT_REMOVED',
  QUEUE_REORDERED: 'QUEUE_REORDERED',
  ENTER_MAINTENANCE: 'ENTER_MAINTENANCE',
  RESUME_DISPLAY: 'RESUME_DISPLAY',
  RELOAD_PLAYER: 'RELOAD_PLAYER',
  SYNC_CONTENT: 'SYNC_CONTENT',
  RESTART_PLAYER: 'RESTART_PLAYER',
  DEVICE_COMMAND: 'DEVICE_COMMAND',
  DEVICE_DISABLED: 'DEVICE_DISABLED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',

  // ── Player → Server ──
  HELLO: 'HELLO',
  HEARTBEAT: 'HEARTBEAT',
  CURRENT_CONTENT: 'CURRENT_CONTENT',
  COMMAND_ACK: 'COMMAND_ACK',

  // ── Server → Management (dashboard room) ──
  SCREEN_STATUS_CHANGED: 'SCREEN_STATUS_CHANGED',
  HEARTBEAT_UPDATE: 'HEARTBEAT_UPDATE',
  PAIRING_REQUEST_CREATED: 'PAIRING_REQUEST_CREATED',

  // ── Generic ──
  ERROR: 'ERROR',
  ACK: 'ACK',
} as const;
export type WsEventName = (typeof WS)[keyof typeof WS];

export interface WsMessage<T = unknown> {
  event: WsEventName;
  data?: T;
  /** monotonically increasing playlist version for optimistic client apply */
  playlistVersion?: number;
  ts?: number;
}

// ── Payload shapes ──
export interface PlaylistUpdatedPayload {
  screenId: string;
  playlistVersion: number;
  urgent?: boolean; // if true, apply immediately (do not wait for current item)
}
export interface EnterMaintenancePayload {
  screenId: string;
  until: string | null; // ISO date or null = until manually resumed
}
export interface DeviceCommandPayload {
  screenId: string;
  commandId: string;
  command: DeviceCommandType;
}
export interface HelloPayload {
  deviceToken: string;
  playerVersion: string;
}
export interface HeartbeatPayload {
  screenId?: string;
  status: 'online' | 'offline' | 'maintenance';
  currentContent?: string | null;
  playerVersion: string;
  resolution?: string;
  orientation?: string;
  cacheBytes?: number;
  cachedItems?: number;
  online?: boolean;
}
export interface HeartbeatUpdatePayload extends HeartbeatPayload {
  screenId: string;
  screenKey: string;
  lastSeen: string;
  wsConnected: boolean;
}
export interface CommandAckPayload {
  commandId: string;
}
export interface CurrentContentPayload {
  contentId: string | null;
  contentTitle?: string | null;
}
