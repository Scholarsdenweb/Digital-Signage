import { startServer } from './server.js';
import { logger } from './lib/logger.js';

startServer();

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));
