import { describe, expect, it, vi } from 'vitest';
import type { StopView } from '@partyverse/shared';
import { stopGame, type StopState } from '../src/games/stop/stop.game.js';
import type { GameContext } from '../src/games/GameModule.js';

function setup(n = 3) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const settings = {
    ...stopGame.defaultSettings(),
    categories: ['Nome', 'Animal'],
    rounds: 2,
    stopCountdownSeconds: 0,
  };
  const state = stopGame.createInitialState(players, settings);
  const timers = new Map<string, () => void>();
  const ctx: GameContext = {
    now: () => 1000,
    setTimer: (n, _ms, fn) => void timers.set(n, fn),
    clearTimer: (n) => void timers.delete(n),
    sync: vi.fn(),
    notice: vi.fn(),
    announce: vi.fn(),
    whisper: vi.fn(),
    chatTo: vi.fn(),
    emit: vi.fn(),
    nickname: (id: string) => id,
    isOnline: () => true,
    inRoom: () => true,
    finish: vi.fn(),
  };
  const act = (pid: string, a: unknown) =>
    stopGame.processAction(state, pid, stopGame.validateAction(state, pid, a), ctx);
  const fire = () => timers.get('phase')!();
  stopGame.startRound(state, ctx);
  return { state, ctx, act, fire };
}

const fill = (s: StopState) => ({ Nome: `${s.letter}ana`, Animal: `${s.letter}rara` });

describe('STOP — ciclo da partida', () => {
  it('sorteia letra válida e esconde respostas alheias antes da revisão', () => {
    const { state, act } = setup();
    expect(state.letter).toMatch(/^[A-Z]$/);
    act('p1', { type: 'answers', answers: fill(state) });
    const v2 = stopGame.viewFor(state, 'p2') as StopView;
    expect(v2.myAnswers).toEqual({});
    expect(v2.review).toEqual([]);
    expect(JSON.stringify(v2)).not.toContain(fill(state).Nome);
  });

  it('não permite STOP sem preencher tudo', () => {
    const { state, act } = setup();
    act('p1', { type: 'answers', answers: { Nome: `${state.letter}na` } });
    expect(() => act('p1', { type: 'stop' })).toThrow(/Preencha/);
  });

  it('STOP leva à revisão, votos decidem rejeição e pontuação acumula', () => {
    const { state, act, ctx } = setup();
    act('p1', { type: 'answers', answers: fill(state) });
    act('p2', { type: 'answers', answers: { Nome: `${state.letter}ana`, Animal: '' } });
    act('p1', { type: 'stop' });
    expect(state.phase).toBe('review');
    // respostas fora da fase de respostas são recusadas
    expect(() => act('p2', { type: 'answers', answers: { Animal: 'x' } })).toThrow();
    // não pode votar em si mesmo
    expect(() =>
      act('p1', { type: 'vote', targetId: 'p1', category: 'Nome', valid: false }),
    ).toThrow();
    // p2 e p3 rejeitam o Animal de p1 (votos repetidos não contam duas vezes)
    act('p2', { type: 'vote', targetId: 'p1', category: 'Animal', valid: false });
    act('p2', { type: 'vote', targetId: 'p1', category: 'Animal', valid: false });
    act('p3', { type: 'vote', targetId: 'p1', category: 'Animal', valid: false });
    for (const p of ['p1', 'p2', 'p3']) act(p, { type: 'ready' });
    expect(state.phase).toBe('round-results');
    expect(state.statuses!.p1).toEqual({ Nome: 'repeated', Animal: 'rejected' });
    expect(state.totals).toEqual({ p1: 5, p2: 5, p3: 0 });
    for (const p of ['p1', 'p2', 'p3']) act(p, { type: 'ready' });
    expect(state.round).toBe(2);
    expect(state.phase).toBe('answering');
    expect(ctx.finish).not.toHaveBeenCalled();
  });

  it('temporizador encerra rodadas e a partida termina após o total de rodadas', () => {
    const { state, fire, ctx } = setup(2);
    fire(); // fim do tempo -> revisão
    fire(); // fim da revisão -> resultados
    fire(); // -> rodada 2
    expect(state.round).toBe(2);
    expect(state.letter).not.toBe(state.usedLetters[0]);
    fire();
    fire();
    fire();
    expect(state.phase).toBe('finished');
    expect(ctx.finish).toHaveBeenCalledOnce();
  });

  it('espectador não pode agir', () => {
    const { state } = setup();
    expect(() => stopGame.validateAction(state, 'intruso', { type: 'stop' })).toThrow(/assistindo/);
  });

  it('cliente não consegue enviar pontuação', () => {
    const { state } = setup();
    expect(() => stopGame.validateAction(state, 'p1', { type: 'score', value: 999 })).toThrow();
  });
});
