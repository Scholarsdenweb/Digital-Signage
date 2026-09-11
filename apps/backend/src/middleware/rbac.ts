import type { Request, Response, NextFunction } from 'express';
import { ROLES, can, type Permission, type RoleName } from '@dsm/shared';
import { Forbidden, Unauthorized } from '../lib/errors.js';

/** Require the authenticated user to hold a given permission. */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Unauthorized());
    if (!can(req.auth.role, permission)) return next(Forbidden('Insufficient permission'));
    next();
  };
}

export function requireRole(role: RoleName) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Unauthorized());
    if (req.auth.role !== role) return next(Forbidden(`Requires ${role} role`));
    next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN);
