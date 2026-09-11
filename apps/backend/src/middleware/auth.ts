import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { Unauthorized } from '../lib/errors.js';

/** Requires a valid management-user access token. Populates req.auth. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(Unauthorized('Missing bearer token'));
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.auth = { userId: claims.sub, email: claims.email, role: claims.role };
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
}
