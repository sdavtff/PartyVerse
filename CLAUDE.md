# PartyVerse — instruções para quem for editar

- Site em produção: Hostinger (Node.js Web App) ligado a este repositório, branch `main`.
  Todo `git push` na `main` publica o site automaticamente.
- A versão compilada (`apps/*/dist`, `packages/shared/dist`) fica versionada: a Hostinger
  roda só `npm install` e inicia `server.cjs` (Build command vazio).
  **Sempre rode `npm run build` antes de commitar** e inclua as pastas dist no commit.
- Antes de publicar: `npm test`, `npm run typecheck`, `npm run lint`.
- No ambiente sem acesso a binaries.prisma.sh, gere o client com
  `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npm run build`.
- Textos e interface em português do Brasil.
