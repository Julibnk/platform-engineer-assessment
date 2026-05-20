import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@octane11/shared';

// Centralised error handler — never leaks SQL or stack traces to clients.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ code: err.code, message: err.message, field: err.field });
    return;
  }

  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
