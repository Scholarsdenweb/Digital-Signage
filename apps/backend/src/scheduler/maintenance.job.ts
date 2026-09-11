import { prisma } from '../lib/prisma.js';
import { SCREEN_STATUS, DEVICE_COMMAND } from '@dsm/shared';
import { issueCommand } from '../modules/commands/commands.service.js';
import { logger } from '../lib/logger.js';

/** Auto-resumes screens whose timed maintenance window has elapsed. */
export async function runMaintenanceExpiry(now = new Date()) {
  const expired = await prisma.screen.findMany({
    where: { status: SCREEN_STATUS.MAINTENANCE, maintenanceUntil: { not: null, lte: now } },
  });
  for (const screen of expired) {
    await issueCommand(screen.id, DEVICE_COMMAND.RESUME_DISPLAY, null);
    logger.info({ screenId: screen.id }, 'Maintenance window expired -> resume');
  }
  return expired.length;
}
