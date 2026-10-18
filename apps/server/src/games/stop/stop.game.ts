import {
  stopActionSchema,
  stopSettingsSchema,
  type StopAction,
  type StopAnswerStatus,
  type StopSettings,
  type StopView,
} from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import { cleanText, normalize } from '../../lib/text.js';
import type { GameContext, GameModule, GamePlayer } from '../GameModule.js';
import { scoreRound, startsWithLetter } from './stop.scoring.js';

/** Letras com boa cobertura em português (sem K, Q, W, X, Y, Z). */
export const STOP_LETTERS = 'ABCDEFGHIJLMNOPRSTUV'.split('');
const ROUND_RESULTS_SECONDS = 12;

export interface StopState {
  settings: StopSettings;
  players: string[];
  phase: StopView['phase'];
  round: number;
  letter: string;
  usedLetters: string[];
  deadline: number | null;
  stoppedBy: string | null;
  answers: Record<string, Record<string, string>>;
  /** rejections[alvo][categoria] = ids de quem votou como inválida */
  rejections: Record<string, Record<string, string[]>>;
  ready: string[];
  roundScores: Record<string, Record<string, number>> | null;
  statuses: Record<string, Record<string, StopAnswerStatus>> | null;
  totals: Record<string, number>;
}

function drawLetter(used: string[]): string {
  const pool = STOP_LETTERS.filter((l) => !used.includes(l));
  const from = pool.length ? pool : STOP_LETTERS;
  return from[randomInt(from.length)]!;
}

function allFilled(state: StopState, playerId: string): boolean {
  const a = state.answers[playerId] ?? {};
  return state.settings.categories.every((c) => startsWithLetter(a[c] ?? '', state.letter));
}

function onlineVoters(state: StopState, ctx: GameContext, exclude?: string) {
  return state.players.filter((p) => p !== exclude && ctx.isOnline(p));
}

function isRejected(state: StopState, ctx: GameContext, target: string, cat: string): boolean {
  const votes = (state.rejections[target]?.[cat] ?? []).length;
  // maioria estrita dos demais jogadores online (mínimo 1 eleitor)
  const eligible = Math.max(1, onlineVoters(state, ctx, target).length);
  return votes * 2 > eligible;
}

function goToReview(state: StopState, ctx: GameContext) {
  state.phase = 'review';
  state.ready = [];
  state.rejections = Object.fromEntries(state.players.map((p) => [p, {}]));
  state.deadline = ctx.now() + state.settings.reviewSeconds * 1000;
  ctx.setTimer('phase', state.settings.reviewSeconds * 1000, () =>
    stopGame.advancePhase(state, ctx),
  );
  ctx.sync();
}

function goToRoundResults(state: StopState, ctx: GameContext) {
  const res = scoreRound({
    letter: state.letter,
    categories: state.settings.categories,
    players: state.players,
    answers: state.answers,
    isRejected: (p, c) => isRejected(state, ctx, p, c),
    points: state.settings.points,
  });
  state.roundScores = res.scores;
  state.statuses = res.statuses;
  for (const p of state.players) state.totals[p] = (state.totals[p] ?? 0) + (res.totals[p] ?? 0);
  state.phase = 'round-results';
  state.ready = [];
  state.deadline = ctx.now() + ROUND_RESULTS_SECONDS * 1000;
  ctx.setTimer('phase', ROUND_RESULTS_SECONDS * 1000, () => stopGame.advancePhase(state, ctx));
  ctx.sync();
}

function everyoneReady(state: StopState, ctx: GameContext) {
  const online = onlineVoters(state, ctx);
  return online.length > 0 && online.every((p) => state.ready.includes(p));
}

