import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOrigins } from './config/env.js';
import { getPrisma } from './db/prisma.js';
import { createApp } from './http/app.js';
import { attachGateway, createTransport } from './realtime/gateway.js';
import { TokenService } from './modules/auth/token.js';
import { MemoryProgressRepository, PrismaProgressRepository, } from './modules/progress/progress.repository.js';
import { ProgressService } from './modules/progress/progress.service.js';
import { MemoryMatchRepository, PrismaMatchRepository, } from './modules/matches/match.repository.js';
import { MemoryUserRepository, PrismaUserRepository, } from './modules/users/users.repository.js';
import { MemoryFriendsRepository, PrismaFriendsRepository, } from './modules/social/friends.repository.js';
import { Presence } from './modules/social/presence.js';
import { MemoryChallengeStore, MemoryDailyRepository, PrismaChallengeStore, PrismaDailyRepository, } from './modules/daily/daily.repository.js';
import { DailyService } from './modules/daily/daily.service.js';
import { AiService } from './modules/ai/ai.service.js';
import { MemoryReportsRepository, PrismaReportsRepository, } from './modules/moderation/reports.repository.js';
import { BanList } from './modules/admin/bans.js';
import { SmtpMailer } from './modules/mail/mailer.js';
import { MemoryResetRepository, PrismaResetRepository, } from './modules/auth/reset.repository.js';
import { RoomManager } from './rooms/RoomManager.js';
/** Monta HTTP + Socket.IO. Separado de index.ts para ser usado nos testes. */
export function buildServer(env, opts = {}) {
    const prisma = env.DATABASE_URL && opts.users === undefined ? getPrisma(env.DATABASE_URL) : null;
    const users = opts.users !== undefined ? opts.users : prisma ? new PrismaUserRepository(prisma) : null;
    const matches = opts.matches ?? (prisma ? new PrismaMatchRepository(prisma) : new MemoryMatchRepository());
    const tokens = new TokenService(env.JWT_SECRET);
    // progresso (XP/conquistas) só existe com contas
    const progressRepo = opts.progress ??
        (prisma
            ? new PrismaProgressRepository(prisma)
            : users
                ? new MemoryProgressRepository(matches instanceof MemoryMatchRepository ? matches : undefined)
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
    const reports = prisma
        ? new PrismaReportsRepository(prisma)
        : new MemoryReportsRepository();
    const dailyRepo = prisma
        ? new PrismaDailyRepository(prisma)
        : new MemoryDailyRepository((id) => users instanceof MemoryUserRepository ? users.users.get(id) : undefined);
    const daily = new DailyService(dailyRepo, prisma ? new PrismaChallengeStore(prisma) : new MemoryChallengeStore(), {
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        fetchFn: opts.aiFetch,
        referer: env.PUBLIC_URL,
        baseUrl: env.OPENROUTER_BASE_URL,
    });
    if (env.NODE_ENV !== 'test')
        daily.startWarmup();
    const mailer = opts.mailer ?? new SmtpMailer(env);
    const resets = prisma
        ? new PrismaResetRepository(prisma)
        : new MemoryResetRepository();
    const bans = new BanList();
    const loadBans = () => users
        ?.bannedIds()
        .then((ids) => bans.load(ids))
        .catch(() => undefined);
    void loadBans();
    const banTimer = setInterval(loadBans, 5 * 60_000);
    banTimer.unref?.();
    const friends = opts.friends ??
        (prisma
            ? new PrismaFriendsRepository(prisma)
            : users instanceof MemoryUserRepository
                ? new MemoryFriendsRepository(() => [...users.users.values()])
                : undefined);
    // o app precisa existir antes do Socket.IO: ele intercepta /socket.io e repassa o resto ao Express
    const ref = {};
    const httpServer = createServer((req, res) => ref.app(req, res));
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
        ai,
    }, progress);
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
        disconnectUser: (userId) => {
            for (const sid of presence.socketsOf(userId))
                io.sockets.sockets.get(sid)?.disconnect(true);
        },
    }));
    attachGateway(io, rooms, tokens, presence, bans);
    const close = async () => {
        clearInterval(banTimer);
        daily.stop();
        rooms.shutdown();
        io.close();
        await new Promise((r) => httpServer.close(() => r()));
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
    };
}
