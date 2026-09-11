import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

interface LogInput {
  actorId?: string | null;
  actorType?: 'USER' | 'DEVICE' | 'SYSTEM';
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Fire-and-forget audit logging for important admin/handler/device actions. */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? 'USER',
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as never,
        ip: input.ip,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to write activity log');
  }
}
