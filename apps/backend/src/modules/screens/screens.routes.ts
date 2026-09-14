import { Router } from 'express';
import {
  claimPairingSchema,
  updateScreenSchema,
  assignHandlersSchema,
  deviceCommandSchema,
  maintenanceSchema,
  PERMISSIONS,
  DEVICE_COMMAND,
} from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireScreenAccess } from '../../middleware/screenAccess.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as screens from './screens.service.js';
import * as screenQuery from './screens.query.js';
import { issueCommand } from '../commands/commands.service.js';
import { playlistRouter } from '../playlist/playlist.routes.js';
import { logActivity } from '../activity/activity.service.js';

export const screensRouter = Router();
screensRouter.use(requireAuth);

// List (role-scoped) & get
screensRouter.get(
  '/',
  asyncHandler(async (req, res) =>
    res.json(await screenQuery.listScreens({ userId: req.auth!.userId, role: req.auth!.role })),
  ),
);
screensRouter.get(
  '/:screenId',
  requireScreenAccess('screenId'),
  asyncHandler(async (req, res) =>
    res.json(await screenQuery.getScreen({ userId: req.auth!.userId, role: req.auth!.role }, req.params.screenId)),
  ),
);

// Admin: claim pairing code -> register screen
screensRouter.post(
  '/pair',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  validateBody(claimPairingSchema),
  asyncHandler(async (req, res) => {
    const screen = await screens.claimPairing(req.body);
    await logActivity({ actorId: req.auth!.userId, action: 'SCREEN_REGISTER', entityType: 'Screen', entityId: screen.id, metadata: { screenKey: screen.screenKey } });
    res.status(201).json(screen);
  }),
);

// Admin: edit, handlers, enable/disable, revoke
screensRouter.patch(
  '/:screenId',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  validateBody(updateScreenSchema),
  asyncHandler(async (req, res) => res.json(await screens.updateScreen(req.params.screenId, req.body))),
);
screensRouter.post(
  '/:screenId/handlers',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  validateBody(assignHandlersSchema),
  asyncHandler(async (req, res) =>
    res.json(await screens.assignHandlers(req.params.screenId, req.body.handlerIds)),
  ),
);
screensRouter.post(
  '/:screenId/disable',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  asyncHandler(async (req, res) => {
    const s = await screens.setScreenEnabled(req.params.screenId, false);
    await logActivity({ actorId: req.auth!.userId, action: 'SCREEN_DISABLE', entityType: 'Screen', entityId: req.params.screenId });
    res.json(s);
  }),
);
screensRouter.post(
  '/:screenId/enable',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  asyncHandler(async (req, res) => res.json(await screens.setScreenEnabled(req.params.screenId, true))),
);
screensRouter.post(
  '/:screenId/revoke-credential',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  asyncHandler(async (req, res) => {
    await screens.revokeDeviceCredential(req.params.screenId);
    await logActivity({ actorId: req.auth!.userId, action: 'DEVICE_REVOKE', entityType: 'Screen', entityId: req.params.screenId });
    res.json({ ok: true });
  }),
);

// Admin: permanently delete a screen (and its playlist/credential/history links)
screensRouter.delete(
  '/:screenId',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  asyncHandler(async (req, res) => {
    const result = await screens.deleteScreen(req.params.screenId);
    await logActivity({
      actorId: req.auth!.userId,
      action: 'SCREEN_DELETE',
      entityType: 'Screen',
      entityId: req.params.screenId,
      metadata: { screenKey: result.screenKey },
    });
    res.json({ ok: true });
  }),
);

// Admin: device commands (reload/sync/restart/resume)
screensRouter.post(
  '/:screenId/commands',
  requirePermission(PERMISSIONS.SEND_DEVICE_COMMANDS),
  requireScreenAccess('screenId'),
  validateBody(deviceCommandSchema),
  asyncHandler(async (req, res) => {
    const cmd = await issueCommand(req.params.screenId, req.body.command, req.auth!.userId);
    await logActivity({ actorId: req.auth!.userId, action: `CMD_${req.body.command}`, entityType: 'Screen', entityId: req.params.screenId });
    res.json({ ok: true, commandId: cmd.id });
  }),
);

// Admin: maintenance mode with optional timed duration
screensRouter.post(
  '/:screenId/maintenance',
  requirePermission(PERMISSIONS.MANAGE_MAINTENANCE),
  requireScreenAccess('screenId'),
  validateBody(maintenanceSchema),
  asyncHandler(async (req, res) => {
    const until =
      req.body.durationMinutes == null
        ? null
        : new Date(Date.now() + req.body.durationMinutes * 60_000);
    const cmd = await issueCommand(req.params.screenId, DEVICE_COMMAND.ENTER_MAINTENANCE, req.auth!.userId, {
      maintenanceUntil: until,
    });
    await logActivity({ actorId: req.auth!.userId, action: 'MAINTENANCE_ENTER', entityType: 'Screen', entityId: req.params.screenId, metadata: { until } });
    res.json({ ok: true, commandId: cmd.id, until });
  }),
);
screensRouter.post(
  '/:screenId/resume',
  requirePermission(PERMISSIONS.MANAGE_MAINTENANCE),
  requireScreenAccess('screenId'),
  asyncHandler(async (req, res) => {
    const cmd = await issueCommand(req.params.screenId, DEVICE_COMMAND.RESUME_DISPLAY, req.auth!.userId);
    await logActivity({ actorId: req.auth!.userId, action: 'MAINTENANCE_RESUME', entityType: 'Screen', entityId: req.params.screenId });
    res.json({ ok: true, commandId: cmd.id });
  }),
);

// Nested playlist routes: /screens/:screenId/playlist/...
screensRouter.use('/:screenId/playlist', playlistRouter);
