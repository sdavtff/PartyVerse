import { loadEnv } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { explainDbError, setDbState } from './db/status.js';
import { logger } from './lib/logger.js';
import { buildServer } from './server.js';

let env: ReturnType<typeof loadEnv>;
try {
  env = loadEnv();
} catch (err) {
  console.error('[PartyVerse] ' + (err as Error).message);
  process.exit(1);
}

/** Mostra só host/porta/banco do endereço (nunca a senha). */
function describeDb(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return 'endereço inválido (confira se começa com postgresql://)';
  }
}

// Escuta IMEDIATAMENTE: hospedagens como a Hostinger derrubam o app se listen() demorar.
// O banco é preparado em segundo plano logo depois.
const { httpServer, close } = buildServer(env);
httpServer.listen(env.PORT, () => {
  console.log(`[PartyVerse] ouvindo na porta ${env.PORT} (${env.NODE_ENV})`);
  if (!env.DATABASE_URL)
    console.warn(
      '[PartyVerse] DATABASE_URL ausente: contas e histórico desativados (só convidados).',
    );
  else if (env.AUTO_MIGRATE) void prepareDatabase(env.DATABASE_URL);
  else setDbState('ok');
});

async function prepareDatabase(url: string) {
  if (/^https?:\/\//i.test(url)) {
    // erro comum: colar a URL da API do Supabase; não adianta nem tentar conectar
    const hint = explainDbError('', undefined, url);
    console.error(`[PartyVerse] ERRO no banco: ${hint}`);
    setDbState('error', 'DATABASE_URL com https://', hint);
    return;
  }
  console.log(`[PartyVerse] conectando ao banco em ${describeDb(url)}…`);
  setDbState('connecting');
  try {
    const applied = await runMigrations(url);
    setDbState('ok');
    console.log(
      applied.length
        ? `[PartyVerse] banco pronto (tabelas criadas: ${applied.join(', ')})`
        : '[PartyVerse] banco pronto',
    );
  } catch (err) {
    const e = err as Error & { code?: string };
    console.error(
      `[PartyVerse] ERRO no banco (${describeDb(url)}): ${e.message}${e.code ? ` [${e.code}]` : ''}`,
    );
    console.error(
      '[PartyVerse] O jogo continua funcionando para convidados. Confira DATABASE_URL.',
    );
    logger.debug({ err: String(err) }, 'detalhe do erro do banco');
    const hint = explainDbError(e.message, e.code, url);
    console.error(`[PartyVerse] DICA: ${hint}`);
    setDbState('error', e.message, hint);
    // tenta de novo daqui a 1 minuto (o banco pode só ter demorado a acordar)
    setTimeout(() => void prepareDatabase(url), 60_000).unref();
  }
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await close();
    process.exit(0);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[PartyVerse] erro não tratado:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[PartyVerse] promessa rejeitada:', err);
});
