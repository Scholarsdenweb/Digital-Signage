import { prisma } from '../../lib/prisma.js';
import { WS, type HeartbeatPayload } from '@dsm/shared';
import { wsHub } from '../../ws/hub.js';

/** Persists a heartbeat and pushes a live update to the admin dashboard. */
export async function recordHeartbeat(
  screenId: string,
  payload: HeartbeatPayload & { wsConnected?: boolean },
) {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen) return;

  await prisma.deviceHeartbeat.create({
    data: {
      screenId,
      status: payload.status,
      currentContent: payload.currentContent ?? null,
      playerVersion: payload.playerVersion,
      resolution: payload.resolution ?? `${screen.width}x${screen.height}`,
      orientation: payload.orientation ?? screen.orientation,
      cacheBytes: payload.cacheBytes ?? null,
      cachedItems: payload.cachedItems ?? null,
      online: payload.online ?? true,
      wsConnected: payload.wsConnected ?? true,
    },
  });

  wsHub.broadcastToDashboard({
    event: WS.HEARTBEAT_UPDATE,
    data: {
      screenId,
      screenKey: screen.screenKey,
      status: payload.status,
      currentContent: payload.currentContent ?? null,
      playerVersion: payload.playerVersion,
      resolution: payload.resolution ?? `${screen.width}x${screen.height}`,
      orientation: payload.orientation ?? screen.orientation,
      cacheBytes: payload.cacheBytes ?? null,
      cachedItems: payload.cachedItems ?? null,
      lastSeen: new Date().toISOString(),
      wsConnected: payload.wsConnected ?? true,
    },
  });
}

/** Latest heartbeat per screen, used to compute online/offline for the dashboard. */
export async function latestHeartbeat(screenId: string) {
  return prisma.deviceHeartbeat.findFirst({
    where: { screenId },
    orderBy: { createdAt: 'desc' },
  });
}
