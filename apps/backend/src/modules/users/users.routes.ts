import { Router } from 'express';
import { createUserSchema, updateUserSchema, PERMISSIONS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as users from './users.service.js';
import { logActivity } from '../activity/activity.service.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Handlers list is needed by admins when assigning screens.
usersRouter.get(
  '/handlers',
  requirePermission(PERMISSIONS.MANAGE_SCREENS),
  asyncHandler(async (_req, res) => res.json(await users.listHandlers())),
);

usersRouter.use(requirePermission(PERMISSIONS.MANAGE_USERS));

usersRouter.get('/', asyncHandler(async (_req, res) => res.json(await users.listUsers())));

usersRouter.post(
  '/',
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await users.createUser(req.body);
    await logActivity({ actorId: req.auth!.userId, action: 'USER_CREATE', entityType: 'User', entityId: user.id });
    res.status(201).json(user);
  }),
);

usersRouter.patch(
  '/:id',
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await users.updateUser(req.params.id, req.body);
    await logActivity({ actorId: req.auth!.userId, action: 'USER_UPDATE', entityType: 'User', entityId: user.id });
    res.json(user);
  }),
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await users.deleteUser(req.params.id);
    await logActivity({ actorId: req.auth!.userId, action: 'USER_DEACTIVATE', entityType: 'User', entityId: req.params.id });
    res.json({ ok: true });
  }),
);
