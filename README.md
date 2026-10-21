# PartyVerse

Plataforma web de minijogos multiplayer em tempo real. **Versão 0.6:** página inicial, contas e convidados, salas (criar, entrar por código ou link, lobby, chat, moderação, reconexão) e nove jogos completos: **Adedonha (STOP)**, **Rabisco** (desenhe e adivinhe), **Mímica**, **Palavra Secreta**, **Quiz Relâmpago**, **Impostor**, **Quem é Mais Provável**, **Verdade ou Desafio** e **Duas Verdades e Uma Mentira**. Efeitos sonoros e animações com preferências que funcionam.

> **Publicar na Hostinger:** veja [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md).

## Novidades da 0.7 (em andamento)

- **IA nas salas** (com `OPENROUTER_API_KEY`): o anfitrião escreve um tema e a IA cria perguntas do Quiz, palavras do Rabisco/Mímica/Palavra Secreta, locais do Impostor e frases de Quem é Mais Provável e Verdade ou Desafio. Ninguém vê as respostas antes.
- **Juiz IA na Adedonha**: marca respostas suspeitas na revisão (vale como um voto; a turma decide).
- **Narrador com IA**: um comentário divertido no chat quando a partida acaba (dá para desligar na sala).
- **Filtro de palavrões** no chat (ligado por padrão), em nomes de sala e apelidos.
- **Denunciar jogador** (na lista da sala ou no perfil), com as últimas mensagens anexadas; denúncias aparecem no **/admin**.
- **Termo do dia** no `/desafio`: a palavra de 5 letras em 6 tentativas, teclado na tela, resultado para compartilhar e ranking do dia.
- **Telefone Sem Fio** desenhado (escreve → desenha → descreve, revelação com curtidas) e **Espiões** (dois times, mestres com a chave, dica de uma palavra, assassino).
- **Forca** (em turnos, dá para jogar sozinho; palavras por tema, suas ou da IA), **Jogo da Velha** (melhor de N) e **Damas** com regras brasileiras (captura obrigatória, lei da maioria, dama voadora).
- **Moedas e loja** (`/loja`): moedas por partida, desafio do dia e torneio; molduras de avatar, cores de nome e títulos (só visual, sem dinheiro de verdade).
- **Torneio da semana** (aba no `/ranking`): de segunda a domingo; os 3 primeiros ganham moedas e itens exclusivos.
- **Clãs** (`/clas`): crie ou entre num clã com tag, veja o ranking dos clãs e a etiqueta do clã no perfil.
- **Compartilhar desenho** do Rabisco e do Telefone Sem Fio (baixar imagem ou enviar pelo WhatsApp).

## Novidades da 0.6.1

- **Desafio do dia com IA** (OpenRouter, `OPENROUTER_API_KEY`): perguntas e categorias novas todo dia, guardadas no banco (iguais para todos, mesmo se o servidor reiniciar), sem repetir as dos dias anteriores.
- **Banco reserva exclusivo do desafio** (148 perguntas que não aparecem no Quiz normal + 48 categorias de Adedonha), em rodízio sem repetição, usado quando não há IA.

## Novidades da 0.6

- **3 jogos novos**: Quem é Mais Provável, Verdade ou Desafio (versão leve, a turma vota se valeu) e Duas Verdades e Uma Mentira.
- **Temas personalizados**: palavras próprias (Rabisco, Mímica, Palavra Secreta), perguntas próprias no Quiz (`pergunta | certa | errada | errada | errada`) e frases/verdades/desafios próprios. As listas não são enviadas aos outros jogadores.
- **Mais conteúdo**: perguntas e palavras de anime, games, música brasileira e futebol.
- **Desafio do dia** (`/desafio`): Quiz e Adedonha iguais para todos no dia, uma tentativa, ranking diário, sequência de dias e XP.
- **Níveis, XP e conquistas**: 15 medalhas, itens de avatar liberados por nível, **perfil público** (`/jogador/:id`) e **ranking por temporada** (mês).
- **Amigos** (`/amigos`): pedidos de amizade, quem está online e em qual sala, **convite em tempo real** para a sua sala.
- **Reações rápidas** (emojis voando), **modo espectador** (sala cheia entra assistindo; botão "Só assistir") e **botão de WhatsApp** com prévia do link (imagem e título).
- **Instalar como app** (PWA), **tema claro**, **recuperar senha por e-mail** e **painel de administração** (`/admin`: números do site, fechar salas, suspender contas).

## Novidades da 0.5

