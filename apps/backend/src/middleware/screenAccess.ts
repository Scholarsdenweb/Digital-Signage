import type { Request, Response, NextFunction } from 'express';
import { ROLES } from '@dsm/shared';
import { prisma } from '../lib/prisma.js';
import { Forbidden, NotFound, Unauthorized } from '../lib/errors.js';
import { asyncHandler } from './asyncHandler.js';

/**
 * Enforces screen-level authorization SERVER-SIDE.
 * Admin can access any screen; a handler can access only screens they are assigned to.
 * Reads the screen id from req.params[paramName].
 */
export function requireScreenAccess(paramName = 'screenId') {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw Unauthorized();
    const screenId = req.params[paramName];
    const screen = await prisma.screen.findUnique({ where: { id: screenId } });
    if (!screen) throw NotFound('Screen not found');

    if (req.auth.role === ROLES.ADMIN) return next();

    const assignment = await prisma.screenHandler.findUnique({
      where: { screenId_userId: { screenId, userId: req.auth.userId } },
    });
    if (!assignment) throw Forbidden('You are not assigned to this screen');
    next();
  });
}
