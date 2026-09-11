import { Router } from 'express';
import { createContentSchema, updateContentSchema, PERMISSIONS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { WS } from '@dsm/shared';
import * as content from './content.service.js';
import { logActivity } from '../activity/activity.service.js';
import { wsHub } from '../../ws/hub.js';

export const contentRouter = Router();
contentRouter.use(requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT));

contentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await content.listContent(
      { userId: req.auth!.userId, role: req.auth!.role },
      { type: req.query.type as never, status: req.query.status as string },
    );
    res.json(items);
  }),
);

contentRouter.post(
  '/',
  uploadLimiter,
  upload.single('file'),
  validateBody(createContentSchema),
  asyncHandler(async (req, res) => {
    const hints = {
      width: req.body.width ? Number(req.body.width) : undefined,
      height: req.body.height ? Number(req.body.height) : undefined,
      durationSec: req.body.durationSec ? Number(req.body.durationSec) : undefined,
    };
    const dto = await content.uploadContent(
      { userId: req.auth!.userId, role: req.auth!.role },
      req.file,
      req.body,
      hints,
    );
    await logActivity({
      actorId: req.auth!.userId,
      action: 'CONTENT_UPLOAD',
      entityType: 'Content',
      entityId: dto.id,
      metadata: { type: dto.type, title: dto.title },
    });
    res.status(201).json(dto);
  }),
);

contentRouter.patch(
  '/:id',
  validateBody(updateContentSchema),
  asyncHandler(async (req, res) => {
    const dto = await content.updateContent(
      { userId: req.auth!.userId, role: req.auth!.role },
      req.params.id,
      req.body,
    );
    // If this content is live anywhere, tell those screens to re-sync so changes
    // (e.g. display fit / duration) apply without needing a re-publish.
    const screenIds = await content.liveScreenIdsForContent(dto.id);
    for (const screenId of screenIds) {
      wsHub.broadcastToScreen(screenId, { event: WS.SYNC_CONTENT, data: { screenId } });
    }
    res.json(dto);
  }),
);

contentRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await content.deleteContent({ userId: req.auth!.userId, role: req.auth!.role }, req.params.id);
    await logActivity({ actorId: req.auth!.userId, action: 'CONTENT_DELETE', entityType: 'Content', entityId: req.params.id });
    res.json({ ok: true });
  }),
);