- **Placar ao vivo animado** durante a partida: posições trocam com animação, "+pontos" sobe ao lado de quem pontuou, medalhas e coroa no líder.
- **Pódio animado** no fim da partida (blocos sobem, avatares caem no lugar, coroa no campeão) e lista dos demais colocados.
- **Login com Google** (OAuth no servidor; liga à conta existente do mesmo e-mail). Ativa com `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `PUBLIC_URL`.
- **Cadastro que não trava**: se o banco estiver fora do ar a resposta é imediata e clara; nenhuma operação de conta passa de 12 s; o servidor tenta reconectar ao banco a cada minuto. A tela de conta ganhou aviso de status, validação em tempo real, mostrar senha, medidor de força, avatar no cadastro e mensagens de progresso.

## Novidades da 0.4

- **Novas páginas**: `/jogos` (catálogo), `/jogos/:jogo` (regras, pontuação, dicas e salas abertas de cada jogo), `/salas` (salas públicas com filtro), `/ranking` (vitórias e pontos de contas registradas, geral e por jogo) e `/ajuda` (primeiros passos e perguntas frequentes). Menu no topo, menu para celular e links no rodapé; cada página tem seu título.
- **Publicação automática**: o site na Hostinger fica ligado a este repositório; cada envio para a `main` publica sozinho (veja DEPLOY-HOSTINGER.md).

## Novidades da 0.3

- **Rabisco**: quadro de desenho em tempo real com lápis, borracha, balde de tinta, linha, retângulo, círculo (contorno ou cheio), 16 cores, 4 espessuras, desfazer e limpar. Escolha entre 3 palavras, letras reveladas aos poucos, aviso de "quase!", pontos por rapidez e ordem.
- **Mímica** e **Palavra Secreta**: mesmo motor de palpites no chat; na Palavra Secreta quem sabe a palavra manda dicas curtas (que não podem conter a palavra) e cada dica extra vale menos.
- Quem já acertou só conversa com quem também sabe a resposta (a palavra não vaza). Palpite rápido dentro do jogo (bom no celular).
- **Adedonha**: validação categoria por categoria com respostas iguais agrupadas e botão "Denunciar".
- **Salas com até 50 pessoas** e **senha** (definida ao criar ou no lobby; quem reconecta não precisa digitar de novo).
- **Figurinhas no chat** (12 desenhos originais) e **criador de avatar** (cabelo, olhos, boca, acessório, pele, cor do cabelo e fundo).

## Novidades da 0.2

- **Impostor**: todos recebem o mesmo local secreto (com um papel), menos o impostor. Discussão, pedido de votação por maioria, votação secreta, chute do local pelo impostor, 30 locais. Ninguém recebe a carta dos outros (testado).
- **Quiz Relâmpago**: 120 perguntas em 6 temas (ou misto), pontos por velocidade (500–1000) e bônus de sequência. A resposta certa nunca vai para o navegador antes da revelação (testado).
- **Troca de jogo no lobby** pelo anfitrião.
- **Sons** sintetizados (Web Audio, sem arquivos): contagem, acerto/erro, STOP, vitória, chat. Botão de som no topo.
- **Preferências funcionando**: "som" e "reduzir animações" valem para convidados (salvas no navegador) e contas (salvas no servidor). Confete para o vencedor.
- **Cronômetro corrigido** para aparelhos com relógio adiantado/atrasado (o servidor envia a hora dele).
- **Produção mais simples**: `server.js` na raiz, migrations aplicadas automaticamente ao iniciar (sem depender da CLI do Prisma), caminho do front independente da pasta de execução, `prisma generate` não exige mais `DATABASE_URL`.

## Arquitetura

```
 Navegador (React + Vite + Tailwind)
   │  HTTP /api (REST, cookie httpOnly)      Socket.IO (mesmo cookie)
   ▼                                          ▼
 Express ──────────── server.ts ──────────── Gateway Socket.IO
   │ auth, perfil, histórico                  │ rate limit + Zod + ack padronizado
   ▼                                          ▼
 Repositórios (Prisma 7 + PostgreSQL)      RoomManager ── Room ── GameModule (STOP, …)
   ▲                                          │  presença, anfitrião, timers, visão por jogador
   └──────────── resultado da partida ────────┘
