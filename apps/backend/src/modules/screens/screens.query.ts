import { prisma } from '../../lib/prisma.js';
import { ROLES, DEFAULTS, SCREEN_STATUS, type RoleName } from '@dsm/shared';
import { wsHub } from '../../ws/hub.js';

export interface ScreenRow {
  id: string;
  screenKey: string;
  name: string;
  location: string | null;
  orientation: string;
  width: number;
  height: number;
  status: string;
  maintenanceUntil: string | null;
  screenGroup: { id: string; name: string } | null;
  handlers: { id: string; name: string; email: string }[];
  online: boolean;
  wsConnected: boolean;
  lastSeen: string | null;
  currentContent: string | null;
  playerVersion: string | null;
  cacheBytes: number | null;
}

function isOnline(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < DEFAULTS.OFFLINE_THRESHOLD_MS;
}

export async function listScreens(actor: { userId: string; role: RoleName }): Promise<ScreenRow[]> {
  const where =
    actor.role === ROLES.ADMIN ? {} : { handlers: { some: { userId: actor.userId } } };

  const screens = await prisma.screen.findMany({
    where,
    include: {
      screenGroup: { select: { id: true, name: true } },
      handlers: { include: { user: { select: { id: true, name: true, email: true } } } },
      heartbeats: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { screenKey: 'asc' },
  });

  return screens.map((s) => {
    const hb = s.heartbeats[0];
    const lastSeen = hb?.createdAt ?? null;
    const online = s.status !== SCREEN_STATUS.DISABLED && isOnline(lastSeen);
    return {
      id: s.id,
      screenKey: s.screenKey,
      name: s.name,
      location: s.location,
      orientation: s.orientation,
      width: s.width,
      height: s.height,
      status: s.status,
      maintenanceUntil: s.maintenanceUntil?.toISOString() ?? null,
      screenGroup: s.screenGroup,
      handlers: s.handlers.map((h) => h.user),
      online,
      wsConnected: wsHub.isScreenConnected(s.id),
      lastSeen: lastSeen?.toISOString() ?? null,
      currentContent: hb?.currentContent ?? null,
      playerVersion: hb?.playerVersion ?? null,
      cacheBytes: hb?.cacheBytes ?? null,
    };
  });
}

export async function getScreen(actor: { userId: string; role: RoleName }, screenId: string) {
  const rows = await listScreens(actor);
  return rows.find((r) => r.id === screenId) ?? null;
}
