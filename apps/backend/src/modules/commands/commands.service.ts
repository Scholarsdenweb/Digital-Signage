import { prisma } from '../../lib/prisma.js';
import { WS, DEVICE_COMMAND, SCREEN_STATUS, type DeviceCommandType } from '@dsm/shared';
import { wsHub } from '../../ws/hub.js';
import { NotFound } from '../../lib/errors.js';

/**
 * Issues a device command: persists it, updates screen state where relevant,
 * and pushes it over WebSocket. Commands are also delivered on next device poll
 * so an offline screen still receives them when it reconnects.
 */
export async function issueCommand(
  screenId: string,
  command: DeviceCommandType,
  issuedById: string | null,
  opts?: { maintenanceUntil?: Date | null },
) {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen) throw NotFound('Screen not found');

  // Reflect maintenance state on the screen record
  if (command === DEVICE_COMMAND.ENTER_MAINTENANCE) {
    await prisma.screen.update({
      where: { id: screenId },
      data: { status: SCREEN_STATUS.MAINTENANCE, maintenanceUntil: opts?.maintenanceUntil ?? null },
    });
  } else if (command === DEVICE_COMMAND.RESUME_DISPLAY) {
    await prisma.screen.update({
      where: { id: screenId },
      data: { status: SCREEN_STATUS.ACTIVE, maintenanceUntil: null },
    });
  }

  const record = await prisma.deviceCommand.create({
    data: {
      screenId,
      command,
      issuedById,
      status: 'PENDING',
      payload: opts?.maintenanceUntil ? { until: opts.maintenanceUntil.toISOString() } : undefined,
    },
  });

  const eventName = mapCommandToEvent(command);
  wsHub.broadcastToScreen(screenId, {
    event: eventName,
    data: {
      screenId,
      commandId: record.id,
      command,
      until: opts?.maintenanceUntil ? opts.maintenanceUntil.toISOString() : null,
    },
  });
  if (wsHub.isScreenConnected(screenId)) {
    await prisma.deviceCommand.update({ where: { id: record.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
  }
  return record;
}

function mapCommandToEvent(command: DeviceCommandType) {
  switch (command) {
    case DEVICE_COMMAND.ENTER_MAINTENANCE:
      return WS.ENTER_MAINTENANCE;
    case DEVICE_COMMAND.RESUME_DISPLAY:
      return WS.RESUME_DISPLAY;
    case DEVICE_COMMAND.RELOAD_PLAYER:
      return WS.RELOAD_PLAYER;
    case DEVICE_COMMAND.SYNC_CONTENT:
      return WS.SYNC_CONTENT;
    case DEVICE_COMMAND.RESTART_PLAYER:
      return WS.RESTART_PLAYER;
    default:
      return WS.DEVICE_COMMAND;
  }
}

export async function markCommandAcked(commandId: string) {
  await prisma.deviceCommand
    .update({ where: { id: commandId }, data: { status: 'ACKED', ackedAt: new Date() } })
    .catch(() => undefined);
}

/** Pending commands for a device to process on (re)connect. */
export async function pendingCommands(screenId: string) {
  return prisma.deviceCommand.findMany({
    where: { screenId, status: { in: ['PENDING', 'DELIVERED'] } },
    orderBy: { createdAt: 'asc' },
  });
}
