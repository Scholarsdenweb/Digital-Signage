import { generateForDate, cleanupBirthdayBefore } from '../modules/birthday/birthday.service.js';
import { logger } from '../lib/logger.js';

/** Daily: purge yesterday's birthday content, then generate today's instances. */
export async function runBirthdayGeneration() {
  const removed = await cleanupBirthdayBefore();
  const instances = await generateForDate();
  logger.info({ removed, generated: instances.length }, 'Daily birthday job done');
  return { removed, generated: instances.length };
}
