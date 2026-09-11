import http from 'node:http';
import { createApp } from './app.js';
import { wsHub } from './ws/hub.js';
import { startScheduler } from './scheduler/index.js';
import { env } from './env.js';
import { logger } from './lib/logger.js';

export function createServer() {
  const app = createApp();
  const server = http.createServer(app);
  wsHub.init(server);
  return server;
}

export function startServer() {
  const server = createServer();
  server.listen(env.port, () => {
    logger.info(`Backend listening on :${env.port} (${env.nodeEnv})`);
    if (!env.isTest) startScheduler();
  });
  return server;
}
