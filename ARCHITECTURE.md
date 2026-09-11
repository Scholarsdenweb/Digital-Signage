# Architecture

## Overview

Two browser clients talk to one Node backend which owns PostgreSQL (metadata) and an
object store (media files):

- **Management app** (`/`) — Admin + Handler, JWT auth (access 15m + rotating refresh).
- **Display player** (`/player`) — Android screens only, device-token auth, offline-first.

The **backend playlist is the single source of truth**. The player only synchronises
and plays; it never decides content on its own.

```
Web/Player ──REST(HTTPS)──▶ Express routers ──▶ services ──▶ Prisma ──▶ PostgreSQL
     │                          │
     └────WS(/ws)──────────────▶ WsHub (screen rooms + dashboard room)
                                │
                          node-cron scheduler (birthday / history-cleanup / maintenance)
                                │
                          StorageProvider (local | s3/R2)  ──▶ media files
```

## Modules (backend)

`auth, users, screens, devices, groups, content, media, playlist, history, students,
birthday, commands, dashboard, activity`. Each has `*.service.ts` (business rules) and
`*.routes.ts` (HTTP + validation + RBAC). Pure algorithms live in
`playlist/playlist.logic.ts` and `lib/birthday.logic.ts` so they are unit-testable.

## Data model (ERD summary)

`User—Role`, `User⇄Screen` via `ScreenHandler`, `Screen—DeviceCredential (1:1)`,
`Screen—Playlist (1:1)`, `Playlist—PlaylistItem (1:N, stage=DRAFT|LIVE)`,
`PlaylistItem—Content`, `Content—MediaObject`, `Content—ContentHistory`,
`Screen⇄ScreenGroup`, `Student—BirthdayInstance—BirthdayTemplate`, plus
`DeviceHeartbeat`, `DeviceCommand`, `PairingRequest`, `RefreshToken`, `ActivityLog`.
Full field-level definition: [apps/backend/prisma/schema.prisma](apps/backend/prisma/schema.prisma).

Indexes exist on screenKey, content status/type, playlist(+stage), history `expiresAt`,
student `(birthMonth, birthDay)`, heartbeat `(screenId, createdAt)`, command
`(screenId, status)`.

## Playlist: draft vs live

Editors mutate `stage=DRAFT` items; the device reads `stage=LIVE`. **Publish** runs in a
transaction: diff old-live vs new-draft → write `ContentHistory` for anything leaving
(REPLACED if the slot now holds different content, else REMOVED) → swap LIVE←DRAFT →
bump `liveVersion` → broadcast `PLAYLIST_UPDATED`. The player applies a new playlist at
the next loop boundary (current item finishes) unless the update is marked `urgent`.

## WebSocket

- Player connects `/ws?type=device`, authenticates with `HELLO {deviceToken}`, joins its
  screen room, then streams `HEARTBEAT` / `COMMAND_ACK`.
- Management connects `/ws?type=mgmt&token=<jwt>`, joins the dashboard room, and receives
  `HEARTBEAT_UPDATE`, `SCREEN_STATUS_CHANGED`, `PAIRING_REQUEST_CREATED`, `PLAYLIST_UPDATED`.
- Server→player: `PLAYLIST_UPDATED, CONTENT_*, QUEUE_REORDERED, ENTER_MAINTENANCE,
  RESUME_DISPLAY, RELOAD_PLAYER, SYNC_CONTENT, RESTART_PLAYER, DEVICE_DISABLED,
  DEVICE_REVOKED`. Names are shared in `@dsm/shared/ws-events`.

## Offline & recovery (player)

- Service worker caches the app shell (network-first) and media (cache-first).
- Playlist + screen config cached in `localStorage`; boots and re-auths from cache when
  offline — never a blank screen, never a re-login prompt.
- Reconnect: WS auto-reconnects with backoff; on `online` the player resyncs the playlist
  and prefetches changed media.
- Freeze watchdog: a stalled rAF loop triggers a self-reload; `RELOAD_PLAYER`/
  `RESTART_PLAYER` commands force recovery remotely.

## Security

Password hashing (bcrypt), JWT access + rotating refresh (hashed at rest, revocable),
device tokens (opaque, HMAC-at-rest, revocable), RBAC + per-screen handler checks on
every screen-scoped route, upload type/size validation, rate limiting, CORS allowlist,
WS auth, and audit logging (`ActivityLog`) for important actions. Storage credentials
never reach the browser (media is proxied for local, or signed-URL for S3/R2).

## Testing

Pure unit tests (always run): queue insert/replace-preserve-position/reorder/remove,
history REPLACED/REMOVED diff, birthday date match + cycling, RBAC/restore permissions.
DB-backed integration (`TEST_DATABASE_URL`): screen registration & pairing, device auth,
disable + credential revocation, handler-screen permission denial, upload→draft, insert,
replace-preserving-position, publish, live playlist read, history creation, admin
restore-to-library, maintenance + resume, heartbeat, birthday generation, 7-day cleanup.
The 26 required scenarios are annotated in the test files by number.
