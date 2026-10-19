import {
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
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corsOrigins, type Env } from '../config/env.js';
import { dbStatus } from '../db/status.js';
import { AppError, statusOf, toServerError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { AuthService, toIdentity } from '../modules/auth/auth.service.js';
import { GoogleAuth, safeReturnPath } from '../modules/auth/google.js';
import { TOKEN_COOKIE, TokenService, type Identity } from '../modules/auth/token.js';
import type { MatchRepository } from '../modules/matches/match.repository.js';
import type { UserRepository } from '../modules/users/users.repository.js';
import type { RoomManager } from '../rooms/RoomManager.js';

export interface AppDeps {
  google?: GoogleAuth;
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

export function createApp({ env, tokens, users, matches, rooms, google: googleDep }: AppDeps) {
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

  const requireAuth = (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const token =
      req.cookies?.[TOKEN_COOKIE] ?? req.header('authorization')?.replace(/^Bearer /, '');
    const id = token ? tokens.verify(token) : null;
    if (!id) return next(new AppError('UNAUTHORIZED', 'Faça login para continuar', 401));
    req.identity = id;
    next();
  };

  const api = express.Router();

  api.get('/health', (_req, res) =>
    res.json({
      ok: true,
      db: users ? dbStatus.state : 'off',
      accounts: Boolean(users) && dbStatus.state !== 'error',
      google: google.enabled,
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
      const key = gameId ?? 'all';
      const hit = boardCache.get(key);
      if (hit && Date.now() - hit.at < 30_000) return res.json(hit.data);
      const data = {
        enabled: Boolean(users),
        rows: users ? await matches.leaderboard(gameId, 50) : [],
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
        const id = await auth.google(profile, saved.avatar || undefined);
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
    wrap((req, res) => res.json({ user: req.identity })),
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
      });
    }),
  );
  api.patch(
    '/me/profile',
    requireAuth,
    wrap(async (req, res) => {
      const data = profileUpdateSchema.parse(req.body);
      const id = req.identity!;
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
    app.use(express.static(webDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(webDist, 'index.html'));
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
