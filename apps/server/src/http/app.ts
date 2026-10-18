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
import { corsOrigins, type Env } from '../config/env.js';
import { AppError, statusOf, toServerError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { AuthService, toIdentity } from '../modules/auth/auth.service.js';
import { TOKEN_COOKIE, TokenService, type Identity } from '../modules/auth/token.js';
import type { MatchRepository } from '../modules/matches/match.repository.js';
import type { UserRepository } from '../modules/users/users.repository.js';
import type { RoomManager } from '../rooms/RoomManager.js';

export interface AppDeps {
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

export function createApp({ env, tokens, users, matches, rooms }: AppDeps) {
  const app = express();
  const auth = new AuthService(users);
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
      secure: isProd,
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

  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.get('/games', (_req, res) => res.json(GAME_CATALOG));
  api.get('/stats', (_req, res) => res.json({ online: rooms.onlineCount, rooms: rooms.size }));
  api.get('/rooms', (_req, res) => res.json(rooms.listPublic()));
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
      const { nickname } = guestSchema.parse(req.body);
      const id = auth.guest(nickname);
      setSession(res, id);
      res.json({ user: id });
    }),
  );
  api.post(
    '/auth/register',
    authLimiter,
    wrap(async (req, res) => {
      const { email, password, nickname } = registerSchema.parse(req.body);
      const id = await auth.register(email, password, nickname);
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

  // Em produção o servidor também entrega o front-end compilado
  const webDist = env.WEB_DIST_DIR ?? path.resolve(process.cwd(), '../web/dist');
  if (isProd && existsSync(webDist)) {
    app.use(express.static(webDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = statusOf(err);
    if (status >= 500) logger.error({ err: String(err) }, 'erro http');
    res.status(status).json({ error: toServerError(err) });
  });

  return app;
}