```

**Decisões principais**

- **Monorepo npm workspaces**: `packages/shared` (schemas Zod, tipos, nomes de eventos) é usado pelo servidor e pelo cliente, então o contrato é um só.
- **Servidor autoritativo**: o cliente só envia *intenções* (`answers`, `stop`, `vote`, `ready`). Letra, prazos, votos, pontuação e fim de partida são decididos no servidor. Não existe ação de "pontuação" — testado.
- **Visão por jogador**: cada `GameModule` implementa `viewFor(state, playerId)`. No STOP, respostas alheias só são enviadas na fase de revisão — testado.
- **Contrato de minijogo** (`apps/server/src/games/GameModule.ts`): `createInitialState`, `startRound`, `validateAction`, `processAction`, `advancePhase`, `calculateScores`, `determineWinners`, `finalize`, `viewFor`, `onPlayerLeft`, `onChat` (para jogos de palpite). A sala não conhece regras de jogo; adicionar um jogo = novo módulo + registro em `registry.ts` + tela no front.
- **Autenticação**: JWT HS256 em cookie `httpOnly; SameSite=Lax` (`secure` em produção). Convidado recebe o mesmo tipo de token com id `g_…`, sem ir ao banco. Senhas com bcrypt (custo 12).
- **Salas em memória** (`RoomManager`). Redis está no Docker Compose mas **ainda não é usado**: para várias instâncias será preciso o adaptador Redis do Socket.IO e mover o estado das salas (ver pendências).
- **Persistência mínima**: só partidas concluídas, participantes e estatísticas agregadas. Nenhum movimento em tempo real é gravado.
- **Prisma 7** com driver adapter `pg` (sem engine binária no runtime).

### Regras de sala

| Situação | Comportamento |
|---|---|
| Código | 6 caracteres sem 0/O/1/I, único entre salas ativas |
| Sala cheia / código inválido / inexistente | erro `ROOM_FULL` / `VALIDATION` / `NOT_FOUND` |
| Mesma conta em duas abas | a conexão mais nova assume; a antiga recebe aviso |
| Queda de conexão | jogador fica "reconectando" por `RECONNECT_GRACE_MS` (60 s); ao voltar recebe chat, estado do jogo e suas respostas |
| Anfitrião sai ou não volta | liderança passa ao jogador online mais antigo |
| Expulsão | só o anfitrião; o expulso fica banido daquela sala |
| Partida com menos de 2 participantes | é encerrada e o resultado é registrado |
| Sala inativa | removida após `ROOM_IDLE_TTL_MS` (30 min) sem ninguém online; sala vazia some na hora |
| Quem entra durante a partida | assiste e joga a próxima |

### STOP / Adedonha

Fases: `answering` → (STOP) `stopping` → `review` → `round-results` → próxima rodada ou `finished`.

- Letra sorteada sem repetição na partida (exclui K, Q, W, X, Y, Z).
- STOP só é aceito com todas as categorias preenchidas com a letra.
- Revisão: cada jogador pode contestar respostas alheias; é rejeitada com maioria estrita dos demais jogadores online. Votos são um conjunto (repetir não soma).
- Pontuação configurável: única, repetida, vazia/fora da letra, contestada. Comparação ignora acentos, caixa e espaços.
- Configuráveis pelo anfitrião: categorias (2–10, sugeridas ou próprias), rodadas, tempo da rodada, tempo de revisão, contagem após STOP.
- Ações com `actionId` repetido são ignoradas (idempotência).

## Estrutura

```
partyverse/
├─ docker-compose.yml        Postgres 16 + Redis 7 (dev)
├─ Dockerfile                build de produção (um container)
├─ .env.example
├─ e2e/smoke.py              teste ponta a ponta com 2 navegadores (Playwright)
├─ packages/shared/src/      schemas.ts (Zod), types.ts (tipos, catálogo, EVENTS)
├─ apps/server/
│  ├─ prisma/                schema.prisma, migrations/, seed.ts
│  ├─ prisma.config.ts
│  ├─ src/
│  │  ├─ config/env.ts       validação das variáveis de ambiente
│  │  ├─ lib/                erros, logger (com redaction), rate limiter, ids, texto
│  │  ├─ db/prisma.ts
│  │  ├─ modules/auth/       token (JWT), serviço de auth
│  │  ├─ modules/users/      repositório (Prisma e memória)
│  │  ├─ modules/matches/    repositório de partidas e histórico
│  │  ├─ rooms/              Room (presença, anfitrião, orquestração), RoomManager
│  │  ├─ games/              GameModule (contrato), registry, stop/
│  │  ├─ realtime/gateway.ts eventos Socket.IO
│  │  ├─ http/app.ts         rotas REST, CORS, helmet, erros centralizados
│  │  ├─ server.ts           monta HTTP + Socket.IO (usado também nos testes)
│  │  └─ index.ts
│  └─ test/                  unitários e integração (HTTP + sockets reais)
└─ apps/web/src/
   ├─ lib/                   api, socket, sessão, useRoom (conexão/reconexão), countdown
   ├─ components/            Button, Avatar, Chat, PlayerList, Toast, Layout…
   ├─ games/stop/            tela do jogo e formulário de regras
   └─ pages/                 Home, Auth, Profile, RoomPage (lobby/jogo/resultado), 404
