import {
  quizActionSchema,
  quizSettingsSchema,
  type QuizAction,
  type QuizSettings,
  type QuizView,
} from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import type { GameContext, GameModule, GamePlayer } from '../GameModule.js';
import { QUIZ_CATEGORY_LABELS, QUIZ_QUESTIONS, type QuizQuestion } from './quiz.questions.js';

const COUNTDOWN_SECONDS = 3;
const REVEAL_SECONDS = 6;

/** Acerto vale BASE + até SPEED pela rapidez; sequência de 3+ acertos dá STREAK extra. */
export const QUIZ_POINTS = { base: 500, speed: 500, streak: 100 };

interface Prepared {
  text: string;
  options: string[];
  correct: number;
  category: string;
  fact: string | null;
}

export interface QuizState {
  settings: QuizSettings;
  players: string[];
  phase: QuizView['phase'];
  index: number;
  deadline: number | null;
  questionStartedAt: number;
  questions: Prepared[];
  answers: Record<string, { option: number; at: number }>;
  gained: Record<string, number>;
  totals: Record<string, number>;
  streaks: Record<string, number>;
  maxStreaks: Record<string, number>;
}

const shuffle = <T>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

function prepare(q: QuizQuestion): Prepared {
  const options = shuffle([q.a, ...q.w]);
  return {
    text: q.q,
    options,
    correct: options.indexOf(q.a),
    category: QUIZ_CATEGORY_LABELS[q.c],
    fact: q.f ?? null,
  };
}

export function pickQuestions(settings: QuizSettings, bank = QUIZ_QUESTIONS): Prepared[] {
  const pool = settings.category === 'misto' ? bank : bank.filter((q) => q.c === settings.category);
  return shuffle(pool).slice(0, settings.questions).map(prepare);
}

/** Pontos de um acerto, dado o tempo gasto (ms) e o limite (ms). */
export function speedPoints(elapsedMs: number, limitMs: number): number {
  const frac = Math.min(1, Math.max(0, 1 - elapsedMs / limitMs));
  return QUIZ_POINTS.base + Math.round(QUIZ_POINTS.speed * frac);
}

function phase(s: QuizState, ctx: GameContext, p: QuizView['phase'], secs: number) {
  s.phase = p;
  s.deadline = ctx.now() + secs * 1000;
  ctx.setTimer('phase', secs * 1000, () => quizGame.advancePhase(s, ctx));
  ctx.sync();
}

function reveal(s: QuizState, ctx: GameContext) {
  const q = s.questions[s.index]!;
  const limit = s.settings.secondsPerQuestion * 1000;
  s.gained = {};
  for (const p of s.players) {
    const a = s.answers[p];
    if (a && a.option === q.correct) {
      s.streaks[p] = (s.streaks[p] ?? 0) + 1;
      s.maxStreaks[p] = Math.max(s.maxStreaks[p] ?? 0, s.streaks[p]!);
      const bonus = s.streaks[p]! >= 3 ? QUIZ_POINTS.streak : 0;
      s.gained[p] = speedPoints(a.at - s.questionStartedAt, limit) + bonus;
    } else {
      s.streaks[p] = 0;
      s.gained[p] = 0;
    }
    s.totals[p] = (s.totals[p] ?? 0) + s.gained[p]!;
  }
  phase(s, ctx, 'reveal', REVEAL_SECONDS);
}

export const quizGame: GameModule<QuizState, QuizSettings, QuizAction> = {
  id: 'quiz',
  minPlayers: 2,
  settingsSchema: quizSettingsSchema,

  defaultSettings: () => ({ questions: 10, secondsPerQuestion: 15, category: 'misto' }),

  createInitialState(players: GamePlayer[], settings: QuizSettings): QuizState {
    const questions = pickQuestions(settings);
    return {
      settings: { ...settings, questions: questions.length },
      players: players.map((p) => p.id),
      phase: 'countdown',
      index: -1,
      deadline: null,
      questionStartedAt: 0,
      questions,
      answers: {},
      gained: {},
      totals: Object.fromEntries(players.map((p) => [p.id, 0])),
      streaks: Object.fromEntries(players.map((p) => [p.id, 0])),
      maxStreaks: {},
    };
  },

  startRound(s, ctx) {
    ctx.notice(`Quiz começando: ${s.questions.length} perguntas!`);
    phase(s, ctx, 'countdown', COUNTDOWN_SECONDS);
  },

  validateAction(s, playerId, raw) {
    const action = quizActionSchema.parse(raw);
    if (!s.players.includes(playerId))
      throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
    if (s.phase !== 'question') throw invalidState('Espere a próxima pergunta');
    if (s.answers[playerId]) throw invalidState('Você já respondeu esta pergunta');
    return action;
  },

  processAction(s, playerId, action, ctx) {
    s.answers[playerId] = { option: action.option, at: ctx.now() };
    const online = s.players.filter((p) => ctx.isOnline(p));
    if (online.every((p) => s.answers[p])) {
      ctx.clearTimer('phase');
      return reveal(s, ctx);
    }
    ctx.sync();
  },

  advancePhase(s, ctx) {
    switch (s.phase) {
      case 'countdown':
      case 'reveal':
        if (s.index + 1 >= s.questions.length) {
          s.phase = 'finished';
          s.deadline = null;
          ctx.clearTimer('phase');
          ctx.sync();
          return ctx.finish();
        }
        s.index += 1;
        s.answers = {};
        s.gained = {};
        s.questionStartedAt = ctx.now();
        return phase(s, ctx, 'question', s.settings.secondsPerQuestion);
      case 'question':
        return reveal(s, ctx);
      case 'finished':
        return;
    }
  },

  calculateScores: (s) => ({ ...s.totals }),

  determineWinners(s) {
    const max = Math.max(...s.players.map((p) => s.totals[p] ?? 0));
    return s.players.filter((p) => (s.totals[p] ?? 0) === max);
  },

  finalize: (s) => ({ rounds: Math.max(0, s.index + 1) }),

  highlights: (s) =>
    Object.fromEntries(s.players.map((p) => [p, { maxStreak: s.maxStreaks[p] ?? 0 }])),

  isParticipant: (s, playerId) => s.players.includes(playerId),

  onPlayerLeft(s, _playerId, ctx) {
    if (s.phase !== 'question') return;
    const online = s.players.filter((p) => ctx.isOnline(p));
    if (online.length > 0 && online.every((p) => s.answers[p])) {
      ctx.clearTimer('phase');
      reveal(s, ctx);
    }
  },

  viewFor(s, playerId): QuizView {
    const q = s.index >= 0 ? s.questions[s.index] : undefined;
    const showQ = q && (s.phase === 'question' || s.phase === 'reveal' || s.phase === 'finished');
    return {
      phase: s.phase,
      index: Math.max(0, s.index),
      total: s.questions.length,
      deadline: s.deadline,
      participants: [...s.players],
      question: showQ ? { text: q.text, options: [...q.options], category: q.category } : null,
      myAnswer: playerId ? (s.answers[playerId]?.option ?? null) : null,
      answeredPlayers: Object.keys(s.answers),
      totals: { ...s.totals },
      streaks: { ...s.streaks },
      reveal:
        q && (s.phase === 'reveal' || s.phase === 'finished')
          ? {
              correct: q.correct,
              answers: Object.fromEntries(Object.entries(s.answers).map(([p, a]) => [p, a.option])),
              gained: { ...s.gained },
              fact: q.fact,
            }
          : null,
    };
  },
};
