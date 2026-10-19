import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // número da porta ou, em alguns servidores gerenciados (Passenger/LiteSpeed), o caminho de um socket
  PORT: z
    .string()
    .default('3001')
    .transform((v) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : v.trim())),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres').optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  ROOM_IDLE_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60_000),
  RECONNECT_GRACE_MS: z.coerce.number().int().positive().default(60_000),
  WEB_DIST_DIR: z.string().optional(),
  /** Login com Google (opcional): credenciais OAuth do Google Cloud */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Endereço público do site, ex.: https://meusite.com (usado no retorno do Google) */
  PUBLIC_URL: z.string().url().optional(),
  /** aplica as migrations do banco ao iniciar (padrão: sim) */
  AUTO_MIGRATE: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
});

export type Env = Omit<z.infer<typeof envSchema>, 'JWT_SECRET'> & { JWT_SECRET: string };

export function loadEnv(overrides: Partial<Record<keyof Env, unknown>> = {}): Env {
  // variáveis vazias (comuns em painéis de hospedagem) contam como não definidas
  const raw = Object.fromEntries(
    Object.entries({ ...process.env, ...overrides }).filter(([, v]) => v !== ''),
  );
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      'Configuração inválida: ' +
        parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join('; '),
    );
  }
  const data = parsed.data;
  let secret = data.JWT_SECRET;
  if (!secret) {
    if (data.NODE_ENV === 'production')
      console.warn(
        '[PartyVerse] JWT_SECRET não definido: usando um segredo temporário. ' +
          'Todos serão deslogados quando o servidor reiniciar. Defina JWT_SECRET nas variáveis de ambiente.',
      );
    secret = randomBytes(32).toString('hex');
  }
  return { ...data, JWT_SECRET: secret };
}

export const corsOrigins = (env: Env) =>
  env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
