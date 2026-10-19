import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOrigins, type Env } from './config/env.js';
import { getPrisma } from './db/prisma.js';
import { createApp } from './http/app.js';
import { attachGateway, createTransport } from './realtime/gateway.js';
import type { GoogleAuth } from './modules/auth/google.js';
import { TokenService } from './modules/auth/token.js';
import {
  MemoryProgressRepository,
  PrismaProgressRepository,
  type ProgressRepository,
} from './modules/progress/progress.repository.js';
import { ProgressService } from './modules/progress/progress.service.js';
import {
  MemoryMatchRepository,
  PrismaMatchRepository,
  type MatchRepository,
} from './modules/matches/match.repository.js';
import {
  MemoryUserRepository,
  PrismaUserRepository,
  type UserRepository,
} from './modules/users/users.repository.js';
import {
  MemoryFriendsRepository,
  PrismaFriendsRepository,
  type FriendsRepository,
} from './modules/social/friends.repository.js';
import { Presence } from './modules/social/presence.js';
import {
  MemoryDailyRepository,
  PrismaDailyRepository,
  type DailyRepository,
} from './modules/daily/daily.repository.js';
import { DailyService } from './modules/daily/daily.service.js';
import { RoomManager } from './rooms/RoomManager.js';

export interface BuildOptions {
  friends?: FriendsRepository;
  progress?: ProgressRepository;
  users?: UserRepository | null;
  matches?: MatchRepository;
  google?: GoogleAuth;
}

/** Monta HTTP + Socket.IO. Separado de index.ts para ser usado nos testes. */
export function buildServer(env: Env, opts: BuildOptions = {}) {
  const prisma = env.DATABASE_URL && opts.users === undefined ? getPrisma(env.DATABASE_URL) : null;
  const users =
    opts.users !== undefined ? opts.users : prisma ? new PrismaUserRepository(prisma) : null;
  const matches =
    opts.matches ?? (prisma ? new PrismaMatchRepository(prisma) : new MemoryMatchRepository());
  const tokens = new TokenService(env.JWT_SECRET);
  // progresso (XP/conquistas) só existe com contas
  const progressRepo: ProgressRepository | null =
    opts.progress ??
    (prisma
      ? new PrismaProgressRepository(prisma)
      : users
        ? new MemoryProgressRepository(
            matches instanceof MemoryMatchRepository ? matches : undefined,
          )
        : null);
  const progress = progressRepo ? new ProgressService(progressRepo) : undefined;
  const presence = new Presence();
  const dailyRepo: DailyRepository = prisma
    ? new PrismaDailyRepository(prisma)
    : new MemoryDailyRepository((id) =>
        users instanceof MemoryUserRepository ? users.users.get(id) : undefined,
      );
  const daily = new DailyService(dailyRepo);
  const friends: FriendsRepository | undefined =
    opts.friends ??
    (prisma
      ? new PrismaFriendsRepository(prisma)
      : users instanceof MemoryUserRepository
        ? new MemoryFriendsRepository(() => [...users.users.values()])
        : undefined);

  // o app precisa existir antes do Socket.IO: ele intercepta /socket.io e repassa o resto ao Express
  const ref: { app?: ReturnType<typeof createApp> } = {};
  const httpServer = createServer((req, res) => ref.app!(req, res));
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins(env), credentials: true },
    maxHttpBufferSize: 32_000, // limita o tamanho de cada mensagem
    pingInterval: 10_000,
    pingTimeout: 8_000,
    connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
  });
  const rooms = new RoomManager(
    createTransport(io),
    matches,
    {
      idleTtlMs: env.ROOM_IDLE_TTL_MS,
      reconnectGraceMs: env.RECONNECT_GRACE_MS,
    },
    progress,
  );
  const app = (ref.app = createApp({
    env,
    tokens,
    users,
    matches,
    rooms,
    google: opts.google,
    progress,
    presence,
    friends,
    daily,
  }));
  attachGateway(io, rooms, tokens, presence);

  const close = async () => {
    rooms.shutdown();
    io.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
    await prisma?.$disconnect();
  };
  return { httpServer, io, rooms, tokens, app, close, progress, presence, friends };
}
