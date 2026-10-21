import {
  avatarMinLevel,
  EVENTS,
  GAME_CATALOG,
  guestSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
} from '@partyverse/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corsOrigins, type Env } from '../config/env.js';
import { dbStatus } from '../db/status.js';
import { AppError, statusOf, toServerError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { AuthService, toIdentity } from '../modules/auth/auth.service.js';
import { GoogleAuth, safeReturnPath } from '../modules/auth/google.js';
import type { ProgressService } from '../modules/progress/progress.service.js';
import type { FriendsRepository } from '../modules/social/friends.repository.js';
import type { Presence } from '../modules/social/presence.js';
import type { DailyService } from '../modules/daily/daily.service.js';
import type { BanList } from '../modules/admin/bans.js';
import type { Mailer } from '../modules/mail/mailer.js';
import type { ResetRepository } from '../modules/auth/reset.repository.js';
import { PasswordResetService } from '../modules/auth/reset.service.js';
import { z } from 'zod';
import { TOKEN_COOKIE, TokenService, type Identity } from '../modules/auth/token.js';
import type { MatchRepository } from '../modules/matches/match.repository.js';
import type { UserRepository } from '../modules/users/users.repository.js';
import type { RoomManager } from '../rooms/RoomManager.js';

export interface AppDeps {
  bans?: BanList;
  mailer?: Mailer;
  resets?: ResetRepository;
  /** derruba as conexões em tempo real de uma conta (ao suspender) */
  disconnectUser?: (userId: string) => void;
  daily?: DailyService;
  presence?: Presence;
  friends?: FriendsRepository;
  google?: GoogleAuth;
  progress?: ProgressService;
  env: Env;
  tokens: TokenService;
  users: UserRepository | null;
  matches: MatchRepository;
  rooms: RoomManager;
}

type AuthedRequest = Request & { identity?: Identity };
const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);

