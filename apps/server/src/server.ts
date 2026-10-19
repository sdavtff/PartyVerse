import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOrigins, type Env } from './config/env.js';
import { getPrisma } from './db/prisma.js';
import { createApp } from './http/app.js';
import { attachGateway, createTransport } from './realtime/gateway.js';
import type { GoogleAuth } from './modules/auth/google.js';
import { TokenService } from './modules/auth/token.js';
import {
  MemoryMatchRepository,
  PrismaMatchRepository,
  type MatchRepository,
} from './modules/matches/match.repository.js';
import { PrismaUserRepository, type UserRepository } from './modules/users/users.repository.js';
import { RoomManager } from './rooms/RoomManager.js';

export interface BuildOptions {
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
  const rooms = new RoomManager(createTransport(io), matches, {
    idleTtlMs: env.ROOM_IDLE_TTL_MS,
    reconnectGraceMs: env.RECONNECT_GRACE_MS,
  });
  const app = (ref.app = createApp({ env, tokens, users, matches, rooms, google: opts.google }));
  attachGateway(io, rooms, tokens);

  const close = async () => {
    rooms.shutdown();
    io.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
    await prisma?.$disconnect();
  };
  return { httpServer, io, rooms, tokens, app, close };
}
