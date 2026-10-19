import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { logger } from '../lib/logger.js';
import { pgConfig } from './pgconfig.js';

/** Pasta prisma/migrations (funciona tanto de src/ quanto de dist/). */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations', import.meta.url));

/**
 * Aplica as migrations pendentes direto pelo driver `pg`, sem depender da CLI do Prisma
 * (que baixa binários e nem sempre está disponível em hospedagens gerenciadas).
 * Usa a mesma tabela `_prisma_migrations` do Prisma, então `prisma migrate` continua funcionando.
 */
export async function runMigrations(databaseUrl: string, dir = MIGRATIONS_DIR): Promise<string[]> {
  if (!existsSync(dir)) {
    logger.warn({ dir }, 'pasta de migrations não encontrada; pulando');
    return [];
  }
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, 'migration.sql')))
    .map((d) => d.name)
    .sort();

  const client = new pg.Client(pgConfig(databaseUrl));
  await client.connect();
  const applied: string[] = [];
  try {
    // trava para duas instâncias não migrarem ao mesmo tempo
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);
    const done = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    const doneSet = new Set(done.rows.map((r) => r.migration_name));

    for (const name of names) {
      if (doneSet.has(name)) continue;
      const sql = readFileSync(path.join(dir, name, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const id = randomUUID();
      logger.info({ migration: name }, 'aplicando migration');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, finished_at, migration_name, applied_steps_count, started_at)
           VALUES ($1, $2, now(), $3, 1, now())`,
          [id, checksum, name],
        );
        await client.query('COMMIT');
        applied.push(name);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migration ${name}: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => undefined);
    await client.end();
  }
  return applied;
}
