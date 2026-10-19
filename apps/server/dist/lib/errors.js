import { ZodError } from 'zod';
export class AppError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
export const notFound = (msg) => new AppError('NOT_FOUND', msg, 404);
export const forbidden = (msg) => new AppError('FORBIDDEN', msg, 403);
export const invalidState = (msg) => new AppError('INVALID_STATE', msg, 409);
export function toServerError(err) {
    if (err instanceof AppError)
        return { code: err.code, message: err.message };
    if (err instanceof ZodError) {
        return { code: 'VALIDATION', message: err.issues[0]?.message ?? 'Dados inválidos' };
    }
    return { code: 'INTERNAL', message: 'Erro interno. Tente novamente.' };
}
export function statusOf(err) {
    if (err instanceof AppError)
        return err.status;
    if (err instanceof ZodError)
        return 400;
    return 500;
}
