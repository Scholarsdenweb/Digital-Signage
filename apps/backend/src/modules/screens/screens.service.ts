import { prisma } from '../../lib/prisma.js';
import { NotFound, Conflict, Gone, BadRequest } from '../../lib/errors.js';
import {
  DEFAULTS,
  SCREEN_STATUS,
  WS,
  type PairRequestInput,
  type ClaimPairingInput,
} from '@dsm/shared';
import {
  generatePairingCode,
  generateDeviceToken,
  hashDeviceToken,
} from '../../lib/tokens.js';
import { wsHub } from '../../ws/hub.js';

// ── Pairing (device side) ──

export async function createPairingRequest(input: PairRequestInput) {
  const pairingCode = generatePairingCode();
  const req = await prisma.pairingRequest.create({
    data: {
      pairingCode,
      width: input.width,
      height: input.height,
      devicePixelRatio: input.devicePixelRatio,
      orientation: input.orientation,
      userAgent: input.userAgent,
      platform: input.platform,
      expiresAt: new Date(Date.now() + DEFAULTS.PAIRING_CODE_TTL_MS),
    },
  });
  wsHub.broadcastToDashboard({
    event: WS.PAIRING_REQUEST_CREATED,
    data: { pairingCode, width: input.width, height: input.height, orientation: input.orientation },
  });
  return { pairingCode, expiresAt: req.expiresAt };
}

export async function pairingStatus(pairingCode: string) {
  const req = await prisma.pairingRequest.findUnique({ where: { pairingCode } });
  if (!req) throw NotFound('Unknown pairing code');
  if (!req.claimed) {
    if (req.expiresAt < new Date()) throw Gone('Pairing code expired');
    return { status: 'pending' as const };
  }
  // Once claimed, hand the (one-time) device token to the device, then clear it.
  // Persisted on the PairingRequest so it survives a restart / works across instances.
  if (req.deviceToken && !req.tokenDeliveredAt) {
    await prisma.pairingRequest.update({
      where: { id: req.id },
      data: { deviceToken: null, tokenDeliveredAt: new Date() },
    });
    return { status: 'paired' as const, deviceToken: req.deviceToken, screenId: req.screenId };
  }
  return { status: 'paired' as const, screenId: req.screenId };
}

// ── Admin: claim a pairing code -> create Screen + DeviceCredential ──

async function nextScreenKey(): Promise<string> {
  const count = await prisma.screen.count();
  return `SCREEN-${String(count + 1).padStart(3, '0')}`;
}

export async function claimPairing(input: ClaimPairingInput) {
  const req = await prisma.pairingRequest.findUnique({ where: { pairingCode: input.pairingCode } });
  if (!req) throw NotFound('Unknown pairing code');
  if (req.claimed) throw Conflict('Pairing code already used');
  if (req.expiresAt < new Date()) throw Gone('Pairing code expired');

  const deviceToken = generateDeviceToken();
  const screenKey = await nextScreenKey();

  const screen = await prisma.$transaction(async (tx) => {
    const screen = await tx.screen.create({
      data: {
        screenKey,
        name: input.name,
        location: input.location,
        orientation: input.orientation,
        width: req.width,
        height: req.height,
        devicePixelRatio: req.devicePixelRatio,
        status: SCREEN_STATUS.ACTIVE,
        screenGroupId: input.screenGroupId,
      },
    });
    await tx.deviceCredential.create({
      data: { screenId: screen.id, tokenHash: hashDeviceToken(deviceToken) },
    });
    await tx.playlist.create({ data: { screenId: screen.id } });
    if (input.handlerIds.length > 0) {
      await tx.screenHandler.createMany({
        data: input.handlerIds.map((userId) => ({ screenId: screen.id, userId })),
        skipDuplicates: true,
      });
    }
    await tx.pairingRequest.update({
      where: { id: req.id },
      // Store the one-time token for the device to retrieve via pair-status.
      data: { claimed: true, screenId: screen.id, deviceToken },
    });
    return screen;
  });

  return screen;
}

// ── Admin: screen management ──

export async function updateScreen(
  screenId: string,
  data: Partial<{ name: string; location: string; orientation: string; screenGroupId: string | null }>,
) {
  await ensureScreen(screenId);
  return prisma.screen.update({ where: { id: screenId }, data: data as never });
}

export async function assignHandlers(screenId: string, handlerIds: string[]) {
  await ensureScreen(screenId);
  await prisma.$transaction(async (tx) => {
    await tx.screenHandler.deleteMany({ where: { screenId } });
    if (handlerIds.length > 0) {
      await tx.screenHandler.createMany({
        data: handlerIds.map((userId) => ({ screenId, userId })),
        skipDuplicates: true,
      });
    }
  });
  return prisma.screenHandler.findMany({ where: { screenId }, include: { user: { select: { id: true, name: true, email: true } } } });
}

export async function setScreenEnabled(screenId: string, enabled: boolean) {
  await ensureScreen(screenId);
  const screen = await prisma.screen.update({
    where: { id: screenId },
    data: { status: enabled ? SCREEN_STATUS.ACTIVE : SCREEN_STATUS.DISABLED },
  });
  if (!enabled) {
    wsHub.broadcastToScreen(screenId, { event: WS.DEVICE_DISABLED, data: { screenId } });
  }
  return screen;
}

export async function revokeDeviceCredential(screenId: string) {
  await ensureScreen(screenId);
  await prisma.deviceCredential.updateMany({
    where: { screenId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  wsHub.broadcastToScreen(screenId, { event: WS.DEVICE_REVOKED, data: { screenId } });
}

async function ensureScreen(screenId: string) {
  const s = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!s) throw NotFound('Screen not found');
  return s;
}

export async function getScreenConfig(screenId: string) {
  const screen = await ensureScreen(screenId);
  return {
    screenId: screen.id,
    screenKey: screen.screenKey,
    name: screen.name,
    orientation: screen.orientation,
    width: screen.width,
    height: screen.height,
    status: screen.status,
    maintenanceUntil: screen.maintenanceUntil?.toISOString() ?? null,
  };
}
