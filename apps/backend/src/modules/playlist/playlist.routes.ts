import { Router } from 'express';
import {
  addPlaylistItemSchema,
  replacePlaylistItemSchema,
  updateItemDurationSchema,
  reorderPlaylistSchema,
  publishToSchema,
  PERMISSIONS,
  WS,
} from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { requireScreenAccess } from '../../middleware/screenAccess.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as playlist from './playlist.service.js';
import { wsHub } from '../../ws/hub.js';
import { logActivity } from '../activity/activity.service.js';

// mergeParams so :screenId from parent mount is available
export const playlistRouter = Router({ mergeParams: true });
playlistRouter.use(requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), requireScreenAccess('screenId'));

playlistRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json(await playlist.getEditorPlaylist(req.params.screenId))),
);

playlistRouter.get(
  '/live',
  asyncHandler(async (req, res) => res.json(await playlist.getLivePlaylist(req.params.screenId))),
);

// Preview uses the live-shaped DTO of the current DRAFT (what Publish would make live)
playlistRouter.get(
  '/preview',
  asyncHandler(async (req, res) => res.json(await playlist.getEditorPlaylist(req.params.screenId))),
);

playlistRouter.post(
  '/items',
  validateBody(addPlaylistItemSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await playlist.addItem(req.params.screenId, req.body));
  }),
);

playlistRouter.put(
  '/items/:itemId/replace',
  validateBody(replacePlaylistItemSchema),
  asyncHandler(async (req, res) => {
    res.json(await playlist.replaceItem(req.params.screenId, req.params.itemId, req.body));
  }),
);

playlistRouter.put(
  '/items/:itemId/duration',
  validateBody(updateItemDurationSchema),
  asyncHandler(async (req, res) => {
    res.json(await playlist.updateItemDuration(req.params.screenId, req.params.itemId, req.body.durationSec));
  }),
);

playlistRouter.delete(
  '/items/:itemId',
  asyncHandler(async (req, res) => {
    res.json(await playlist.removeItem(req.params.screenId, req.params.itemId));
  }),
);

playlistRouter.post(
  '/reorder',
  validateBody(reorderPlaylistSchema),
  asyncHandler(async (req, res) => {
    res.json(await playlist.reorder(req.params.screenId, req.body.itemIds));
  }),
);

// PUBLISH — draft becomes live, then broadcast so screens update with no refresh.
playlistRouter.post(
  '/publish',
  asyncHandler(async (req, res) => {
    const { version } = await playlist.publish(req.params.screenId);
    wsHub.broadcastToScreen(req.params.screenId, {
      event: WS.PLAYLIST_UPDATED,
      playlistVersion: version,
      data: { screenId: req.params.screenId, playlistVersion: version, urgent: false },
    });
    wsHub.broadcastToDashboard({
      event: WS.PLAYLIST_UPDATED,
      data: { screenId: req.params.screenId, playlistVersion: version },
    });
    await logActivity({
      actorId: req.auth!.userId,
      action: 'PLAYLIST_PUBLISH',
      entityType: 'Screen',
      entityId: req.params.screenId,
      metadata: { version },
    });
    res.json({ ok: true, version });
  }),
);

// PUBLISH TO — copy this screen's playlist to multiple screens / groups and publish each.
playlistRouter.post(
  '/publish-to',
  validateBody(publishToSchema),
  asyncHandler(async (req, res) => {
    const { results, skipped } = await playlist.publishToScreens(
      { userId: req.auth!.userId, role: req.auth!.role },
      req.params.screenId,
      req.body,
    );
    // Notify every target screen + the dashboard.
    for (const r of results) {
      wsHub.broadcastToScreen(r.screenId, {
        event: WS.PLAYLIST_UPDATED,
        playlistVersion: r.version,
        data: { screenId: r.screenId, playlistVersion: r.version, urgent: false },
      });
      wsHub.broadcastToDashboard({
        event: WS.PLAYLIST_UPDATED,
        data: { screenId: r.screenId, playlistVersion: r.version },
      });
    }
    await logActivity({
      actorId: req.auth!.userId,
      action: 'PLAYLIST_PUBLISH_MULTI',
      entityType: 'Screen',
      entityId: req.params.screenId,
      metadata: { targets: results.map((r) => r.screenKey), skipped },
    });
    res.json({ ok: true, published: results.length, skipped, results });
  }),
);
