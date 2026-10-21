import { buildAvatar, missingItems, parseAvatar, SHOP_ITEMS, shopItem, aiGenerateSchema, reportSchema, pushSubscribeSchema, avatarMinLevel, EVENTS, GAME_CATALOG, guestSchema, loginSchema, profileUpdateSchema, registerSchema, } from '@partyverse/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corsOrigins } from '../config/env.js';
import { dbStatus } from '../db/status.js';
import { AppError, statusOf, toServerError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { AuthService, toIdentity } from '../modules/auth/auth.service.js';
import { GoogleAuth, safeReturnPath } from '../modules/auth/google.js';
import { PasswordResetService } from '../modules/auth/reset.service.js';
import { containsProfanity } from '../modules/moderation/profanity.js';
import { z } from 'zod';
import { TOKEN_COOKIE, TokenService } from '../modules/auth/token.js';
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
export function createApp({ env, tokens, users, matches, rooms, google: googleDep, progress, presence, friends, daily, bans, mailer, resets, disconnectUser, ai, reports, tournament, clans, push, }) {
    const app = express();
    const auth = new AuthService(users);
    const google = googleDep ?? new GoogleAuth(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
    const OAUTH_COOKIE = 'pv_oauth';
    const isProd = env.NODE_ENV === 'production';
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
    app.use(cors({ origin: corsOrigins(env), credentials: true }));
    app.use(express.json({ limit: '16kb' }));
    app.use(cookieParser());
    const authLimiter = rateLimit({
        windowMs: 60_000,
        limit: env.NODE_ENV === 'test' ? 1000 : 20,
        standardHeaders: true,
        legacyHeaders: false,
    });
    const setSession = (res, id) => {
        res.cookie(TOKEN_COOKIE, tokens.sign(id), {
            httpOnly: true,
            sameSite: 'lax',
            // atrás do proxy HTTPS da hospedagem, req.secure vem de X-Forwarded-Proto
            secure: isProd && res.req.secure,
            maxAge: TokenService.maxAgeMs,
            path: '/',
        });
    };
    const checkNickname = (nick) => {
        if (containsProfanity(nick))
            throw new AppError('VALIDATION', 'Escolha um apelido sem palavrões 🙂', 400);
    };
    /** Itens de avatar travados por nível. */
    /** Moldura/nome/título só vêm da loja: aqui ficam só a base do avatar. */
    const baseOnly = (avatar) => (avatar ? parseAvatar(avatar).base : avatar);
    const checkAvatar = (avatar, level) => {
        if (!avatar)
            return;
        const need = avatarMinLevel(avatar);
        if (need > level)
            throw new AppError('VALIDATION', `Esse item do avatar libera no nível ${need}`, 400);
    };
    const levelOf = async (userId) => (progress ? (await progress.profile(userId)).level : 1);
    const requireAuth = (req, _res, next) => {
        const token = req.cookies?.[TOKEN_COOKIE] ?? req.header('authorization')?.replace(/^Bearer /, '');
        const id = token ? tokens.verify(token) : null;
        if (!id)
            return next(new AppError('UNAUTHORIZED', 'Faça login para continuar', 401));
        if (bans?.has(id.id))
            return next(new AppError('FORBIDDEN', 'Esta conta foi suspensa.', 403));
        req.identity = id;
        next();
    };
    const adminEmails = env.ADMIN_EMAILS.split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    const isAdmin = async (id) => {
        if (!id || id.isGuest || !users || !adminEmails.length)
            return false;
        const u = await users.findById(id.id).catch(() => null);
        return Boolean(u && adminEmails.includes(u.email.toLowerCase()));
    };
    const requireAdmin = (req, res, next) => requireAuth(req, res, (err) => {
        if (err)
            return next(err);
        isAdmin(req.identity).then((ok) => (ok ? next() : next(new AppError('FORBIDDEN', 'Área restrita', 403))), next);
    });
    const api = express.Router();
    api.get('/health', (_req, res) => res.json({
        ok: true,
        db: users ? dbStatus.state : 'off',
        accounts: Boolean(users) && dbStatus.state !== 'error',
        // dica do motivo quando o banco falha (sem dados sensíveis)
        dbHint: dbStatus.state === 'error' ? dbStatus.hint : null,
        google: google.enabled,
        mail: Boolean(mailer?.enabled),
        ai: Boolean(ai?.enabled),
        push: Boolean(push && users),
        // chat de voz: STUN público + TURN opcional (redes que bloqueiam conexão direta)
        iceServers: [
            { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
            ...(env.TURN_URL
                ? [{ urls: env.TURN_URL, username: env.TURN_USERNAME, credential: env.TURN_PASSWORD }]
                : []),
        ],
    }));
    api.get('/games', (_req, res) => res.json(GAME_CATALOG));
    api.get('/stats', (_req, res) => res.json({ online: rooms.onlineCount, rooms: rooms.size }));
    api.get('/rooms', (_req, res) => res.json(rooms.listPublic()));
    // ---------- IA no lobby: gerar conteúdo por tema ----------
    const aiLimiter = rateLimit({
        windowMs: 10 * 60_000,
        limit: env.NODE_ENV === 'test' ? 1000 : 12,
    });
    const AI_FITS = {
        quiz: ['quiz'],
        words: ['draw', 'charades', 'secretword', 'hangman', 'spies'],
        locations: ['impostor'],
        mostlikely: ['mostlikely'],
        truths: ['truthdare'],
        dares: ['truthdare'],
    };
    api.post('/rooms/:code/ai', requireAuth, aiLimiter, wrap(async (req, res) => {
        if (!ai?.enabled)
            throw new AppError('INTERNAL', 'A IA não está configurada neste site.', 503);
        const { kind, theme } = aiGenerateSchema.parse(req.body);
        if (containsProfanity(theme))
            throw new AppError('VALIDATION', 'Escolha outro tema 🙂');
        const room = rooms.get(String(req.params.code));
        if (room.hostId !== req.identity.id)
            throw new AppError('FORBIDDEN', 'Só o anfitrião pode gerar conteúdo', 403);
        if (room.phase === 'playing')
            throw new AppError('INVALID_STATE', 'Espere a partida acabar', 409);
        if (!AI_FITS[kind].includes(room.settings.gameId))
            throw new AppError('VALIDATION', 'Esse conteúdo não serve para o jogo escolhido');
        let data;
        try {
            data = await ai.forRoom(kind, theme);
        }
        catch (err) {
            throw new AppError('INTERNAL', err.message || 'A IA falhou. Tente de novo.', 502);
        }
        if (rooms.find(room.code) !== room || room.phase === 'playing')
            throw new AppError('INVALID_STATE', 'A sala mudou enquanto a IA trabalhava', 409);
        room.updateSettings(room.hostId, undefined, data);
        room.systemMessage(`✨ A IA preparou o tema "${theme}"`);
        const count = Object.values(data).find(Array.isArray)?.length ?? 0;
        res.json({ ok: true, count });
    }));
    // ---------- denúncias ----------
    const reportLimiter = rateLimit({
        windowMs: 60 * 60_000,
        limit: env.NODE_ENV === 'test' ? 1000 : 10,
    });
    api.post('/reports', requireAuth, reportLimiter, wrap(async (req, res) => {
        if (!reports)
            throw new AppError('INTERNAL', 'Denúncias indisponíveis', 503);
        const r = reportSchema.parse(req.body);
        const me = req.identity;
        if (r.targetId === me.id)
            throw new AppError('VALIDATION', 'Você não pode denunciar a si mesmo');
        const room = r.roomCode ? rooms.find(r.roomCode) : undefined;
        const inRoom = room?.players.get(r.targetId);
        const account = inRoom ? null : await users?.findById(r.targetId).catch(() => null);
        if (!inRoom && !account)
            throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
        if (await reports.recentDuplicate(me.id, r.targetId, new Date(Date.now() - 10 * 60_000)))
            throw new AppError('INVALID_STATE', 'Você já denunciou essa pessoa agora há pouco', 409);
        await reports.create({
            reporterId: me.id,
            reporterName: me.nickname,
            targetId: r.targetId,
            targetName: inRoom?.nickname ?? account.nickname,
            targetIsGuest: inRoom ? room.isGuestPlayer(r.targetId) : false,
            roomCode: room?.code ?? null,
            reason: r.reason,
            details: r.details,
            evidence: room ? room.recentChatOf(r.targetId) : [],
        });
        res.status(201).json({ ok: true });
    }));
    // ranking com cache curto (a consulta agrega todas as partidas)
    const boardCache = new Map();
    api.get('/leaderboard', wrap(async (req, res) => {
        const game = typeof req.query.game === 'string' ? req.query.game : '';
        const gameId = GAME_CATALOG.some((g) => g.id === game) ? game : null;
        const season = req.query.periodo === 'temporada';
        const key = `${gameId ?? 'all'}:${season ? seasonStart().toISOString() : 'all'}`;
        const hit = boardCache.get(key);
        if (hit && Date.now() - hit.at < 30_000)
            return res.json(hit.data);
        const data = {
            enabled: Boolean(users),
            season: season ? seasonLabel() : null,
            rows: users
                ? await matches.leaderboard(gameId, 50, season ? seasonStart() : undefined)
                : [],
        };
        boardCache.set(key, { at: Date.now(), data });
        res.json(data);
    }));
    api.get('/rooms/:code', wrap((req, res) => {
        const r = rooms.get(String(req.params.code));
        res.json({
            code: r.code,
            name: r.settings.name,
            gameId: r.settings.gameId,
            players: r.activeCount,
            maxPlayers: r.settings.maxPlayers,
            phase: r.phase,
        });
    }));
    api.post('/auth/guest', authLimiter, wrap((req, res) => {
        const { nickname, avatar: rawAvatar } = guestSchema.parse(req.body);
        const avatar = baseOnly(rawAvatar);
        checkNickname(nickname);
        checkAvatar(avatar, 1);
        const id = auth.guest(nickname, avatar);
        setSession(res, id);
        res.json({ user: id });
    }));
    api.post('/auth/register', authLimiter, wrap(async (req, res) => {
        const { email, password, nickname, avatar: rawAvatar } = registerSchema.parse(req.body);
        const avatar = baseOnly(rawAvatar);
        checkNickname(nickname);
        checkAvatar(avatar, 1);
        const id = await auth.register(email, password, nickname, avatar);
        setSession(res, id);
        res.status(201).json({ user: id });
    }));
    api.post('/auth/login', authLimiter, wrap(async (req, res) => {
        const { email, password } = loginSchema.parse(req.body);
        const id = await auth.login(email, password);
        setSession(res, id);
        res.json({ user: id });
    }));
    // ---------- login com Google ----------
    const publicBase = (req) => (env.PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const redirectUri = (req) => `${publicBase(req)}/api/auth/google/callback`;
    const backToLogin = (res, msg) => res.redirect(`/entrar?erro=${encodeURIComponent(msg)}`);
    api.get('/auth/google', authLimiter, (req, res) => {
        if (!google.enabled || !users)
            return backToLogin(res, 'Login com Google não está disponível');
        const state = google.newState();
        const back = safeReturnPath(req.query.voltar);
        const avatar = typeof req.query.avatar === 'string' && /^c-[0-9a-z]{6}$/.test(req.query.avatar)
            ? req.query.avatar
            : '';
        res.cookie(OAUTH_COOKIE, JSON.stringify({ state, back, avatar }), {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd && req.secure,
            maxAge: 10 * 60_000,
            path: '/api/auth/google',
        });
        res.redirect(google.authUrl(redirectUri(req), state));
    });
    api.get('/auth/google/callback', wrap(async (req, res) => {
        let saved = {};
        try {
            saved = JSON.parse(req.cookies?.[OAUTH_COOKIE] ?? '{}');
        }
        catch {
            /* cookie inválido */
        }
        res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/google' });
        if (req.query.error)
            return backToLogin(res, 'Login com Google cancelado');
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        if (!code || !saved.state || req.query.state !== saved.state)
            return backToLogin(res, 'A sessão de login expirou. Tente de novo.');
        try {
            const profile = await google.exchange(code, redirectUri(req));
            const av = saved.avatar && avatarMinLevel(saved.avatar) <= 1 ? saved.avatar : undefined;
            const id = await auth.google(profile, av);
            setSession(res, id);
            res.redirect(safeReturnPath(saved.back));
        }
        catch (err) {
            backToLogin(res, toServerError(err).message);
        }
    }));
    api.post('/auth/logout', (_req, res) => {
        res.clearCookie(TOKEN_COOKIE, { path: '/' });
        res.json({ ok: true });
    });
    api.get('/auth/me', requireAuth, wrap(async (req, res) => res.json({ user: req.identity, admin: await isAdmin(req.identity) })));
    // ---------- esqueci minha senha ----------
    const resetLimiter = rateLimit({
        windowMs: 15 * 60_000,
        limit: env.NODE_ENV === 'test' ? 1000 : 8,
    });
    api.post('/auth/forgot', resetLimiter, wrap(async (req, res) => {
        if (!users || !resets || !mailer)
            throw new AppError('INTERNAL', 'Recuperação de senha indisponível', 503);
        if (!mailer.enabled)
            throw new AppError('INTERNAL', 'O envio de e-mails ainda não foi configurado no site. Fale com o administrador.', 503);
        const { email } = z
            .object({ email: z.string().trim().email('E-mail inválido').max(120) })
            .parse(req.body);
        await new PasswordResetService(users, resets, mailer, () => publicBase(req)).request(email);
        res.json({ ok: true });
    }));
    api.post('/auth/reset', resetLimiter, wrap(async (req, res) => {
        if (!users || !resets || !mailer)
            throw new AppError('INTERNAL', 'Recuperação de senha indisponível', 503);
        const { token, password } = z
            .object({ token: z.string().min(20).max(100), password: registerSchema.shape.password })
            .parse(req.body);
        const u = await new PasswordResetService(users, resets, mailer, () => publicBase(req)).reset(token, password);
        if (u.banned)
            throw new AppError('FORBIDDEN', 'Esta conta foi suspensa.', 403);
        const id = toIdentity(u);
        setSession(res, id);
        res.json({ user: id });
    }));
    // ---------- painel de administração ----------
    api.get('/admin/stats', requireAdmin, wrap(async (_req, res) => {
        const since = new Date(Date.now() - 24 * 3600_000);
        res.json({
            rooms: rooms.size,
            playersOnline: rooms.onlineCount,
            accountsOnline: presence?.count ?? 0,
            users: users ? await users.counts(since) : null,
            matches: (await matches.counts?.(since)) ?? null,
            daily: daily ? await daily.counts() : null,
            reportsOpen: reports ? await reports.openCount() : 0,
            ai: Boolean(ai?.enabled),
            db: dbStatus.state,
            mail: Boolean(mailer?.enabled),
            uptimeMin: Math.round(process.uptime() / 60),
        });
    }));
    api.get('/admin/reports', requireAdmin, wrap(async (req, res) => {
        const st = req.query.status === 'closed' || req.query.status === 'all' ? req.query.status : 'open';
        res.json(reports ? await reports.list(st, 100) : []);
    }));
    api.post('/admin/reports/:id', requireAdmin, wrap(async (req, res) => {
        const { status } = z.object({ status: z.enum(['open', 'closed']) }).parse(req.body);
        await reports?.setStatus(String(req.params.id), status);
        res.json({ ok: true });
    }));
    api.get('/admin/rooms', requireAdmin, (_req, res) => res.json(rooms.adminList()));
    api.delete('/admin/rooms/:code', requireAdmin, wrap(async (req, res) => {
        rooms.close(String(req.params.code));
        res.json({ ok: true });
    }));
    api.get('/admin/users', requireAdmin, wrap(async (req, res) => {
        if (!users)
            return res.json([]);
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
        const list = await users.adminSearch(q, 50);
        res.json(list.map((u) => ({
            id: u.id,
            nickname: u.nickname,
            email: u.email,
            avatar: u.avatar,
            banned: Boolean(u.banned),
            createdAt: u.createdAt ?? null,
            admin: adminEmails.includes(u.email.toLowerCase()),
        })));
    }));
    api.post('/admin/users/:id/ban', requireAdmin, wrap(async (req, res) => {
        if (!users)
            throw new AppError('INTERNAL', 'Contas indisponíveis', 503);
        const { banned } = z.object({ banned: z.boolean() }).parse(req.body);
        const target = await users.findById(String(req.params.id));
        if (!target)
            throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
        if (adminEmails.includes(target.email.toLowerCase()))
            throw new AppError('VALIDATION', 'Não dá para suspender um administrador');
        await users.setBanned(target.id, banned);
        bans?.set(target.id, banned);
        if (banned) {
            rooms.expelEverywhere(target.id);
            disconnectUser?.(target.id);
        }
        res.json({ ok: true, banned });
    }));
    api.get('/me/profile', requireAuth, wrap(async (req, res) => {
        const id = req.identity;
        if (id.isGuest || !users)
            return res.json({ user: id, stats: null, preferences: {} });
        const u = await users.findById(id.id);
        if (!u)
            throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
        res.json({
            user: toIdentity(u),
            email: u.email,
            stats: await users.stats(u.id),
            preferences: u.preferences,
            progress: progress ? await progress.profile(u.id) : null,
        });
    }));
    api.patch('/me/profile', requireAuth, wrap(async (req, res) => {
        const data = profileUpdateSchema.parse(req.body);
        if (data.nickname)
            checkNickname(data.nickname);
        const id = req.identity;
        checkAvatar(data.avatar, id.isGuest || !users ? 1 : await levelOf(id.id));
        if (id.isGuest || !users) {
            // convidado: atualiza só o token
            const next = {
                ...id,
                nickname: data.nickname ?? id.nickname,
                avatar: baseOnly(data.avatar) ?? id.avatar,
            };
            setSession(res, next);
            return res.json({ user: next, preferences: {} });
        }
        const current = await users.findById(id.id);
        if (!current)
            throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
        // trocar o rosto do avatar mantém a moldura/nome/título equipados
        const u = await users.update(id.id, {
            nickname: data.nickname,
            avatar: data.avatar
                ? buildAvatar(parseAvatar(data.avatar).base, parseAvatar(current.avatar))
                : undefined,
            preferences: data.preferences ? { ...current.preferences, ...data.preferences } : undefined,
        });
        setSession(res, toIdentity(u));
        res.json({ user: toIdentity(u), preferences: u.preferences });
    }));
    // ---------- desafio diário ----------
    const needDaily = () => {
        if (!daily)
            throw new AppError('INTERNAL', 'Desafio diário indisponível', 503);
        return daily;
    };
    const dailyAccount = (req) => {
        if (req.identity.isGuest)
            throw new AppError('UNAUTHORIZED', 'Crie uma conta para entrar no ranking do dia', 401);
        return req.identity.id;
    };
    api.get('/daily', requireAuth, wrap(async (req, res) => {
        const id = req.identity.isGuest ? null : req.identity.id;
        res.json(await needDaily().status(id));
    }));
    api.get('/daily/quiz', requireAuth, wrap(async (_req, res) => res.json(await needDaily().quizQuestions())));
    api.post('/daily/quiz', requireAuth, wrap(async (req, res) => {
        const userId = dailyAccount(req);
        const { answers } = z
            .object({ answers: z.array(z.number().int().min(0).max(3).nullable()).max(20) })
            .parse(req.body);
        const result = await needDaily().submitQuiz(userId, answers);
        const reward = await progress?.grant(userId, Math.round(20 + result.score / 10), [
            'daily_done',
        ]);
        res.json({ result, reward: reward ?? null });
    }));
    api.post('/daily/stop', requireAuth, wrap(async (req, res) => {
        const userId = dailyAccount(req);
        const { answers } = z
            .object({
            answers: z.record(z.string().max(40)).refine((r) => Object.keys(r).length <= 20),
        })
            .parse(req.body);
        const result = await needDaily().submitStop(userId, answers);
        const reward = await progress?.grant(userId, Math.round(20 + result.score / 3), [
            'daily_done',
        ]);
        res.json({ result, reward: reward ?? null });
    }));
    api.get('/daily/termo', requireAuth, wrap(async (req, res) => {
        const id = req.identity.isGuest ? null : req.identity.id;
        res.json(await needDaily().termoStatus(id));
    }));
    const termoLimiter = rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 30 });
    api.post('/daily/termo', requireAuth, termoLimiter, wrap(async (req, res) => {
        const userId = dailyAccount(req);
        const { guess } = z.object({ guess: z.string().max(20) }).parse(req.body);
        const result = await needDaily().termoGuess(userId, guess);
        const reward = result.finishedNow
            ? await progress?.grant(userId, Math.round(20 + result.score / 20), ['daily_done'])
            : null;
        res.json({ result, reward: reward ?? null });
    }));
    api.get('/daily/ranking', wrap(async (req, res) => {
        const game = req.query.game === 'stop' ? 'stop' : req.query.game === 'termo' ? 'termo' : 'quiz';
        res.json(await needDaily().ranking(game));
    }));
    // ---------- amigos ----------
    const needFriends = (req) => {
        if (!friends || !users)
            throw new AppError('INTERNAL', 'Amigos indisponíveis', 503);
        if (req.identity.isGuest)
            throw new AppError('UNAUTHORIZED', 'Crie uma conta para adicionar amigos', 401);
        return friends;
    };
    const inviteLimiter = rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 30 });
    api.get('/friends', requireAuth, wrap(async (req, res) => {
        const repo = needFriends(req);
        const list = await repo.list(req.identity.id);
        res.json(list.map((f) => {
            const room = f.status === 'friend' ? rooms.roomOf(f.user.id) : undefined;
            return {
                ...f,
                online: f.status === 'friend' ? Boolean(presence?.isOnline(f.user.id)) : false,
                room: room
                    ? {
                        code: room.code,
                        name: room.settings.name,
                        gameId: room.settings.gameId,
                        phase: room.phase,
                    }
                    : null,
            };
        }));
    }));
    api.get('/friends/relation/:id', requireAuth, wrap(async (req, res) => {
        if (req.identity.isGuest || !friends)
            return res.json({ status: null });
        res.json({ status: await friends.relation(req.identity.id, String(req.params.id)) });
    }));
    api.post('/friends/:id', requireAuth, inviteLimiter, wrap(async (req, res) => {
        const repo = needFriends(req);
        const target = String(req.params.id);
        if (target === req.identity.id)
            throw new AppError('VALIDATION', 'Você não pode adicionar a si mesmo');
        const other = await users.findById(target);
        if (!other || other.banned)
            throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
        const status = await repo.request(req.identity.id, target);
        if (status === 'friend') {
            await progress?.unlock(req.identity.id, 'first_friend');
            await progress?.unlock(target, 'first_friend');
        }
        else {
            if (status === 'outgoing' && !presence?.isOnline(target))
                void push
                    ?.notify(target, {
                    title: 'Pedido de amizade',
                    body: `${req.identity.nickname} quer ser seu amigo no PartyVerse`,
                    url: '/amigos',
                    tag: `friend-${req.identity.id}`,
                })
                    .catch(() => 0);
            presence?.emitToUser(target, EVENTS.INVITE, {
                kind: 'friend-request',
                from: {
                    id: req.identity.id,
                    nickname: req.identity.nickname,
                    avatar: req.identity.avatar,
                },
            });
        }
        res.json({ status });
    }));
    api.delete('/friends/:id', requireAuth, wrap(async (req, res) => {
        await needFriends(req).remove(req.identity.id, String(req.params.id));
        res.json({ status: null });
    }));
    api.post('/friends/:id/invite', requireAuth, inviteLimiter, wrap(async (req, res) => {
        const repo = needFriends(req);
        const target = String(req.params.id);
        if ((await repo.relation(req.identity.id, target)) !== 'friend')
            throw new AppError('FORBIDDEN', 'Só dá para convidar amigos', 403);
        const room = rooms.roomOf(req.identity.id);
        if (!room)
            throw new AppError('INVALID_STATE', 'Entre numa sala para convidar', 409);
        const delivered = presence?.emitToUser(target, EVENTS.INVITE, {
            kind: 'room',
            from: {
                id: req.identity.id,
                nickname: req.identity.nickname,
                avatar: req.identity.avatar,
            },
            room: { code: room.code, name: room.settings.name, gameId: room.settings.gameId },
        });
        if (delivered)
            return res.json({ ok: true, via: 'online' });
        // fora do site: tenta pela notificação no celular/computador
        const pushed = await (push?.notify(target, {
            title: `${req.identity.nickname} chamou você para jogar`,
            body: `Sala "${room.settings.name}" — toque para entrar`,
            url: `/sala/${room.code}`,
            tag: `invite-${room.code}`,
        }) ?? Promise.resolve(0)).catch(() => 0);
        if (!pushed)
            throw new AppError('INVALID_STATE', 'Seu amigo não está online e não ativou as notificações', 409);
        res.json({ ok: true, via: 'push' });
    }));
    api.get('/users', requireAuth, wrap(async (req, res) => {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (q.length < 2 || !friends)
            return res.json([]);
        res.json(await friends.search(q.slice(0, 20), req.identity.id, 10));
    }));
    // perfil público de um jogador
    api.get('/users/:id', wrap(async (req, res) => {
        if (!users)
            throw new AppError('NOT_FOUND', 'Perfis indisponíveis', 404);
        const u = await users.findById(String(req.params.id));
        if (!u || u.banned)
            throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
        res.json({
            user: toIdentity(u),
            createdAt: u.createdAt,
            stats: await users.stats(u.id),
            progress: progress ? await progress.profile(u.id) : null,
            clan: clans ? await clanBadge(u.id) : null,
            history: (await matches.historyFor(u.id, 8)).map((h) => ({ ...h, matchId: undefined })),
        });
    }));
    // ---------- notificações push ----------
    const needPush = () => {
        if (!push || !users)
            throw new AppError('INTERNAL', 'Notificações indisponíveis', 503);
        return push;
    };
    api.get('/push/key', wrap(async (_req, res) => res.json({ publicKey: await needPush().publicKey() })));
    api.post('/push/subscribe', requireAuth, wrap(async (req, res) => {
        if (req.identity.isGuest)
            throw new AppError('UNAUTHORIZED', 'Crie uma conta para receber notificações', 401);
        await needPush().subscribe(req.identity.id, pushSubscribeSchema.parse(req.body));
        res.json({ ok: true });
    }));
    api.delete('/push/subscribe', requireAuth, wrap(async (req, res) => {
        const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
        await needPush().unsubscribe(req.identity.id, endpoint);
        res.json({ ok: true });
    }));
    api.post('/push/test', requireAuth, wrap(async (req, res) => {
        const sent = await needPush().notify(req.identity.id, {
            title: 'Notificações ligadas 🎉',
            body: 'É assim que você vai saber de convites e do desafio do dia.',
            url: '/perfil',
            tag: 'test',
        });
        res.json({ sent });
    }));
    // ---------- loja ----------
    const needProgress = () => {
        if (!progress || !users)
            throw new AppError('INTERNAL', 'Loja indisponível', 503);
        return progress;
    };
    const accountOnly = (req, msg) => {
        if (req.identity.isGuest)
            throw new AppError('UNAUTHORIZED', msg, 401);
        return req.identity.id;
    };
    api.get('/shop', requireAuth, wrap(async (req, res) => {
        if (req.identity.isGuest || !progress)
            return res.json({ items: SHOP_ITEMS, coins: 0, owned: [], equipped: {} });
        const w = await progress.wallet(req.identity.id);
        const { frame, name, title } = parseAvatar(req.identity.avatar);
        const equipped = Object.fromEntries(Object.entries({ frame, name, title }).filter(([, v]) => v));
        res.json({ items: SHOP_ITEMS, coins: w.coins, owned: w.items, equipped });
    }));
    api.post('/shop/buy', requireAuth, wrap(async (req, res) => {
        const userId = accountOnly(req, 'Crie uma conta para comprar na loja');
        const p = needProgress();
        const { itemId } = z.object({ itemId: z.string().max(4) }).parse(req.body);
        const item = shopItem(itemId);
        if (!item || item.prizeOnly)
            throw new AppError('NOT_FOUND', 'Item não encontrado', 404);
        const { items } = await p.wallet(userId);
        if (items.includes(itemId))
            throw new AppError('INVALID_STATE', 'Você já tem esse item', 409);
        const coins = await p.spend(userId, item.price);
        if (coins === null)
            throw new AppError('INVALID_STATE', 'Moedas insuficientes. Jogue mais partidas!', 409);
        try {
            await p.giveItems(userId, [itemId]);
        }
        catch (e) {
            await p.refund(userId, item.price);
            throw e;
        }
        const achievements = (await p.unlock(userId, 'first_purchase')) ? ['first_purchase'] : [];
        res.json({ coins, owned: [...items, itemId], achievements });
    }));
    api.post('/shop/equip', requireAuth, wrap(async (req, res) => {
        const userId = accountOnly(req, 'Crie uma conta para usar itens');
        const p = needProgress();
        const slot = z
            .string()
            .regex(/^[fnt]\d{1,2}$/)
            .nullable()
            .optional();
        const want = z.object({ frame: slot, name: slot, title: slot }).parse(req.body);
        const u = await users.findById(userId);
        if (!u)
            throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
        const cur = parseAvatar(u.avatar);
        const next = {
            frame: want.frame === undefined ? cur.frame : (want.frame ?? undefined),
            name: want.name === undefined ? cur.name : (want.name ?? undefined),
            title: want.title === undefined ? cur.title : (want.title ?? undefined),
        };
        const kinds = { frame: 'frame', name: 'name', title: 'title' };
        for (const [k, v] of Object.entries(next))
            if (v && shopItem(v)?.kind !== kinds[k])
                throw new AppError('VALIDATION', 'Item no lugar errado');
        const avatar = buildAvatar(cur.base, next);
        const missing = missingItems(avatar, (await p.wallet(userId)).items);
        if (missing.length)
            throw new AppError('FORBIDDEN', 'Compre o item antes de usar', 403);
        const updated = await users.update(userId, { avatar });
        setSession(res, toIdentity(updated));
        res.json({ user: toIdentity(updated) });
    }));
    // ---------- torneio da semana ----------
    api.get('/tournament', wrap(async (_req, res) => {
        if (!tournament)
            return res.json(null);
        const t = await tournament.standings(20);
        const names = new Map();
        for (const w of t.lastWinners) {
            const u = await users?.findById(w.userId).catch(() => null);
            if (u)
                names.set(w.userId, { nickname: u.nickname, avatar: u.avatar });
        }
        res.json({
            ...t,
            lastWinners: t.lastWinners.map((w) => ({
                ...w,
                ...(names.get(w.userId) ?? { nickname: '?', avatar: 'blob-1' }),
            })),
        });
    }));
    // ---------- clãs ----------
    const needClans = () => {
        if (!clans || !users)
            throw new AppError('INTERNAL', 'Clãs indisponíveis', 503);
        return clans;
    };
    const clanBadge = async (userId) => {
        const c = await clans?.ofUser(userId).catch(() => null);
        return c ? { tag: c.tag, name: c.name, emoji: c.emoji } : null;
    };
    /** Vitórias da temporada por jogador (para o ranking de clãs). */
    const seasonWins = async () => {
        const rows = users ? await matches.leaderboard(null, 5000, seasonStart()) : [];
        return new Map(rows.map((r) => [r.userId, r.wins]));
    };
    const withStats = (c, wins) => ({
        ...c,
        members: c.members.map((m) => ({ ...m, wins: wins.get(m.userId) ?? 0 })),
        wins: c.members.reduce((n, m) => n + (wins.get(m.userId) ?? 0), 0),
    });
    const CLAN_MAX = 30;
    api.get('/clans', wrap(async (_req, res) => {
        if (!clans)
            return res.json({ clans: [], season: seasonLabel() });
        const wins = await seasonWins();
        const list = (await clans.list(200)).map((c) => withStats(c, wins));
        list.sort((a, b) => b.wins - a.wins || b.members.length - a.members.length);
        res.json({
            season: seasonLabel(),
            clans: list.slice(0, 50).map(({ members, ...c }) => ({ ...c, size: members.length })),
        });
    }));
    api.get('/clans/mine', requireAuth, wrap(async (req, res) => {
        if (req.identity.isGuest || !clans)
            return res.json(null);
        res.json(await clanBadge(req.identity.id));
    }));
    api.get('/clans/:tag', wrap(async (req, res) => {
        const c = await needClans().byTag(String(req.params.tag).toUpperCase());
        if (!c)
            throw new AppError('NOT_FOUND', 'Clã não encontrado', 404);
        res.json(withStats(c, await seasonWins()));
    }));
    api.post('/clans', requireAuth, wrap(async (req, res) => {
        const userId = accountOnly(req, 'Crie uma conta para ter um clã');
        const repo = needClans();
        const data = z
            .object({
            name: z.string().trim().min(3, 'Nome com pelo menos 3 letras').max(24),
            tag: z
                .string()
                .trim()
                .toUpperCase()
                .regex(/^[A-Z0-9]{2,5}$/, 'A sigla tem de 2 a 5 letras/números'),
            emoji: z.string().min(1).max(8),
            description: z.string().trim().max(120).default(''),
        })
            .parse(req.body);
        if (containsProfanity(`${data.name} ${data.tag} ${data.description}`))
            throw new AppError('VALIDATION', 'Escolha um nome sem palavrões 🙂');
        if (await repo.ofUser(userId))
            throw new AppError('INVALID_STATE', 'Você já está em um clã', 409);
        try {
            const c = await repo.create({ ...data, ownerId: userId });
            await progress?.unlock(userId, 'first_clan');
            res.status(201).json(c);
        }
        catch (e) {
            if (e.code === 'P2002')
                throw new AppError('VALIDATION', 'Essa sigla já existe. Escolha outra.', 409);
            throw e;
        }
    }));
    api.post('/clans/:tag/join', requireAuth, wrap(async (req, res) => {
        const userId = accountOnly(req, 'Crie uma conta para entrar em um clã');
        const repo = needClans();
        const c = await repo.byTag(String(req.params.tag).toUpperCase());
        if (!c)
            throw new AppError('NOT_FOUND', 'Clã não encontrado', 404);
        if (await repo.ofUser(userId))
            throw new AppError('INVALID_STATE', 'Saia do seu clã atual antes', 409);
        if (c.members.length >= CLAN_MAX)
            throw new AppError('ROOM_FULL', 'Clã lotado', 409);
        await repo.addMember(c.id, userId);
        await progress?.unlock(userId, 'first_clan');
        res.json({ ok: true });
    }));
    api.post('/clans/leave', requireAuth, wrap(async (req, res) => {
        const userId = accountOnly(req, 'Sem clã');
        const repo = needClans();
        const c = await repo.ofUser(userId);
        if (!c)
            return res.json({ ok: true });
        const rest = c.members.filter((m) => m.userId !== userId);
        if (!rest.length)
            await repo.remove(c.id);
        else {
            await repo.removeMember(c.id, userId);
            if (c.ownerId === userId)
                await repo.setOwner(c.id, rest[0].userId);
        }
        res.json({ ok: true });
    }));
    api.delete('/clans/:tag/members/:userId', requireAuth, wrap(async (req, res) => {
        const me = accountOnly(req, 'Sem permissão');
        const repo = needClans();
        const c = await repo.byTag(String(req.params.tag).toUpperCase());
        if (!c)
            throw new AppError('NOT_FOUND', 'Clã não encontrado', 404);
        if (c.ownerId !== me)
            throw new AppError('FORBIDDEN', 'Só o líder pode remover', 403);
        const target = String(req.params.userId);
        if (target === me)
            throw new AppError('VALIDATION', 'Use "Sair do clã"');
        await repo.removeMember(c.id, target);
        res.json({ ok: true });
    }));
    api.get('/me/history', requireAuth, wrap(async (req, res) => {
        if (req.identity.isGuest)
            return res.json([]);
        res.json(await matches.historyFor(req.identity.id, 30));
    }));
    app.use('/api', api);
    app.use('/api', (_req, _res, next) => next(new AppError('NOT_FOUND', 'Rota não encontrada', 404)));
    // Em produção o servidor também entrega o front-end compilado.
    // O caminho é relativo a este arquivo, então funciona qualquer que seja a pasta de onde o
    // processo foi iniciado (a Hostinger, por exemplo, inicia pela raiz do projeto).
    const webDist = env.WEB_DIST_DIR ?? fileURLToPath(new URL('../../../web/dist', import.meta.url));
    if (isProd && existsSync(webDist)) {
        // arquivos com hash no nome podem ficar em cache por muito tempo; o index.html, nunca
        app.use('/assets', express.static(path.join(webDist, 'assets'), { maxAge: '365d', immutable: true }));
        app.use(express.static(webDist, {
            maxAge: '1h',
            index: false,
            // o service worker e o tema precisam ser conferidos sempre, para o app atualizar sozinho
            setHeaders: (res, file) => {
                if (/(sw|theme)\.js$|\.webmanifest$/.test(file))
                    res.setHeader('Cache-Control', 'no-cache');
            },
        }));
        const template = readFileSync(path.join(webDist, 'index.html'), 'utf8');
        app.get('*', (req, res) => {
            res.setHeader('Cache-Control', 'no-cache');
            res.type('html').send(withPreview(template, previewFor(req.path, req)));
        });
    }
    else if (isProd) {
        logger.warn({ webDist }, 'front-end compilado não encontrado; rode npm run build');
    }
    app.use((err, _req, res, _next) => {
        const status = statusOf(err);
        if (status >= 500)
            logger.error({ err: String(err) }, 'erro http');
        res.status(status).json({ error: toServerError(err) });
    });
    return app;
}
/** Temporada = mês corrente no horário de Brasília (UTC-3). */
export function seasonStart(now = new Date()) {
    const br = new Date(now.getTime() - 3 * 3600_000);
    return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3, 0, 0));
}
const MONTHS = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
];
export function seasonLabel(now = new Date()) {
    const br = new Date(now.getTime() - 3 * 3600_000);
    return `Temporada de ${MONTHS[br.getUTCMonth()]} ${br.getUTCFullYear()}`;
}
const escapeHtml = (v) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Prévia do link (WhatsApp, Telegram, Discord…) conforme a página. */
export function previewFor(pathname, req) {
    const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
    const base = {
        title: 'PartyVerse — jogos para jogar com os amigos',
        description: 'Adedonha, Impostor, Quiz, desenho e mímica: crie uma sala grátis e chame a galera pelo navegador.',
        url: origin + pathname,
        image: `${origin}/og.png`,
    };
    const room = /^\/sala\/([A-Za-z0-9]{6})\/?$/.exec(pathname);
    if (room) {
        return {
            ...base,
            title: `🎉 Entre na minha sala do PartyVerse! Código ${room[1].toUpperCase()}`,
            description: 'Toque no link, escolha um apelido e jogue. Não precisa instalar nada.',
        };
    }
    const game = /^\/jogos\/([a-z-]+)\/?$/.exec(pathname);
    const slug = (v) => v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
    const meta = game
        ? GAME_CATALOG.find((g) => g.id === game[1] || slug(g.name) === game[1])
        : undefined;
    if (meta)
        return { ...base, title: `${meta.name} — PartyVerse`, description: meta.tagline };
    return base;
}
export function withPreview(html, p) {
    const e = escapeHtml;
    const tags = [
        `<title>${e(p.title)}</title>`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="PartyVerse" />`,
        `<meta property="og:title" content="${e(p.title)}" />`,
        `<meta property="og:description" content="${e(p.description)}" />`,
        `<meta property="og:url" content="${e(p.url)}" />`,
        `<meta property="og:image" content="${e(p.image)}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
    ].join('\n    ');
    return html.replace(/<title>[^<]*<\/title>/, tags);
}
