/* global process, console */
// Alternativa em CommonJS ao server.js (Entry file: server.cjs), para hospedagens que usam require().
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
import('./apps/server/dist/index.js').catch((err) => {
  console.error(
    '[PartyVerse] não foi possível iniciar. O build (npm run build) foi executado?',
    err,
  );
  process.exit(1);
});
