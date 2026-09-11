# Production Deployment

## 1. Prerequisites

- A Linux host with Docker + Docker Compose (or a Node 20 host + managed Postgres).
- A domain, e.g. `display.example.com`, with TLS (Let's Encrypt).
- Optional: a Cloudflare R2 bucket (free egress) for media storage.

## 2. Environment

Copy `.env.example` → `.env` and set **strong** secrets (each ≥ 32 chars):

```
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DEVICE_TOKEN_SECRET
DATABASE_URL=postgresql://user:pass@db:5432/dsm?schema=public
BACKEND_PUBLIC_URL=https://display.example.com/api
CORS_ORIGINS=https://display.example.com
VITE_API_URL=https://display.example.com/api
VITE_WS_URL=wss://display.example.com
```

Storage — start free with `local`; switch to R2/S3 with no code change:

```
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_BUCKET=dsm-media
S3_ACCESS_KEY_ID=...        S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://media.example.com   # optional CDN; otherwise signed URLs are used
```

## 3. Bring it up

```bash
docker compose up -d --build
docker compose exec backend npx -w @dsm/backend prisma migrate deploy
docker compose exec backend npx -w @dsm/backend tsx prisma/seed.ts   # first run only
```

The backend container also runs `prisma migrate deploy` on start (see its Dockerfile).

## 3b. Recommended: one-command production stack (with automatic HTTPS)

A ready-to-use production stack lives in [`deploy/`](deploy/): Postgres + backend + web +
player behind a **Caddy** reverse proxy that obtains and renews TLS certificates
automatically. Only Caddy is exposed to the internet.

```bash
# 1. Copy the generated template and set DOMAIN (+ storage if using S3/R2)
cp .env.production .env.production.local   # edit DOMAIN etc., keep secrets
#    Point your domain's DNS A/AAAA record at this server BEFORE starting Caddy.

# 2. Build & start (frontend VITE_* are baked at build time from the env file)
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml up -d --build

# 3. Seed once
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml \
  exec backend npx -w @dsm/backend tsx prisma/seed.ts
```

Then browse `https://<DOMAIN>` (management) and `https://<DOMAIN>/player/` (screens).
HTTPS is mandatory — the player's offline service worker and fullscreen/kiosk only work
over a secure origin.

## 4. Reverse proxy (single domain)

The `deploy/Caddyfile` already does this. If you prefer Nginx, mirror these routes so
everything shares one origin (required for cookies, WS upgrade, and the player
service-worker scope):

```
location /api/    { proxy_pass http://backend:4000/; }
location /ws      { proxy_pass http://backend:4000/ws;
                    proxy_http_version 1.1;
                    proxy_set_header Upgrade $http_upgrade;
                    proxy_set_header Connection "upgrade"; }
location /player/ { proxy_pass http://player:80/player/; }
location /        { proxy_pass http://web:80/; }
```

(When behind `/api`, set `BACKEND_PUBLIC_URL=https://display.example.com/api` so media
URLs resolve, and `VITE_API_URL=https://display.example.com/api`.)

## 5. Operations

- **Backups**: `pg_dump` on the `db` volume + back up the media volume/bucket.
- **Scaling**: the backend is stateless except the in-memory WS hub; run a single
  instance, or add a Redis pub/sub adapter to the hub before horizontal scaling.
- **Scheduler**: birthday generation 00:05 daily, history cleanup hourly, maintenance
  auto-resume every minute (node-cron inside the backend).
- **Health**: `GET /health`. Device online/offline is derived from the last heartbeat
  (90s threshold) and live WS connection state.
- **Logs/audit**: structured pino logs; important actions recorded in `ActivityLog`.

## 6. Hardening checklist

- [ ] Rotate all three secrets; never commit `.env`.
- [ ] Restrict `CORS_ORIGINS` to the real domain(s).
- [ ] Serve only over HTTPS/WSS; enable HSTS at the proxy.
- [ ] Put the DB on a private network; no public 5432.
- [ ] Set `MAX_UPLOAD_MB` to a sane cap; front uploads with a WAF/rate limits.
- [ ] Revoke device credentials for lost/retired screens (Screens → Disable / Revoke).
