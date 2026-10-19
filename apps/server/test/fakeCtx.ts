import { vi } from 'vitest';
import type { GameContext } from '../src/games/GameModule.js';

/** Contexto de jogo falso para testes unitários: temporizadores manuais e relógio controlável. */
export function fakeCtx(opts: { now?: () => number; offline?: Set<string> } = {}) {
  const timers = new Map<string, () => void>();
  const offline = opts.offline ?? new Set<string>();
  const ctx = {
    now: opts.now ?? (() => 1000),
    setTimer: (k: string, _ms: number, fn: () => void) => void timers.set(k, fn),
    clearTimer: (k: string) => void timers.delete(k),
    sync: vi.fn(),
    notice: vi.fn(),
    announce: vi.fn(),
    whisper: vi.fn(),
    chatTo: vi.fn(),
    emit: vi.fn(),
    nickname: (id: string) => id.toUpperCase(),
    isOnline: (id: string) => !offline.has(id),
    finish: vi.fn(),
  } satisfies GameContext;
  return { ctx, timers, offline };
}
