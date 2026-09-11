export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (m: string, details?: unknown) => new AppError(400, m, 'BAD_REQUEST', details);
export const Unauthorized = (m = 'Unauthorized') => new AppError(401, m, 'UNAUTHORIZED');
export const Forbidden = (m = 'Forbidden') => new AppError(403, m, 'FORBIDDEN');
export const NotFound = (m = 'Not found') => new AppError(404, m, 'NOT_FOUND');
export const Conflict = (m: string) => new AppError(409, m, 'CONFLICT');
export const Gone = (m: string) => new AppError(410, m, 'GONE');
