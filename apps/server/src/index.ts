import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { buildServer } from './server.js';

const env = loadEnv();
const { httpServer, close } = buildServer(env);

httpServer.listen(env.PORT, () => {
  logger.info(`PartyVerse ouvindo em http://localhost:${env.PORT}`);
  if (!env.DATABASE_URL)
    logger.warn('DATABASE_URL ausente: contas e histórico desativados (apenas convidados).');
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    logger.info('encerrando…');
    await close();
    process.exit(0);
  });
}