export const stopGame: GameModule<StopState, StopSettings, StopAction> = {
  id: 'stop',
  minPlayers: 2,
  settingsSchema: stopSettingsSchema,

  defaultSettings: () => ({
    categories: ['Nome', 'Animal', 'Cidade', 'Comida', 'Objeto', 'Profissão'],
    rounds: 3,
    roundSeconds: 90,
    reviewSeconds: 45,
    stopCountdownSeconds: 5,
    points: { unique: 10, repeated: 5, empty: 0, rejected: 0 },
  }),

  createInitialState(players: GamePlayer[], settings: StopSettings): StopState {
    // categorias duplicadas (ignorando acentos) quebrariam a pontuação
    const seen = new Set<string>();
    const categories = settings.categories.filter((c) => {
      const n = normalize(c);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    return {
      settings: { ...settings, categories },
      players: players.map((p) => p.id),
      phase: 'answering',
      round: 0,
      letter: '',
      usedLetters: [],
      deadline: null,
      stoppedBy: null,
      answers: {},
      rejections: {},
      ready: [],
      roundScores: null,
      statuses: null,
      totals: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
  },

  startRound(state, ctx) {
    state.round += 1;
    state.letter = drawLetter(state.usedLetters);
    state.usedLetters.push(state.letter);
    state.phase = 'answering';
    state.stoppedBy = null;
    state.answers = Object.fromEntries(state.players.map((p) => [p, {}]));
    state.rejections = {};
    state.ready = [];
    state.roundScores = null;
    state.statuses = null;
    state.deadline = ctx.now() + state.settings.roundSeconds * 1000;
    ctx.setTimer('phase', state.settings.roundSeconds * 1000, () =>
      stopGame.advancePhase(state, ctx),
    );
    ctx.notice(`Rodada ${state.round}: letra ${state.letter}!`);
    ctx.sync();
  },

  validateAction(state, playerId, raw) {
    const action = stopActionSchema.parse(raw);
    if (!state.players.includes(playerId))
      throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
    switch (action.type) {
      case 'answers':
        if (state.phase !== 'answering' && state.phase !== 'stopping')
          throw invalidState('O tempo de respostas acabou');
        break;
      case 'stop':
        if (state.phase !== 'answering') throw invalidState('A rodada já foi encerrada');
        break;
      case 'vote':
        if (state.phase !== 'review') throw invalidState('Não estamos na revisão');
        if (action.targetId === playerId)
          throw new AppError('FORBIDDEN', 'Você não pode votar nas próprias respostas', 403);
        if (!state.players.includes(action.targetId))
          throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
        if (!state.settings.categories.includes(action.category))
          throw new AppError('VALIDATION', 'Categoria inválida');
        break;
      case 'ready':
        if (state.phase !== 'review' && state.phase !== 'round-results')
          throw invalidState('Nada para confirmar agora');
        break;
    }
    return action;
  },

  processAction(state, playerId, action, ctx) {
    switch (action.type) {
      case 'answers': {
        const mine: Record<string, string> = {};
        for (const cat of state.settings.categories) {
          const v = action.answers[cat];
          mine[cat] =
            typeof v === 'string'
              ? cleanText(v).slice(0, 40)
              : (state.answers[playerId]?.[cat] ?? '');
        }
        state.answers[playerId] = mine;
        return; // não precisa sincronizar todos a cada tecla
      }
      case 'stop': {
        if (!allFilled(state, playerId)) {
          throw new AppError(
            'VALIDATION',
            `Preencha todas as categorias com a letra ${state.letter} para dar STOP`,
          );
        }
        state.stoppedBy = playerId;
        const secs = state.settings.stopCountdownSeconds;
        if (secs <= 0) return goToReview(state, ctx);
        state.phase = 'stopping';
        state.deadline = ctx.now() + secs * 1000;
        ctx.setTimer('phase', secs * 1000, () => stopGame.advancePhase(state, ctx));
        ctx.sync();
        return;
      }
      case 'vote': {
        const byCat = (state.rejections[action.targetId] ??= {});
        const voters = new Set(byCat[action.category] ?? []);
        if (action.valid) voters.delete(playerId);
        else voters.add(playerId); // conjunto: votos repetidos não somam
        byCat[action.category] = [...voters];
        ctx.sync();
        return;
      }
      case 'ready': {
        if (!state.ready.includes(playerId)) state.ready.push(playerId);
        if (everyoneReady(state, ctx)) stopGame.advancePhase(state, ctx);
        else ctx.sync();
        return;
      }
    }
  },

  advancePhase(state, ctx) {
    switch (state.phase) {
      case 'answering':
      case 'stopping':
        return goToReview(state, ctx);
      case 'review':
        return goToRoundResults(state, ctx);
      case 'round-results':
        if (state.round >= state.settings.rounds) {
          state.phase = 'finished';
          state.deadline = null;
          ctx.clearTimer('phase');
          ctx.sync();
          ctx.finish();
        } else {
          stopGame.startRound(state, ctx);
        }
        return;
      case 'finished':
        return;
    }
  },

  calculateScores: (state) => ({ ...state.totals }),

  determineWinners(state) {
    const max = Math.max(...state.players.map((p) => state.totals[p] ?? 0));
    return state.players.filter((p) => (state.totals[p] ?? 0) === max);
  },

  finalize: (state) => ({ rounds: state.round }),

  isParticipant: (state, playerId) => state.players.includes(playerId),

  onPlayerLeft(state, playerId, ctx) {
    // quem saiu deixa de bloquear o "todos prontos"
    if (
      (state.phase === 'review' || state.phase === 'round-results') &&
      everyoneReady(state, ctx)
    ) {
      stopGame.advancePhase(state, ctx);
    }
  },

  viewFor(state, playerId): StopView {
    const revealed =
      state.phase === 'review' || state.phase === 'round-results' || state.phase === 'finished';
    return {
      phase: state.phase,
      round: state.round,
      totalRounds: state.settings.rounds,
      letter: state.letter,
      categories: state.settings.categories,
      deadline: state.deadline,
      stoppedBy: state.stoppedBy,
      myAnswers: playerId ? { ...(state.answers[playerId] ?? {}) } : {},
      review: revealed
        ? state.players.map((p) => ({
            playerId: p,
            answers: { ...(state.answers[p] ?? {}) },
            rejections: Object.fromEntries(
              state.settings.categories.map((c) => [c, (state.rejections[p]?.[c] ?? []).length]),
            ),
            myRejections: playerId
              ? state.settings.categories.filter((c) =>
                  (state.rejections[p]?.[c] ?? []).includes(playerId),
                )
              : [],
            statuses: state.statuses?.[p] ?? null,
          }))
        : [],
      roundScores: state.phase === 'review' ? null : state.roundScores,
      totals: { ...state.totals },
      readyPlayers: [...state.ready],
      participants: [...state.players],
    };
  },
};
