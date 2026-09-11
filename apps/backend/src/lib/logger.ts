import pino, { type LoggerOptions } from 'pino';
import { env } from '../env.js';

const options: LoggerOptions = { level: env.isProd ? 'info' : 'debug' };

// Use the pretty transport in dev only if it's installed; otherwise fall back to
// plain JSON logging so a missing dev dependency can never crash the server.
function createLogger() {
  if (!env.isProd) {
    try {
      return pino({
        ...options,
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
      });
    } catch {
      /* pino-pretty not available — fall through to plain logger */
    }
  }
  return pino(options);
}

export const logger = createLogger();
