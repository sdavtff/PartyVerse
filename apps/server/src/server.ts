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
  MemoryChallengeStore,
  MemoryDailyRepository,
  PrismaChallengeStore,
  PrismaDailyRepository,
  type DailyRepository,
} from './modules/daily/daily.repository.js';
import { DailyService } from './modules/daily/daily.service.js';
import { AiService } from './modules/ai/ai.service.js';
import {
  MemoryAwardStore,
  PrismaAwardStore,
  TournamentService,
} from './modules/tournament/tournament.service.js';
import {
  MemoryClansRepository,
  PrismaClansRepository,
  type ClansRepository,
} from './modules/clans/clans.repository.js';
import {
  MemoryReportsRepository,
  PrismaReportsRepository,
  type ReportsRepository,
} from './modules/moderation/reports.repository.js';
import { BanList } from './modules/admin/bans.js';
import { SmtpMailer, type Mailer } from './modules/mail/mailer.js';
import {
  MemoryResetRepository,
  PrismaResetRepository,
  type ResetRepository,
} from './modules/auth/reset.repository.js';
import { RoomManager } from './rooms/RoomManager.js';
import {
  MemoryPushRepository,
  PrismaPushRepository,
  PushService,
  type PushSender,
} from './modules/push/push.service.js';
import { dayKey } from './modules/daily/daily.service.js';

export interface BuildOptions {
  /** para testes: substitui o fetch usado na geração por IA */
  aiFetch?: typeof fetch;
  mailer?: Mailer;
  friends?: FriendsRepository;
  progress?: ProgressRepository;
  users?: UserRepository | null;
  matches?: MatchRepository;
  google?: GoogleAuth;
  /** para testes: captura as notificações em vez de enviar */
  pushSender?: PushSender;
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
  const ai = new AiService({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    fetchFn: opts.aiFetch,
    referer: env.PUBLIC_URL,
    baseUrl: env.OPENROUTER_BASE_URL,
  });
  const tournament = new TournamentService(
    matches,
    prisma ? new PrismaAwardStore(prisma) : new MemoryAwardStore(),
    progress,
  );
  if (env.NODE_ENV !== 'test') tournament.start();
  const clans: ClansRepository = prisma
    ? new PrismaClansRepository(prisma)
    : new MemoryClansRepository((id) =>
        users instanceof MemoryUserRepository ? users.users.get(id) : undefined,
      );
  const reports: ReportsRepository = prisma
    ? new PrismaReportsRepository(prisma)
    : new MemoryReportsRepository();
  const dailyRepo: DailyRepository = prisma
    ? new PrismaDailyRepository(prisma)
    : new MemoryDailyRepository((id) =>
        users instanceof MemoryUserRepository ? users.users.get(id) : undefined,
      );
  const daily = new DailyService(
    dailyRepo,
    prisma ? new PrismaChallengeStore(prisma) : new MemoryChallengeStore(),
    {
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      fetchFn: opts.aiFetch,
      referer: env.PUBLIC_URL,
      baseUrl: env.OPENROUTER_BASE_URL,
    },
  );
  if (env.NODE_ENV !== 'test') daily.startWarmup();
  const mailer = opts.mailer ?? new SmtpMailer(env);
  const resets: ResetRepository = prisma
    ? new PrismaResetRepository(prisma)
    : new MemoryResetRepository();
  const push = new PushService(
    prisma ? new PrismaPushRepository(prisma) : new MemoryPushRepository(),
    {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.PUBLIC_URL?.startsWith('https://')
        ? env.PUBLIC_URL
        : 'mailto:contato@partyverse.app',
      sender: opts.pushSender,
    },
  );
  if (env.NODE_ENV !== 'test' && users) push.start(() => dayKey());
  const bans = new BanList();
  const loadBans = () =>
    users
      ?.bannedIds()
      .then((ids) => bans.load(ids))
      .catch(() => undefined);
  void loadBans();
  const banTimer = setInterval(loadBans, 5 * 60_000);
  banTimer.unref?.();
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
      ai,
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
    bans,
    mailer,
    resets,
    ai,
    reports,
    tournament,
    clans,
    push,
    disconnectUser: (userId) => {
      for (const sid of presence.socketsOf(userId)) io.sockets.sockets.get(sid)?.disconnect(true);
    },
  }));
  attachGateway(io, rooms, tokens, presence, bans);

  const close = async () => {
    clearInterval(banTimer);
    daily.stop();
    tournament.stop();
    push.stop();
    rooms.shutdown();
    io.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
    await prisma?.$disconnect();
  };
  return {
    httpServer,
    io,
    rooms,
    tokens,
    app,
    close,
    progress,
    presence,
    friends,
    bans,
    mailer,
    daily,
    ai,
    reports,
    tournament,
    clans,
    push,
  };
}