```

## Rodando localmente

Requisitos: Node 20+ (testado com 22), Docker.

```bash
docker compose up -d                       # Postgres e Redis
cp .env.example apps/server/.env           # e troque JWT_SECRET
npm install                                # também gera o Prisma Client
npm run db:migrate                         # aplica migrations
npm run db:seed                            # contas ana@ / bruno@partyverse.dev, senha partyverse123
npm run dev                                # API :3001 + web :5173
```

Abra http://localhost:5173. Para testar multiplayer sozinho, use uma janela normal e uma anônima (ou outro navegador/celular na mesma rede com `npx vite --host`).

Sem `DATABASE_URL` o servidor sobe mesmo assim: convidados e jogo funcionam; cadastro/login respondem 503.

## Testes e qualidade

```bash
npm test            # Vitest: 71 testes (regras/pontuação STOP, HTTP, salas e partida via sockets reais)
npm run typecheck
npm run lint
npm run format
# ponta a ponta (com npm run dev rodando; requer `pip install playwright && playwright install chromium`)
python3 e2e/smoke.py
```

O que os testes cobrem: pontuação (única/repetida/vazia/fora da letra/contestada, pontos configuráveis); ciclo do STOP (timer, STOP inválido, votos, rodadas, fim); autenticação de sockets; criação/entrada; código inválido; sala cheia; segunda aba; isolamento de chat entre salas; ações sem estar na sala; permissões do anfitrião; expulsão + banimento; troca de anfitrião; reconexão (lobby e no meio da partida); remoção após o prazo; rate limit; partida completa sem vazar respostas, com deduplicação e resultado salvo; HTTP (convidado, cadastro, login, perfil, 401, 404); transporte por long-polling.

## Produção

```bash
npm run build                                     # shared → prisma generate → server → web
DATABASE_URL=... JWT_SECRET=... CORS_ORIGINS=https://seu.dominio npm start   # = node server.js
```

As migrations são aplicadas ao iniciar (`AUTO_MIGRATE=true`, padrão).

Em produção o Express também serve `apps/web/dist` (SPA), então um único processo atende site, API e WebSocket. Alternativa: `docker build -t partyverse . && docker run -p 3001:3001 --env-file apps/server/.env partyverse`.

Atrás de proxy (Nginx, Caddy, Render, Fly…): habilite upgrade de WebSocket e HTTPS (o cookie fica `secure`). **Rode uma instância só** até o Redis ser integrado, ou use sticky sessions sabendo que salas não são compartilhadas entre instâncias.

## Estado do projeto

**Implementado e verificado** (testes automatizados + partida real com dois navegadores, em dev e no build de produção, com Postgres):

- Página inicial com catálogo, contador de jogadores online, salas públicas, criar sala, entrar por código
- Cadastro, login, logout, convidado; perfil com avatar, apelido, estatísticas, preferências; histórico de partidas
- Salas públicas/privadas, link de convite, lobby com configurações, chat em tempo real, presença (online/reconectando), expulsar, transferir liderança, encerrar partida, jogar novamente, voltar ao lobby
- STOP completo como descrito acima; tela de resultados por categoria e ranking final
- Reconexão automática com banner, tela de erro/404, avisos (toasts)
- Segurança: Zod em todas as entradas, rate limit (HTTP de auth e por evento de socket), limite de tamanho de mensagem (16 kB HTTP / 32 kB socket), CORS explícito, helmet, cookie httpOnly, logs com redaction, sem HTML vindo do usuário (React escapa)

**Ainda falta**

- Jogos: Desenho e adivinhação, Mímica, Palavra Secreta (o contrato já prevê `onChat` para palpites)
- Redis: adaptador Socket.IO e estado de salas compartilhado para escalar horizontalmente
- Tema claro não existe
- Registro de moderação: a tabela existe, mas expulsões ainda não são gravadas nela
- Recuperação de senha, verificação de e-mail
- Testes de componentes do front-end (o front é coberto só pelo teste ponta a ponta)
- A migration inicial foi escrita à mão e validada aplicando-a no PostgreSQL 16 (o ambiente onde foi construída não permitia baixar o motor de migração do Prisma). Ao rodar `npm run db:migrate` num banco vazio, se o Prisma propuser uma nova migration, há divergência a revisar.
