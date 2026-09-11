# Digital Signage Management Platform

Production-grade digital signage system for a coaching institute. Manages many
**Android display screens** (no external TV box / Pi / mini-PC required — the screens
already run Android), with a management web app, an offline-first display player, a
Node.js/Express + WebSocket backend, PostgreSQL, and a swappable storage layer.

## Monorepo layout

```
packages/shared      @dsm/shared  — types, WS event contracts, zod schemas, RBAC (single source of truth)
apps/backend         @dsm/backend — Express REST + ws + Prisma + node-cron scheduler
apps/web             @dsm/web     — React management app (Admin + Handler)
apps/player          @dsm/player  — React display player (kiosk, offline, PWA)
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md) and
[ANDROID.md](ANDROID.md) for the full design, deployment and kiosk/APK strategy.

## Quick start (local dev)

Prerequisites: Node 20+, a PostgreSQL 14+ instance.

```bash
cp .env.example .env                 # then edit secrets / DATABASE_URL
npm install
npm run build:shared

# database
npm run prisma:migrate -w @dsm/backend    # or: npx -w @dsm/backend prisma migrate deploy
npm run prisma:seed -w @dsm/backend

# run everything (backend :4000, web :5173, player :5174)
npm run dev
```

Open:
- Management app → http://localhost:5173
- Display player → http://localhost:5174/player/

Seeded logins:
- **Admin** — `admin@display.local` / `Admin@12345`
- **Handler** — `handler@display.local` / `Handler@12345`

### Or with Docker

```bash
docker compose up -d --build
# web :5173, player :5174, backend :4000, postgres :5432
# then seed once:
docker compose exec backend npx -w @dsm/backend tsx prisma/seed.ts
```

## Registering a screen

1. Open the player URL on the Android screen → it shows a **pairing code**.
2. In the management app: **Screens → Add Screen**, enter the code, set name /
   location / orientation / group / handlers.
3. The screen auto-receives a device token, authenticates, caches, connects WS, and
   starts playing. After reboot it re-authenticates automatically — no manual login.

## Core rules enforced by the backend

- Uploads are always **drafts**; only **Publish** makes a playlist live.
- **Replace** preserves the item's queue position; **Add** honours the chosen index.
- Replaced/removed **published** content goes to **history for 7 days**, then the
  metadata and (unreferenced) file are deleted.
- **Restore** returns content to the owner's **library as a draft** — it never edits a
  live playlist. Handlers may restore only their own uploads; admins may restore any.
- **Birthdays** are generated automatically from students' DOB using a template.
- All screen/handler permissions are enforced **server-side** (never trust the client).

## Tests

```bash
npm test                                   # pure unit tests (queue/history/birthday/RBAC)
TEST_DATABASE_URL=postgresql://… npm test  # + full DB-backed integration suite
```

Coverage maps to the 26 required scenarios — see [ARCHITECTURE.md](ARCHITECTURE.md#testing).
