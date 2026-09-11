FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @dsm/shared && npm run build -w @dsm/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
