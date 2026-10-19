import { describe, expect, it, vi } from 'vitest';
import type { QuizView } from '@partyverse/shared';
import { QUIZ_POINTS, quizGame, speedPoints } from '../src/games/quiz/quiz.game.js';
import { QUIZ_QUESTIONS } from '../src/games/quiz/quiz.questions.js';
import type { GameContext } from '../src/games/GameModule.js';

function setup(n = 3, questions = 5) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const state = quizGame.createInitialState(players, {
    ...quizGame.defaultSettings(),
    questions,
  });
  let now = 1000;
  const timers = new Map<string, () => void>();
  const ctx: GameContext = {
    now: () => now,
    setTimer: (k, _ms, fn) => void timers.set(k, fn),
    clearTimer: (k) => void timers.delete(k),
    sync: vi.fn(),
    notice: vi.fn(),
    announce: vi.fn(),
    whisper: vi.fn(),
    chatTo: vi.fn(),
    emit: vi.fn(),
    nickname: (id: string) => id,
    isOnline: () => true,
    finish: vi.fn(),
  };
  const act = (pid: string, a: unknown) =>
    quizGame.processAction(state, pid, quizGame.validateAction(state, pid, a), ctx);
  const fire = () => timers.get('phase')!();
  const tick = (ms: number) => (now += ms);
  quizGame.startRound(state, ctx);
  return { state, ctx, act, fire, tick };
}

describe('Quiz', () => {
  it('banco de perguntas é consistente', () => {
    for (const q of QUIZ_QUESTIONS) {
      const opts = [q.a, ...q.w];
      expect(new Set(opts).size, q.q).toBe(4);
    }
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.q)).size).toBe(QUIZ_QUESTIONS.length);
  });

  it('não revela a resposta certa antes do fim da pergunta', () => {
    const { state, fire } = setup();
    expect((quizGame.viewFor(state, 'p1') as QuizView).question).toBeNull(); // contagem
    fire();
    const v = quizGame.viewFor(state, 'p1') as QuizView;
    expect(v.phase).toBe('question');
    expect(v.question!.options).toHaveLength(4);
    expect(v.reveal).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/correct/);
  });

  it('quem responde mais rápido ganha mais; erro vale zero; não pode trocar resposta', () => {
    const { state, act, fire, tick } = setup();
    fire();
    const right = state.questions[0]!.correct;
    const wrong = (right + 1) % 4;
    act('p1', { type: 'answer', option: right });
    expect(() => act('p1', { type: 'answer', option: wrong })).toThrow(/já respondeu/);
    tick(5000);
    act('p2', { type: 'answer', option: right });
    act('p3', { type: 'answer', option: wrong });
    // todos responderam: revela na hora
    expect(state.phase).toBe('reveal');
    expect(state.gained.p1).toBe(QUIZ_POINTS.base + QUIZ_POINTS.speed);
    expect(state.gained.p2!).toBeLessThan(state.gained.p1!);
    expect(state.gained.p2!).toBeGreaterThan(QUIZ_POINTS.base);
    expect(state.gained.p3).toBe(0);
  });

  it('bônus de sequência a partir do 3º acerto seguido e fim após a última pergunta', () => {
    const { state, act, fire, ctx } = setup(2, 5);
    fire();
    for (let i = 0; i < 3; i++) {
      act('p1', { type: 'answer', option: state.questions[i]!.correct });
      act('p2', { type: 'answer', option: (state.questions[i]!.correct + 1) % 4 });
      if (i < 2) fire(); // reveal -> próxima pergunta
    }
    expect(state.gained.p1).toBe(QUIZ_POINTS.base + QUIZ_POINTS.speed + QUIZ_POINTS.streak);
    expect(state.streaks.p2).toBe(0);
    fire(); // -> pergunta 4
    fire(); // tempo esgotado -> reveal
    fire(); // -> pergunta 5
    fire();
    fire(); // -> fim
    expect(state.phase).toBe('finished');
    expect(ctx.finish).toHaveBeenCalledOnce();
  });

  it('pontuação por velocidade fica entre base e base+speed', () => {
    expect(speedPoints(0, 10_000)).toBe(QUIZ_POINTS.base + QUIZ_POINTS.speed);
    expect(speedPoints(10_000, 10_000)).toBe(QUIZ_POINTS.base);
    expect(speedPoints(99_000, 10_000)).toBe(QUIZ_POINTS.base);
  });

  it('espectador não responde', () => {
    const { state, fire } = setup();
    fire();
    expect(() => quizGame.validateAction(state, 'x', { type: 'answer', option: 0 })).toThrow(
      /assistindo/,
    );
  });
});
