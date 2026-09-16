# Multi-stage build for the backend (monorepo-aware).
FROM node:20-bookworm-slim AS build
WORKDIR /app
# Prisma's engines require OpenSSL (not present in the slim image).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
RUN npm install
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npm run build -w @dsm/shared \
 && npx -w @dsm/backend prisma generate \
 && npm run build -w @dsm/backend

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# OpenSSL for Prisma; fonts for the birthday image renderer (sharp/librsvg needs
# real fonts installed). Pacifico gives the cursive "Birthday" look.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates fontconfig fonts-dejavu-core fonts-liberation curl \
 && mkdir -p /usr/share/fonts/truetype/pacifico \
 && (curl -fsSL -o /usr/share/fonts/truetype/pacifico/Pacifico-Regular.ttf \
      https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf || echo "pacifico download skipped") \
 && fc-cache -f \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
# sharp needs libvips runtime libs (bundled in prebuilt binary on slim works)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
EXPOSE 4000
# Apply migrations (run from the backend workspace so the schema resolves) then start.
CMD ["sh", "-c", "cd apps/backend && npx prisma migrate deploy && cd /app && node apps/backend/dist/index.js"]
