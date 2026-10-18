import type { ServerError } from '@partyverse/shared';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public code: ServerError['code'],
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const notFound = (msg: string) => new AppError('NOT_FOUND', msg, 404);
export const forbidden = (msg: string) => new AppError('FORBIDDEN', msg, 403);
export const invalidState = (msg: string) => new AppError('INVALID_STATE', msg, 409);

export function toServerError(err: unknown): ServerError {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof ZodError) {
    return { code: 'VALIDATION', message: err.issues[0]?.message ?? 'Dados inválidos' };
  }
  return { code: 'INTERNAL', message: 'Erro interno. Tente novamente.' };
}

export function statusOf(err: unknown): number {
  if (err instanceof AppError) return err.status;
  if (err instanceof ZodError) return 400;
  return 500;
}
