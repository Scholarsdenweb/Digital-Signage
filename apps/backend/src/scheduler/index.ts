import cron from 'node-cron';
import { runHistoryCleanup } from './historyCleanup.job.js';
import { runMaintenanceExpiry } from './maintenance.job.js';
import { runBirthdayGeneration } from './birthday.job.js';
import { logger } from '../lib/logger.js';

export function startScheduler() {
  // Birthday generation daily at 00:05
  cron.schedule('5 0 * * *', () => void runBirthdayGeneration().catch((e) => logger.error(e)));
  // History cleanup hourly
  cron.schedule('0 * * * *', () => void runHistoryCleanup().catch((e) => logger.error(e)));
  // Maintenance auto-resume every minute
  cron.schedule('* * * * *', () => void runMaintenanceExpiry().catch((e) => logger.error(e)));

  logger.info('Scheduler started (birthday / history-cleanup / maintenance)');

  // Run once at boot so a fresh deploy has today's birthdays.
  void runBirthdayGeneration().catch(() => undefined);
}
