import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashDeviceToken } from '../lib/tokens.js';
import { Unauthorized, Forbidden } from '../lib/errors.js';
import { asyncHandler } from './asyncHandler.js';

/**
 * Authenticates a display device using its opaque device token
 * (Authorization: Device <token>). No management-user login is involved.
 * Revoked credentials and disabled screens are rejected.
 */
export const requireDevice = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Device ') ? header.slice(7) : (req.headers['x-device-token'] as string);
    if (!token) throw Unauthorized('Missing device token');

    const cred = await prisma.deviceCredential.findUnique({
      where: { tokenHash: hashDeviceToken(token) },
      include: { screen: true },
    });
    if (!cred) throw Unauthorized('Invalid device token');
    if (cred.revokedAt) throw Forbidden('DEVICE_REVOKED');
    if (cred.screen.status === 'DISABLED') throw Forbidden('DEVICE_DISABLED');

    req.device = {
      screenId: cred.screenId,
      screenKey: cred.screen.screenKey,
      credentialId: cred.id,
    };
    next();
  },
);
