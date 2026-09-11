import { Router } from 'express';
import { loginSchema, refreshSchema } from '@dsm/shared';
import { validateBody } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import * as authService from './auth.service.js';
import { logActivity } from '../activity/activity.service.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    await logActivity({ actorId: result.user.id, action: 'AUTH_LOGIN', ip: req.ip });
    res.json(result);
  }),
);

authRouter.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    res.json(await authService.refresh(req.body.refreshToken));
  }),
);

authRouter.post(
  '/logout',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await authService.me(req.auth!.userId));
  }),
);
