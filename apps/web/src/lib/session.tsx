import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Identity } from './api';
import { resetSocket } from './socket';

interface SessionCtx {
  user: Identity | null;
  /** pode abrir o painel /admin */
  admin: boolean;
  loading: boolean;
  setUser: (u: Identity | null) => void;
  guest: (nickname: string, avatar?: string) => Promise<Identity>;
  login: (email: string, password: string) => Promise<Identity>;
  register: (
    email: string,
    password: string,
    nickname: string,
    avatar?: string,
  ) => Promise<Identity>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    setAdmin(false);
    if (!user || user.isGuest) return;
    api<{ admin?: boolean }>('/auth/me')
      .then((r) => setAdmin(Boolean(r.admin)))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    api<{ user: Identity }>('/auth/me')
      .then((r) => setUserState(r.user))
      .catch(() => setUserState(null))
      .finally(() => setLoading(false));
  }, []);

  const setUser = useCallback((u: Identity | null) => {
    resetSocket(); // nova identidade => nova conexão
    setUserState(u);
  }, []);

  const wrap = (p: Promise<{ user: Identity }>) =>
    p.then((r) => {
      setUser(r.user);
      return r.user;
    });

  const value: SessionCtx = {
    user,
    admin,
    loading,
    setUser,
    guest: (nickname, avatar) =>
      wrap(api('/auth/guest', { method: 'POST', json: { nickname, avatar } })),
    login: (email, password) =>
      wrap(api('/auth/login', { method: 'POST', json: { email, password } })),
    register: (email, password, nickname, avatar) =>
      wrap(api('/auth/register', { method: 'POST', json: { email, password, nickname, avatar } })),
    logout: async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession fora do provider');
  return c;
}
