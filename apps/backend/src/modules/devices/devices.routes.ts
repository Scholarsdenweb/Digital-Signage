import { Router } from 'express';
import { pairRequestSchema, deviceAuthSchema, WS } from '@dsm/shared';
import { validateBody } from '../../middleware/validate.js';
import { requireDevice } from '../../middleware/deviceAuth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import * as screens from '../screens/screens.service.js';
import { getLivePlaylist } from '../playlist/playlist.service.js';
import { recordHeartbeat } from './heartbeat.service.js';
import { pendingCommands, markCommandAcked } from '../commands/commands.service.js';
import { prisma } from '../../lib/prisma.js';
import { hashDeviceToken } from '../../lib/tokens.js';
import { logActivity } from '../activity/activity.service.js';

export const devicesRouter = Router();

// ── Unauthenticated pairing ──
devicesRouter.post(
  '/pair-request',
  authLimiter,
  validateBody(pairRequestSchema),
  asyncHandler(async (req, res) => res.status(201).json(await screens.createPairingRequest(req.body))),
);

devicesRouter.get(
  '/pair-status/:code',
  asyncHandler(async (req, res) => res.json(await screens.pairingStatus(req.params.code))),
);

// ── Device-token authenticated ──
devicesRouter.post(
  '/authenticate',
  validateBody(deviceAuthSchema),
  asyncHandler(async (req, res) => {
    const cred = await prisma.deviceCredential.findUnique({
      where: { tokenHash: hashDeviceToken(req.body.deviceToken) },
      include: { screen: true },
    });
    if (!cred || cred.revokedAt)
      return res.status(401).json({ error: { code: 'DEVICE_REVOKED', message: 'Credential revoked' } });
    if (cred.screen.status === 'DISABLED')
      return res.status(403).json({ error: { code: 'DEVICE_DISABLED', message: 'Screen disabled' } });
    await prisma.deviceCredential.update({ where: { id: cred.id }, data: { lastAuthAt: new Date() } });
    await logActivity({ actorType: 'DEVICE', action: 'DEVICE_AUTH', entityType: 'Screen', entityId: cred.screenId });
    res.json({
      ok: true,
      config: await screens.getScreenConfig(cred.screenId),
    });
  }),
);

devicesRouter.use('/me', requireDevice);

devicesRouter.get(
  '/me/config',
  asyncHandler(async (req, res) => res.json(await screens.getScreenConfig(req.device!.screenId))),
);

devicesRouter.get(
  '/me/playlist',
  asyncHandler(async (req, res) => res.json(await getLivePlaylist(req.device!.screenId))),
);

devicesRouter.post(
  '/me/heartbeat',
  asyncHandler(async (req, res) => {
    await recordHeartbeat(req.device!.screenId, { ...req.body, wsConnected: false });
    res.json({ ok: true });
  }),
);

devicesRouter.get(
  '/me/commands',
  asyncHandler(async (req, res) => res.json(await pendingCommands(req.device!.screenId))),
);

devicesRouter.post(
  '/me/commands/:id/ack',
  asyncHandler(async (req, res) => {
    await markCommandAcked(req.params.id);
    res.json({ ok: true });
  }),
);
