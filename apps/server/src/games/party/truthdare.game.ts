import {
  truthDareActionSchema,
  truthDareSettingsSchema,
  type TruthDareAction,
  type TruthDareSettings,
  type TruthDareView,
} from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import type { GameContext, GameModule } from '../GameModule.js';
import { DARES, TRUTHS } from './prompts.js';
import { deck, maxBy, shuffle } from './util.js';

const CHOOSE = 15;
const JUDGE = 15;
const RESULT = 5;
export const TRUTH_DARE_POINTS = { truth: 100, dare: 150 };

export interface TruthDareState {
  settings: TruthDareSettings;
  players: string[];
  order: string[];
  turn: number;
  phase: TruthDareView['phase'];
  deadline: number | null;
  pick: 'truth' | 'dare' | null;
  card: string | null;
  judges: Record<string, boolean>;
  totals: Record<string, number>;
  result: TruthDareView['result'];
  truths: string[];
  dares: string[];
}

const current = (s: TruthDareState) => s.order[s.turn - 1] ?? null;

function setPhase(s: TruthDareState, ctx: GameContext, p: TruthDareView['phase'], secs: number) {
  s.phase = p;
  s.deadline = ctx.now() + secs * 1000;
  ctx.setTimer('phase', secs * 1000, () => truthDareGame.advancePhase(s, ctx));
  ctx.sync();
}

function nextTurn(s: TruthDareState, ctx: GameContext) {
  // pula quem saiu ou caiu
  while (s.turn < s.order.length) {
    s.turn += 1;
    const id = current(s)!;
    if (!ctx.isOnline(id)) continue;
    s.pick = null;
    s.card = null;
    s.judges = {};
    s.result = null;
    ctx.notice(`Vez de ${ctx.nickname(id)}: verdade ou desafio?`);
    return setPhase(s, ctx, 'choose', CHOOSE);
  }
  s.phase = 'finished';
  s.deadline = null;
  ctx.clearTimer('phase');
  ctx.sync();
  ctx.finish();
}

function choose(s: TruthDareState, ctx: GameContext, pick: 'truth' | 'dare') {
  const list = pick === 'truth' ? s.truths : s.dares;
  s.pick = pick;
  s.card = list.shift() ?? (pick === 'truth' ? TRUTHS : DARES)[randomInt(TRUTHS.length)]!;
  list.push(s.card); // volta para o fim do baralho
  setPhase(s, ctx, 'perform', s.settings.performSeconds);
}

function finishTurn(s: TruthDareState, ctx: GameContext, skipped: boolean) {
  const values = Object.values(s.judges);
  const yes = values.filter(Boolean).length;
  const no = values.length - yes;
  const ok = !skipped && yes >= no;
  const gained = ok ? TRUTH_DARE_POINTS[s.pick ?? 'truth'] : 0;
  const id = current(s)!;
  s.totals[id] = (s.totals[id] ?? 0) + gained;
  s.result = { ok, yes, no, gained, skipped };
  ctx.notice(
    skipped
      ? `${ctx.nickname(id)} passou a vez 🐔`
      : ok
        ? `✅ ${ctx.nickname(id)} cumpriu! +${gained}`
        : `❌ A galera achou que ${ctx.nickname(id)} não cumpriu`,
  );
  setPhase(s, ctx, 'result', RESULT);
}

function judgesDone(s: TruthDareState, ctx: GameContext) {
  const others = s.players.filter((p) => p !== current(s) && ctx.isOnline(p));
  return others.every((p) => p in s.judges);
}

export const truthDareGame: GameModule<TruthDareState, TruthDareSettings, TruthDareAction> = {
  id: 'truthdare',
  minPlayers: 2,
  settingsSchema: truthDareSettingsSchema,
  defaultSettings: () => ({
    turnsPerPlayer: 1,
    performSeconds: 60,
    customTruths: [],
    customDares: [],
    onlyCustom: false,
  }),

  createInitialState(players, settings) {
    const ids = players.map((p) => p.id);
    const order: string[] = [];
    for (let i = 0; i < settings.turnsPerPlayer; i++) order.push(...shuffle(ids));
    return {
      settings,
      players: ids,
      order,
      turn: 0,
      phase: 'choose',
      deadline: null,
      pick: null,
      card: null,
      judges: {},
      totals: Object.fromEntries(ids.map((p) => [p, 0])),
      result: null,
      truths: deck(TRUTHS, settings.customTruths, settings.onlyCustom),
      dares: deck(DARES, settings.customDares, settings.onlyCustom),
    };
  },

  startRound(s, ctx) {
    ctx.notice('Verdade ou Desafio! Nada de pegar pesado: é para todo mundo se divertir.');
    nextTurn(s, ctx);
  },

  validateAction(s, playerId, raw) {
    const a = truthDareActionSchema.parse(raw);
    if (!s.players.includes(playerId))
      throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
    const mine = current(s) === playerId;
    switch (a.type) {
      case 'choose':
        if (!mine || s.phase !== 'choose') throw invalidState('Não é sua vez de escolher');
        break;
      case 'done':
      case 'skip':
        if (!mine || s.phase !== 'perform') throw invalidState('Agora não');
        break;
      case 'judge':
        if (mine) throw invalidState('Você não pode julgar a si mesmo');
        if (s.phase !== 'judge' && s.phase !== 'perform')
          throw invalidState('Espere a sua vez de julgar');
        break;
    }
    return a;
  },

  processAction(s, playerId, a, ctx) {
    switch (a.type) {
      case 'choose':
        return choose(s, ctx, a.pick);
      case 'done':
        return setPhase(s, ctx, 'judge', JUDGE);
      case 'skip':
        return finishTurn(s, ctx, true);
      case 'judge':
        s.judges[playerId] = a.ok;
        if (s.phase === 'judge' && judgesDone(s, ctx)) {
          ctx.clearTimer('phase');
          return finishTurn(s, ctx, false);
        }
        return ctx.sync();
    }
  },

  advancePhase(s, ctx) {
    switch (s.phase) {
      case 'choose':
        return choose(s, ctx, randomInt(2) ? 'truth' : 'dare');
      case 'perform':
        return setPhase(s, ctx, 'judge', JUDGE);
      case 'judge':
        return finishTurn(s, ctx, false);
      case 'result':
        return nextTurn(s, ctx);
      case 'finished':
        return;
    }
  },

  calculateScores: (s) => ({ ...s.totals }),
  determineWinners: (s) => maxBy(s.totals, s.players),
  finalize: (s) => ({ rounds: s.turn }),
  isParticipant: (s, id) => s.players.includes(id),

  onPlayerLeft(s, id, ctx) {
    if (id === current(s) && (s.phase === 'choose' || s.phase === 'perform')) {
      ctx.clearTimer('phase');
      return finishTurn(s, ctx, true);
    }
    if (s.phase === 'judge' && judgesDone(s, ctx)) {
      ctx.clearTimer('phase');
      finishTurn(s, ctx, false);
    }
  },

  viewFor(s, playerId): TruthDareView {
    return {
      phase: s.phase,
      turn: s.turn,
      totalTurns: s.order.length,
      deadline: s.deadline,
      participants: [...s.players],
      currentId: current(s),
      pick: s.pick,
      card: s.card,
      judgedPlayers: Object.keys(s.judges),
      myJudge: playerId ? (s.judges[playerId] ?? null) : null,
      totals: { ...s.totals },
      result: s.phase === 'result' || s.phase === 'finished' ? s.result : null,
    };
  },
};
