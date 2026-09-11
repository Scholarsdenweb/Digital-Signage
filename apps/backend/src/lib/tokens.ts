import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { env } from '../env.js';

/** Opaque device token: shown to the device once, stored only as an HMAC. */
export function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashDeviceToken(token: string): string {
  return crypto.createHmac('sha256', env.deviceTokenSecret).update(token).digest('hex');
}

/** Random opaque token for refresh-token rotation, hashed at rest. */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Human-friendly pairing code (no ambiguous chars)
const pairingAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const generatePairingCode = customAlphabet(pairingAlphabet, 6);
