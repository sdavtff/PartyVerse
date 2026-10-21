import { useEffect, useState } from 'react';
import type { ProgressData } from '../components/Progress';
import { api } from './api';
import { useSession } from './session';

export interface MyProfile {
  stats: { matchesPlayed: number; wins: number; totalScore: number; bestScore: number } | null;
  progress: ProgressData | null;
}

let cache: { id: string; at: number; p: Promise<MyProfile | null> } | null = null;
const listeners = new Set<() => void>();

/** Nível, XP, moedas e estatísticas da conta (com cache curto, compartilhado entre telas). */
export function useMyProfile(): MyProfile | null {
  const { user } = useSession();
  const [data, setData] = useState<MyProfile | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  useEffect(() => {
    if (!user || user.isGuest) {
      setData(null);
      return;
    }
    if (!cache || cache.id !== user.id || Date.now() - cache.at > 30_000)
      cache = {
        id: user.id,
        at: Date.now(),
        p: api<MyProfile>('/me/profile').catch(() => null),
      };
    let alive = true;
    void cache.p.then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [user, tick]);
  return data;
}

/** Força recarregar (ex.: depois de ganhar XP ou comprar algo). */
export function refreshMyProfile() {
  cache = null;
  listeners.forEach((fn) => fn());
}
