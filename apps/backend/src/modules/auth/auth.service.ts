import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { generateOpaqueToken, sha256 } from '../../lib/tokens.js';
import { Unauthorized } from '../../lib/errors.js';
import { permissionsFor, type RoleName } from '@dsm/shared';
import crypto from 'node:crypto';

function refreshExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.active) throw Unauthorized('Invalid credentials');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw Unauthorized('Invalid credentials');
  return issueSession(user.id, user.email, user.role.name as RoleName, user.name);
}

async function issueSession(userId: string, email: string, role: RoleName, name: string) {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: userId, email, role });
  const refreshRaw = signRefreshToken(userId, jti);
  // store an HMAC of the refresh jti+token for rotation/revocation
  const stored = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: { id: jti, userId, tokenHash: sha256(refreshRaw + stored), expiresAt: refreshExpiry() },
  });
  return {
    accessToken,
    refreshToken: `${refreshRaw}.${stored}`,
    user: { id: userId, email, name, role, permissions: permissionsFor(role) },
  };
}

export async function refresh(compositeToken: string) {
  const [refreshRaw, stored] = compositeToken.split('.');
  if (!refreshRaw || !stored) throw Unauthorized('Malformed refresh token');
  let decoded: { sub: string; jti: string };
  try {
    decoded = verifyRefreshToken(refreshRaw);
  } catch {
    // expired / malformed / wrong-secret token → clean 401 (not a 500)
    throw Unauthorized('Invalid refresh token');
  }
  const record = await prisma.refreshToken.findUnique({ where: { id: decoded.jti } });
  if (!record || record.revokedAt || record.expiresAt < new Date())
    throw Unauthorized('Refresh token expired or revoked');
  if (record.tokenHash !== sha256(refreshRaw + stored)) throw Unauthorized('Refresh token mismatch');

  const user = await prisma.user.findUnique({ where: { id: decoded.sub }, include: { role: true } });
  if (!user || !user.active) throw Unauthorized('User inactive');

  // rotate: revoke old, issue new
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return issueSession(user.id, user.email, user.role.name as RoleName, user.name);
}

export async function logout(compositeToken: string) {
  const [refreshRaw] = compositeToken.split('.');
  try {
    const decoded = verifyRefreshToken(refreshRaw);
    await prisma.refreshToken.updateMany({
      where: { id: decoded.jti },
      data: { revokedAt: new Date() },
    });
  } catch {
    /* ignore */
  }
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user) throw Unauthorized();
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    permissions: permissionsFor(user.role.name as RoleName),
  };
}