export function createApp({
  env,
  tokens,
  users,
  matches,
  rooms,
  google: googleDep,
  progress,
  presence,
  friends,
  daily,
  bans,
  mailer,
  resets,
  disconnectUser,
}: AppDeps) {
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

  const setSession = (res: Response, id: Identity) => {
    res.cookie(TOKEN_COOKIE, tokens.sign(id), {
      httpOnly: true,
      sameSite: 'lax',
      // atrás do proxy HTTPS da hospedagem, req.secure vem de X-Forwarded-Proto
      secure: isProd && res.req.secure,
      maxAge: TokenService.maxAgeMs,
      path: '/',
    });
  };

  /** Itens de avatar travados por nível. */
  const checkAvatar = (avatar: string | undefined, level: number) => {
    if (!avatar) return;
    const need = avatarMinLevel(avatar);
    if (need > level)
      throw new AppError('VALIDATION', `Esse item do avatar libera no nível ${need}`, 400);
  };
  const levelOf = async (userId: string) => (progress ? (await progress.profile(userId)).level : 1);

  const requireAuth = (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const token =
      req.cookies?.[TOKEN_COOKIE] ?? req.header('authorization')?.replace(/^Bearer /, '');
    const id = token ? tokens.verify(token) : null;
    if (!id) return next(new AppError('UNAUTHORIZED', 'Faça login para continuar', 401));
    if (bans?.has(id.id)) return next(new AppError('FORBIDDEN', 'Esta conta foi suspensa.', 403));
    req.identity = id;
    next();
  };

  const adminEmails = env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = async (id: Identity | undefined) => {
    if (!id || id.isGuest || !users || !adminEmails.length) return false;
    const u = await users.findById(id.id).catch(() => null);
    return Boolean(u && adminEmails.includes(u.email.toLowerCase()));
  };
  const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) =>
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      isAdmin(req.identity).then(
        (ok) => (ok ? next() : next(new AppError('FORBIDDEN', 'Área restrita', 403))),
        next,
      );
    });

  const api = express.Router();

  api.get('/health', (_req, res) =>
    res.json({
      ok: true,
      db: users ? dbStatus.state : 'off',
      accounts: Boolean(users) && dbStatus.state !== 'error',
      // dica do motivo quando o banco falha (sem dados sensíveis)
      dbHint: dbStatus.state === 'error' ? dbStatus.hint : null,
      google: google.enabled,
      mail: Boolean(mailer?.enabled),
    }),
  );
  api.get('/games', (_req, res) => res.json(GAME_CATALOG));
  api.get('/stats', (_req, res) => res.json({ online: rooms.onlineCount, rooms: rooms.size }));
  api.get('/rooms', (_req, res) => res.json(rooms.listPublic()));

  // ranking com cache curto (a consulta agrega todas as partidas)
  const boardCache = new Map<string, { at: number; data: unknown }>();
  api.get(
    '/leaderboard',
    wrap(async (req, res) => {
      const game = typeof req.query.game === 'string' ? req.query.game : '';
      const gameId = GAME_CATALOG.some((g) => g.id === game) ? game : null;
      const season = req.query.periodo === 'temporada';
      const key = `${gameId ?? 'all'}:${season ? seasonStart().toISOString() : 'all'}`;
      const hit = boardCache.get(key);
      if (hit && Date.now() - hit.at < 30_000) return res.json(hit.data);
      const data = {
        enabled: Boolean(users),
        season: season ? seasonLabel() : null,
        rows: users
          ? await matches.leaderboard(gameId, 50, season ? seasonStart() : undefined)
          : [],
      };
      boardCache.set(key, { at: Date.now(), data });
      res.json(data);
    }),
  );
  api.get(
    '/rooms/:code',
    wrap((req, res) => {
      const r = rooms.get(String(req.params.code));
      res.json({
        code: r.code,
        name: r.settings.name,
        gameId: r.settings.gameId,
        players: r.activeCount,
        maxPlayers: r.settings.maxPlayers,
        phase: r.phase,
      });
    }),
  );

  api.post(
    '/auth/guest',
    authLimiter,
    wrap((req, res) => {
      const { nickname, avatar } = guestSchema.parse(req.body);
      checkAvatar(avatar, 1);
      const id = auth.guest(nickname, avatar);
      setSession(res, id);
      res.json({ user: id });
    }),
  );
  api.post(
    '/auth/register',
    authLimiter,
    wrap(async (req, res) => {
      const { email, password, nickname, avatar } = registerSchema.parse(req.body);
      checkAvatar(avatar, 1);
      const id = await auth.register(email, password, nickname, avatar);
      setSession(res, id);
      res.status(201).json({ user: id });
    }),
  );
  api.post(
    '/auth/login',
    authLimiter,
    wrap(async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const id = await auth.login(email, password);
      setSession(res, id);
      res.json({ user: id });
    }),
  );
  // ---------- login com Google ----------
  const publicBase = (req: Request) =>
    (env.PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const redirectUri = (req: Request) => `${publicBase(req)}/api/auth/google/callback`;
  const backToLogin = (res: Response, msg: string) =>
    res.redirect(`/entrar?erro=${encodeURIComponent(msg)}`);

  api.get('/auth/google', authLimiter, (req, res) => {
    if (!google.enabled || !users) return backToLogin(res, 'Login com Google não está disponível');
    const state = google.newState();
    const back = safeReturnPath(req.query.voltar);
    const avatar =
      typeof req.query.avatar === 'string' && /^c-[0-9a-z]{6}$/.test(req.query.avatar)
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

  api.get(
    '/auth/google/callback',
    wrap(async (req, res) => {
      let saved: { state?: string; back?: string; avatar?: string } = {};
      try {
        saved = JSON.parse(req.cookies?.[OAUTH_COOKIE] ?? '{}');
      } catch {
        /* cookie inválido */
      }
      res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/google' });
      if (req.query.error) return backToLogin(res, 'Login com Google cancelado');
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      if (!code || !saved.state || req.query.state !== saved.state)
        return backToLogin(res, 'A sessão de login expirou. Tente de novo.');
      try {
        const profile = await google.exchange(code, redirectUri(req));
        const av = saved.avatar && avatarMinLevel(saved.avatar) <= 1 ? saved.avatar : undefined;
        const id = await auth.google(profile, av);
        setSession(res, id);
        res.redirect(safeReturnPath(saved.back));
      } catch (err) {
        backToLogin(res, toServerError(err).message);
      }
    }),
  );

  api.post('/auth/logout', (_req, res) => {
    res.clearCookie(TOKEN_COOKIE, { path: '/' });
    res.json({ ok: true });
  });
  api.get(
    '/auth/me',
    requireAuth,
    wrap(async (req, res) => res.json({ user: req.identity, admin: await isAdmin(req.identity) })),
  );

  // ---------- esqueci minha senha ----------
  const resetLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: env.NODE_ENV === 'test' ? 1000 : 8,
  });
  api.post(
    '/auth/forgot',
    resetLimiter,
    wrap(async (req, res) => {
      if (!users || !resets || !mailer)
        throw new AppError('INTERNAL', 'Recuperação de senha indisponível', 503);
      if (!mailer.enabled)
        throw new AppError(
          'INTERNAL',
          'O envio de e-mails ainda não foi configurado no site. Fale com o administrador.',
          503,
        );
      const { email } = z
        .object({ email: z.string().trim().email('E-mail inválido').max(120) })
        .parse(req.body);
      await new PasswordResetService(users, resets, mailer, () => publicBase(req)).request(email);
      res.json({ ok: true });
    }),
  );
  api.post(
    '/auth/reset',
    resetLimiter,
    wrap(async (req, res) => {
      if (!users || !resets || !mailer)
        throw new AppError('INTERNAL', 'Recuperação de senha indisponível', 503);
      const { token, password } = z
        .object({ token: z.string().min(20).max(100), password: registerSchema.shape.password })
        .parse(req.body);
      const u = await new PasswordResetService(users, resets, mailer, () => publicBase(req)).reset(
        token,
        password,
      );
      if (u.banned) throw new AppError('FORBIDDEN', 'Esta conta foi suspensa.', 403);
      const id = toIdentity(u);
      setSession(res, id);
      res.json({ user: id });
    }),
  );

  // ---------- painel de administração ----------
  api.get(
    '/admin/stats',
    requireAdmin,
    wrap(async (_req, res) => {
      const since = new Date(Date.now() - 24 * 3600_000);
      res.json({
        rooms: rooms.size,
        playersOnline: rooms.onlineCount,
        accountsOnline: presence?.count ?? 0,
        users: users ? await users.counts(since) : null,
        matches: (await matches.counts?.(since)) ?? null,
        daily: daily ? await daily.counts() : null,
        db: dbStatus.state,
        mail: Boolean(mailer?.enabled),
        uptimeMin: Math.round(process.uptime() / 60),
      });
    }),
  );
  api.get('/admin/rooms', requireAdmin, (_req, res) => res.json(rooms.adminList()));
  api.delete(
    '/admin/rooms/:code',
    requireAdmin,
    wrap(async (req, res) => {
      rooms.close(String(req.params.code));
      res.json({ ok: true });
    }),
  );
  api.get(
    '/admin/users',
    requireAdmin,
    wrap(async (req, res) => {
      if (!users) return res.json([]);
      const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
      const list = await users.adminSearch(q, 50);
      res.json(
        list.map((u) => ({
          id: u.id,
          nickname: u.nickname,
          email: u.email,
          avatar: u.avatar,
          banned: Boolean(u.banned),
          createdAt: u.createdAt ?? null,
          admin: adminEmails.includes(u.email.toLowerCase()),
        })),
      );
    }),
  );
  api.post(
    '/admin/users/:id/ban',
    requireAdmin,
    wrap(async (req, res) => {
      if (!users) throw new AppError('INTERNAL', 'Contas indisponíveis', 503);
      const { banned } = z.object({ banned: z.boolean() }).parse(req.body);
      const target = await users.findById(String(req.params.id));
      if (!target) throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
      if (adminEmails.includes(target.email.toLowerCase()))
        throw new AppError('VALIDATION', 'Não dá para suspender um administrador');
      await users.setBanned(target.id, banned);
      bans?.set(target.id, banned);
      if (banned) {
        rooms.expelEverywhere(target.id);
        disconnectUser?.(target.id);
      }
      res.json({ ok: true, banned });
    }),
  );

  api.get(
    '/me/profile',
    requireAuth,
    wrap(async (req, res) => {
      const id = req.identity!;
      if (id.isGuest || !users) return res.json({ user: id, stats: null, preferences: {} });
      const u = await users.findById(id.id);
      if (!u) throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
      res.json({
        user: toIdentity(u),
        email: u.email,
        stats: await users.stats(u.id),
        preferences: u.preferences,
        progress: progress ? await progress.profile(u.id) : null,
      });
    }),
  );
  api.patch(
    '/me/profile',
    requireAuth,
    wrap(async (req, res) => {
      const data = profileUpdateSchema.parse(req.body);
      const id = req.identity!;
      checkAvatar(data.avatar, id.isGuest || !users ? 1 : await levelOf(id.id));
      if (id.isGuest || !users) {
        // convidado: atualiza só o token
        const next = {
          ...id,
          nickname: data.nickname ?? id.nickname,
          avatar: data.avatar ?? id.avatar,
        };
        setSession(res, next);
        return res.json({ user: next, preferences: {} });
      }
      const current = await users.findById(id.id);
      if (!current) throw new AppError('NOT_FOUND', 'Conta não encontrada', 404);
      const u = await users.update(id.id, {
        nickname: data.nickname,
        avatar: data.avatar,
        preferences: data.preferences ? { ...current.preferences, ...data.preferences } : undefined,
      });
      setSession(res, toIdentity(u));
      res.json({ user: toIdentity(u), preferences: u.preferences });
    }),
  );
  // ---------- desafio diário ----------
  const needDaily = () => {
    if (!daily) throw new AppError('INTERNAL', 'Desafio diário indisponível', 503);
    return daily;
  };
  const dailyAccount = (req: AuthedRequest) => {
    if (req.identity!.isGuest)
      throw new AppError('UNAUTHORIZED', 'Crie uma conta para entrar no ranking do dia', 401);
    return req.identity!.id;
  };
  api.get(
    '/daily',
    requireAuth,
    wrap(async (req, res) => {
      const id = req.identity!.isGuest ? null : req.identity!.id;
      res.json(await needDaily().status(id));
    }),
  );
  api.get(
    '/daily/quiz',
    requireAuth,
    wrap(async (_req, res) => res.json(await needDaily().quizQuestions())),
  );
  api.post(
    '/daily/quiz',
    requireAuth,
    wrap(async (req, res) => {
      const userId = dailyAccount(req);
      const { answers } = z
        .object({ answers: z.array(z.number().int().min(0).max(3).nullable()).max(20) })
        .parse(req.body);
      const result = await needDaily().submitQuiz(userId, answers);
      const reward = await progress?.grant(userId, Math.round(20 + result.score / 10), [
        'daily_done',
      ]);
      res.json({ result, reward: reward ?? null });
    }),
  );
  api.post(
    '/daily/stop',
    requireAuth,
    wrap(async (req, res) => {
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
    }),
  );
  api.get(
    '/daily/ranking',
    wrap(async (req, res) => {
      const game = req.query.game === 'stop' ? 'stop' : 'quiz';
      res.json(await needDaily().ranking(game));
    }),
  );

  // ---------- amigos ----------
  const needFriends = (req: AuthedRequest) => {
    if (!friends || !users) throw new AppError('INTERNAL', 'Amigos indisponíveis', 503);
    if (req.identity!.isGuest)
      throw new AppError('UNAUTHORIZED', 'Crie uma conta para adicionar amigos', 401);
    return friends;
  };
  const inviteLimiter = rateLimit({ windowMs: 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 30 });

  api.get(
    '/friends',
    requireAuth,
    wrap(async (req, res) => {
      const repo = needFriends(req);
      const list = await repo.list(req.identity!.id);
      res.json(
        list.map((f) => {
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
        }),
      );
    }),
  );
  api.get(
    '/friends/relation/:id',
    requireAuth,
    wrap(async (req, res) => {
      if (req.identity!.isGuest || !friends) return res.json({ status: null });
      res.json({ status: await friends.relation(req.identity!.id, String(req.params.id)) });
    }),
  );
  api.post(
    '/friends/:id',
    requireAuth,
    inviteLimiter,
    wrap(async (req, res) => {
      const repo = needFriends(req);
      const target = String(req.params.id);
      if (target === req.identity!.id)
        throw new AppError('VALIDATION', 'Você não pode adicionar a si mesmo');
      const other = await users!.findById(target);
      if (!other || other.banned) throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
      const status = await repo.request(req.identity!.id, target);
      if (status === 'friend') {
        await progress?.unlock(req.identity!.id, 'first_friend');
        await progress?.unlock(target, 'first_friend');
      } else {
        presence?.emitToUser(target, EVENTS.INVITE, {
          kind: 'friend-request',
          from: {
            id: req.identity!.id,
            nickname: req.identity!.nickname,
            avatar: req.identity!.avatar,
          },
        });
      }
      res.json({ status });
    }),
  );
  api.delete(
    '/friends/:id',
    requireAuth,
    wrap(async (req, res) => {
      await needFriends(req).remove(req.identity!.id, String(req.params.id));
      res.json({ status: null });
    }),
  );
  api.post(
    '/friends/:id/invite',
    requireAuth,
    inviteLimiter,
    wrap(async (req, res) => {
      const repo = needFriends(req);
      const target = String(req.params.id);
      if ((await repo.relation(req.identity!.id, target)) !== 'friend')
        throw new AppError('FORBIDDEN', 'Só dá para convidar amigos', 403);
      const room = rooms.roomOf(req.identity!.id);
      if (!room) throw new AppError('INVALID_STATE', 'Entre numa sala para convidar', 409);
      const delivered = presence?.emitToUser(target, EVENTS.INVITE, {
        kind: 'room',
        from: {
          id: req.identity!.id,
          nickname: req.identity!.nickname,
          avatar: req.identity!.avatar,
        },
        room: { code: room.code, name: room.settings.name, gameId: room.settings.gameId },
      });
      if (!delivered) throw new AppError('INVALID_STATE', 'Seu amigo não está online agora', 409);
      res.json({ ok: true });
    }),
  );
  api.get(
    '/users',
    requireAuth,
    wrap(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q.length < 2 || !friends) return res.json([]);
      res.json(await friends.search(q.slice(0, 20), req.identity!.id, 10));
    }),
  );

  // perfil público de um jogador
  api.get(
    '/users/:id',
    wrap(async (req, res) => {
      if (!users) throw new AppError('NOT_FOUND', 'Perfis indisponíveis', 404);
      const u = await users.findById(String(req.params.id));
      if (!u || u.banned) throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
      res.json({
        user: toIdentity(u),
        createdAt: u.createdAt,
        stats: await users.stats(u.id),
        progress: progress ? await progress.profile(u.id) : null,
        history: (await matches.historyFor(u.id, 8)).map((h) => ({ ...h, matchId: undefined })),
      });
    }),
  );

  api.get(
    '/me/history',
    requireAuth,
    wrap(async (req, res) => {
      if (req.identity!.isGuest) return res.json([]);
      res.json(await matches.historyFor(req.identity!.id, 30));
    }),
  );

  app.use('/api', api);
  app.use('/api', (_req, _res, next) =>
    next(new AppError('NOT_FOUND', 'Rota não encontrada', 404)),
  );

  // Em produção o servidor também entrega o front-end compilado.
  // O caminho é relativo a este arquivo, então funciona qualquer que seja a pasta de onde o
  // processo foi iniciado (a Hostinger, por exemplo, inicia pela raiz do projeto).
  const webDist = env.WEB_DIST_DIR ?? fileURLToPath(new URL('../../../web/dist', import.meta.url));
  if (isProd && existsSync(webDist)) {
    // arquivos com hash no nome podem ficar em cache por muito tempo; o index.html, nunca
    app.use(
      '/assets',
      express.static(path.join(webDist, 'assets'), { maxAge: '365d', immutable: true }),
    );
    app.use(
      express.static(webDist, {
        maxAge: '1h',
        index: false,
        // o service worker e o tema precisam ser conferidos sempre, para o app atualizar sozinho
        setHeaders: (res, file) => {
          if (/(sw|theme)\.js$|\.webmanifest$/.test(file))
            res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    const template = readFileSync(path.join(webDist, 'index.html'), 'utf8');
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(withPreview(template, previewFor(req.path, req)));
    });
  } else if (isProd) {
    logger.warn({ webDist }, 'front-end compilado não encontrado; rode npm run build');
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = statusOf(err);
    if (status >= 500) logger.error({ err: String(err) }, 'erro http');
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

const escapeHtml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

interface Preview {
  title: string;
  description: string;
  url: string;
  image: string;
}

/** Prévia do link (WhatsApp, Telegram, Discord…) conforme a página. */
export function previewFor(pathname: string, req: Request): Preview {
  const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
  const base: Preview = {
    title: 'PartyVerse — jogos para jogar com os amigos',
    description:
      'Adedonha, Impostor, Quiz, desenho e mímica: crie uma sala grátis e chame a galera pelo navegador.',
    url: origin + pathname,
    image: `${origin}/og.png`,
  };
  const room = /^\/sala\/([A-Za-z0-9]{6})\/?$/.exec(pathname);
  if (room) {
    return {
      ...base,
      title: `🎉 Entre na minha sala do PartyVerse! Código ${room[1]!.toUpperCase()}`,
      description: 'Toque no link, escolha um apelido e jogue. Não precisa instalar nada.',
    };
  }
  const game = /^\/jogos\/([a-z-]+)\/?$/.exec(pathname);
  const slug = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  const meta = game
    ? GAME_CATALOG.find((g) => g.id === game[1] || slug(g.name) === game[1])
    : undefined;
  if (meta) return { ...base, title: `${meta.name} — PartyVerse`, description: meta.tagline };
  return base;
}

export function withPreview(html: string, p: Preview) {
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
