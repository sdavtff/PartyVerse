/* global process, console */
/**
 * Ponto de entrada de produção (use este arquivo como "Entry file" na Hostinger).
 * Antes rode `npm run build`. Variáveis de ambiente: veja .env.example.
 *
 * Sem top-level await de propósito: alguns gerenciadores de processo carregam o entry
 * com require(), e isso falha com await no topo do arquivo.
 */
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
import('./apps/server/dist/index.js').catch((err) => {
  console.error(
    '[PartyVerse] não foi possível iniciar. O build (npm run build) foi executado?',
    err,
  );
  process.exit(1);
});
