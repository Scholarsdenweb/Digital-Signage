import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({ windowMs: 60_000, max: 60 });
