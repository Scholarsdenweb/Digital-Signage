FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/player/package.json apps/player/
RUN npm install
COPY packages/shared packages/shared
COPY apps/player apps/player
RUN npm run build -w @dsm/shared && npm run build -w @dsm/player

FROM nginx:1.27-alpine
COPY apps/player/nginx.conf /etc/nginx/conf.d/default.conf
# Player is built with base /player/
COPY --from=build /app/apps/player/dist /usr/share/nginx/html/player
EXPOSE 80
