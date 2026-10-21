import { useEffect, useState } from 'react';
import { api } from './api';

export interface Health {
  ok: boolean;
  db: string;
  accounts: boolean;
  dbHint: string | null;
  google: boolean;
  mail?: boolean;
  ai?: boolean;
  push?: boolean;
  iceServers?: RTCIceServer[];
}

let cached: Promise<Health | null> | null = null;
/** Recursos ligados no servidor (Google, e-mail, IA…). Busca uma vez por página. */
export function useHealth() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    cached ??= api<Health>('/health', { timeoutMs: 8000 }).catch(() => null);
    void cached.then(setH);
  }, []);
  return h;
}
