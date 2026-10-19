import type { AddressInfo } from 'node:net';
import { io as ioc, type Socket } from 'socket.io-client';
import { loadEnv } from '../src/config/env.js';
import { MemoryMatchRepository } from '../src/modules/matches/match.repository.js';
import { MemoryUserRepository } from '../src/modules/users/users.repository.js';
import { buildServer } from '../src/server.js';
import type { GoogleAuth } from '../src/modules/auth/google.js';
import { MemoryMailer, type Mailer } from '../src/modules/mail/mailer.js';

export async function startTestServer(
  overrides: Record<string, unknown> = {},
  opts: { google?: GoogleAuth; mailer?: Mailer } = {},
) {
  const env = loadEnv({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-1234567890',
    DATABASE_URL: undefined,
    RECONNECT_GRACE_MS: 300,
    ...overrides,
  });
  const users = new MemoryUserRepository();
  const matches = new MemoryMatchRepository();
  const mailer = opts.mailer ?? new MemoryMailer();
  const srv = buildServer(env, { users, matches, google: opts.google, mailer });
  await new Promise<void>((r) => srv.httpServer.listen(0, r));
  const url = `http://localhost:${(srv.httpServer.address() as AddressInfo).port}`;
  const sockets: Socket[] = [];

  let n = 0;
  const player = async (nickname = `Jogador${++n}`, id?: string, isGuest = true) => {
    const identity = { id: id ?? `g_test_${nickname}`, nickname, avatar: 'blob-1', isGuest };
    const token = srv.tokens.sign(identity);
    const s = ioc(url, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(s);
    await new Promise<void>((res, rej) => {
      s.once('connect', () => res());
      s.once('connect_error', rej);
    });
    return { socket: s, identity, token };
  };

  const close = async () => {
    for (const s of sockets) s.disconnect();
    await srv.close();
  };
  return { ...srv, url, users, matches, player, close, mailer: mailer as MemoryMailer };
}

export function emit<T = unknown>(
  s: Socket,
  event: string,
  payload: unknown = {},
): Promise<{ ok: boolean; data?: T; error?: { code: string; message: string } }> {
  return new Promise((res) => s.emit(event, payload, res));
}

export function next<T = unknown>(
  s: Socket,
  event: string,
  pred: (d: T) => boolean = () => true,
  ms = 3000,
): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => {
      s.off(event, h);
      rej(new Error(`timeout esperando ${event}`));
    }, ms);
    const h = (d: T) => {
      if (pred(d)) {
        clearTimeout(t);
        s.off(event, h);
        res(d);
      }
    };
    s.on(event, h);
  });
}

export const roomSettings = (o: Record<string, unknown> = {}) => ({
  name: 'Sala Teste',
  gameId: 'stop',
  isPublic: true,
  maxPlayers: 8,
  ...o,
});
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
