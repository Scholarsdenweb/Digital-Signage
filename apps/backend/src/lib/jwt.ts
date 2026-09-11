import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import type { RoleName } from '@dsm/shared';

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  role: RoleName;
  type: 'access';
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'type'>): string {
  return jwt.sign({ ...claims, type: 'access' }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.jwt.accessSecret) as AccessTokenClaims;
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign({ sub: userId, jti, type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  const decoded = jwt.verify(token, env.jwt.refreshSecret) as {
    sub: string;
    jti: string;
    type: string;
  };
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return { sub: decoded.sub, jti: decoded.jti };
}
