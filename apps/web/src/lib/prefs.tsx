import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useSession } from './session';
import { setSoundEnabled } from './sound';

export interface Prefs {
  sound: boolean;
  reducedMotion: boolean;
}

const KEY = 'pv:prefs';
const DEFAULTS: Prefs = { sound: true, reducedMotion: false };

function readLocal(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function writeLocal(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* modo privado: tudo bem, vale só nesta aba */
  }
}

interface PrefsCtx {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => Promise<void>;
}

const Ctx = createContext<PrefsCtx>({ prefs: DEFAULTS, setPref: async () => undefined });

/**
 * Preferências de som e animação. Ficam neste navegador (inclusive para convidados) e,
 * em contas registradas, também no servidor — assim acompanham a pessoa em outro aparelho.
 */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [prefs, setPrefs] = useState<Prefs>(readLocal);

  // conta registrada: o que está salvo no servidor prevalece
  useEffect(() => {
    if (!user || user.isGuest) return;
    api<{ preferences?: Partial<Prefs> }>('/me/profile')
      .then((r) => {
        const server = r.preferences ?? {};
        setPrefs((p) => {
          const next = {
            ...p,
            ...(typeof server.sound === 'boolean' ? { sound: server.sound } : {}),
            ...(typeof server.reducedMotion === 'boolean'
              ? { reducedMotion: server.reducedMotion }
              : {}),
          };
          writeLocal(next);
          return next;
        });
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    setSoundEnabled(prefs.sound);
    document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion);
  }, [prefs]);

  const setPref = useCallback<PrefsCtx['setPref']>(
    async (key, value) => {
      setPrefs((p) => {
        const next = { ...p, [key]: value };
        writeLocal(next);
        return next;
      });
      if (user && !user.isGuest) {
        await api('/me/profile', {
          method: 'PATCH',
          json: { preferences: { [key]: value } },
        }).catch(() => undefined);
      }
    },
    [user],
  );

  return <Ctx.Provider value={{ prefs, setPref }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);

/** true se o sistema ou a preferência pedem menos movimento. */
export function useReducedMotion() {
  const { prefs } = usePrefs();
  const [system, setSystem] = useState(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSystem(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return prefs.reducedMotion || system;
}
