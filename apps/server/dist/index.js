import { loadEnv } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { logger } from './lib/logger.js';
import { buildServer } from './server.js';
let env;
try {
    env = loadEnv();
}
catch (err) {
    console.error('[PartyVerse] ' + err.message);
    process.exit(1);
}
/** Mostra só host/porta/banco do endereço (nunca a senha). */
function describeDb(url) {
    try {
        const u = new URL(url);
        return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
    }
    catch {
        return 'endereço inválido (confira se começa com postgresql://)';
    }
}
// Escuta IMEDIATAMENTE: hospedagens como a Hostinger derrubam o app se listen() demorar.
// O banco é preparado em segundo plano logo depois.
const { httpServer, close } = buildServer(env);
httpServer.listen(env.PORT, () => {
    console.log(`[PartyVerse] ouvindo na porta ${env.PORT} (${env.NODE_ENV})`);
    if (!env.DATABASE_URL)
        console.warn('[PartyVerse] DATABASE_URL ausente: contas e histórico desativados (só convidados).');
    else if (env.AUTO_MIGRATE)
        void prepareDatabase(env.DATABASE_URL);
});
async function prepareDatabase(url) {
    console.log(`[PartyVerse] conectando ao banco em ${describeDb(url)}…`);
    try {
        const applied = await runMigrations(url);
        console.log(applied.length
            ? `[PartyVerse] banco pronto (tabelas criadas: ${applied.join(', ')})`
            : '[PartyVerse] banco pronto');
    }
    catch (err) {
        const e = err;
        console.error(`[PartyVerse] ERRO no banco (${describeDb(url)}): ${e.message}${e.code ? ` [${e.code}]` : ''}`);
        console.error('[PartyVerse] O jogo continua funcionando para convidados. Confira DATABASE_URL.');
        logger.debug({ err: String(err) }, 'detalhe do erro do banco');
    }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
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
