import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  // nunca registrar segredos
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'passwordHash',
      '*.passwordHash',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
