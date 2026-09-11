import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as history from './history.service.js';
import { logActivity } from '../activity/activity.service.js';

export const historyRouter = Router();
historyRouter.use(requireAuth);

historyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await history.listHistory(
      { userId: req.auth!.userId, role: req.auth!.role },
      req.query.screenId as string | undefined,
    );
    res.json(items);
  }),
);

// "Restore to Library" — returns content to draft, never touches live playlists.
historyRouter.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const content = await history.restoreToLibrary(
      { userId: req.auth!.userId, role: req.auth!.role },
      req.params.id,
    );
    await logActivity({
      actorId: req.auth!.userId,
      action: 'HISTORY_RESTORE_TO_LIBRARY',
      entityType: 'Content',
      entityId: content.id,
    });
    res.json({ ok: true, content: { id: content.id, title: content.title, status: content.status } });
  }),
);
