import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  ROOM_IDLE_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60_000),
  RECONNECT_GRACE_MS: z.coerce.number().int().positive().default(60_000),
  WEB_DIST_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(overrides: Partial<Record<keyof Env, unknown>> = {}): Env {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    throw new Error(
      'Configuração inválida: ' +
        parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join('; '),
    );
  }
  return parsed.data;
}

export const corsOrigins = (env: Env) =>
  env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
