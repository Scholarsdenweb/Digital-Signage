import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequest } from '../lib/errors.js';

/** Validates & replaces req.body with the parsed result. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(BadRequest('Validation failed', result.error.flatten()));
    req.body = result.data as T;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(BadRequest('Invalid query', result.error.flatten()));
    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}
