import {
  telephoneActionSchema,
  telephoneSettingsSchema,
  type DrawOp,
  type TelephoneAction,
  type TelephoneEntry,
  type TelephoneSettings,
  type TelephoneView,
} from '@partyverse/shared';
import { AppError, invalidState } from '../../lib/errors.js';
import { cleanText } from '../../lib/text.js';
import { maskProfanity } from '../../modules/moderation/profanity.js';
import type { GameContext, GameModule } from '../GameModule.js';
import { maxBy, shuffle } from '../party/util.js';

const MAX_ITEMS = 1500;
const MAX_POINTS = 40_000;
const PAGE_SECONDS = 7;
export const TELEPHONE_POINTS = { entry: 5, like: 10 };

type Item = Exclude<DrawOp, { t: 'a' } | { t: 'u' } | { t: 'clear' }>;
interface Draft {
  text: string | null;
  items: Item[];
  points: number;
}

export interface TelephoneState {
  settings: TelephoneSettings;
  players: string[];
  steps: number;
  step: number;
  phase: TelephoneView['phase'];
  deadline: number | null;
  books: TelephoneEntry[][];
  drafts: Record<string, Draft>;
  done: string[];
  likes: Record<string, string[]>; // "livro:pagina" -> quem curtiu
  revealBook: number;
  revealShown: number;
}

const kindOf = (step: number): 'write' | 'draw' | 'describe' =>
  step === 0 ? 'write' : step % 2 === 1 ? 'draw' : 'describe';
/** No passo k, o jogador i cuida do caderno (i - k) mod n. */
const bookOf = (s: TelephoneState, playerIdx: number) =>
  (playerIdx - s.step + s.players.length * 20) % s.players.length;

const emptyDraft = (): Draft => ({ text: null, items: [], points: 0 });

function applyDraw(d: Draft, ops: DrawOp[]) {
  for (const op of ops) {
    if (op.t === 'clear') {
      d.items = [];
      d.points = 0;
    } else if (op.t === 'u') {
      const last = d.items.pop();
      if (last && 'p' in last) d.points -= last.p.length;
    } else if (op.t === 'a') {
      const it = [...d.items].reverse().find((i) => i.id === op.id);
      if (!it || it.t !== 's') continue;
      if (d.points + op.p.length > MAX_POINTS)
        throw new AppError('VALIDATION', 'Desenho muito grande: limpe a tela');
      it.p.push(...op.p);
      d.points += op.p.length;
    } else {
      const len = 'p' in op ? op.p.length : 0;
      if (d.items.length >= MAX_ITEMS || d.points + len > MAX_POINTS)
        throw new AppError('VALIDATION', 'Desenho muito grande: limpe a tela');
      d.items.push(op.t === 's' ? { ...op, p: [...op.p] } : op);
      d.points += len;
    }
  }
}

function arm(s: TelephoneState, ctx: GameContext, secs: number) {
  s.deadline = ctx.now() + secs * 1000;
  ctx.setTimer('phase', secs * 1000, () => telephoneGame.advancePhase(s, ctx));
}

function startStep(s: TelephoneState, ctx: GameContext) {
  s.drafts = Object.fromEntries(s.players.map((p) => [p, emptyDraft()]));
  s.done = [];
  const kind = kindOf(s.step);
  s.phase = kind;
  ctx.notice(
    kind === 'write'
      ? '✍️ Escreva uma frase para alguém desenhar!'
      : kind === 'draw'
        ? `🎨 Passo ${s.step + 1}: desenhe a frase que chegou para você`
        : `🔎 Passo ${s.step + 1}: descreva o desenho que chegou`,
  );
  arm(s, ctx, kind === 'draw' ? s.settings.drawSeconds : s.settings.writeSeconds);
  ctx.sync();
}

/** Guarda o que cada um fez neste passo no caderno certo. */
function commitStep(s: TelephoneState, ctx: GameContext) {
  const kind = kindOf(s.step);
  s.players.forEach((p, i) => {
    const d = s.drafts[p] ?? emptyDraft();
    const book = s.books[bookOf(s, i)]!;
    if (kind === 'draw') book.push({ kind: 'drawing', author: p, ops: d.items });
    else
      book.push({
        kind: 'text',
        author: p,
        text: d.text ?? (ctx.isOnline(p) ? '(ficou sem resposta…)' : '(saiu da sala)'),
      });
  });
}

function startReveal(s: TelephoneState, ctx: GameContext) {
  s.phase = 'reveal';
  s.revealBook = 0;
  s.revealShown = 1;
  ctx.notice('📖 Hora de ver no que deu! Curta suas páginas favoritas ❤️');
  arm(s, ctx, PAGE_SECONDS);
  ctx.sync();
}

function nextPage(s: TelephoneState, ctx: GameContext) {
  const book = s.books[s.revealBook]!;
  if (s.revealShown < book.length) s.revealShown += 1;
  else if (s.revealBook + 1 < s.books.length) {
    s.revealBook += 1;
    s.revealShown = 1;
  } else {
    // fica um pouco no último caderno antes de terminar
    s.phase = 'finished';
    s.deadline = null;
    ctx.clearTimer('phase');
    ctx.sync();
    return ctx.finish();
  }
  const last = s.revealShown === s.books[s.revealBook]!.length;
  arm(s, ctx, last ? PAGE_SECONDS + 5 : PAGE_SECONDS);
  ctx.sync();
}

export const telephoneGame: GameModule<TelephoneState, TelephoneSettings, TelephoneAction> = {
  id: 'telephone',
  minPlayers: 3,
  settingsSchema: telephoneSettingsSchema,
  defaultSettings: () => ({ writeSeconds: 45, drawSeconds: 80, steps: 0 }),

  createInitialState(players, settings) {
    const ids = shuffle(players.map((p) => p.id));
    const steps = Math.min(ids.length, settings.steps || ids.length);
    return {
      settings,
      players: ids,
      steps,
      step: 0,
      phase: 'write',
      deadline: null,
      books: ids.map(() => []),
      drafts: {},
      done: [],
      likes: {},
      revealBook: 0,
      revealShown: 0,
    };
  },

  startRound(s, ctx) {
    startStep(s, ctx);
  },

  validateAction(s, playerId, raw) {
    const a = telephoneActionSchema.parse(raw);
    if (!s.players.includes(playerId)) throw new AppError('FORBIDDEN', 'Você está assistindo', 403);
    const kind = s.phase;
    switch (a.type) {
      case 'text':
        if (kind !== 'write' && kind !== 'describe') throw invalidState('Agora é hora de desenhar');
        break;
      case 'draw':
        if (kind !== 'draw') throw invalidState('Agora não é hora de desenhar');
        break;
      case 'done':
        if (kind === 'reveal' || kind === 'finished') throw invalidState('Já acabou');
        break;
      case 'like': {
        if (kind !== 'reveal') throw invalidState('Curta durante a revelação');
        const e = s.books[a.book]?.[a.entry];
        if (!e || a.book > s.revealBook || (a.book === s.revealBook && a.entry >= s.revealShown))
          throw invalidState('Página ainda não revelada');
        if (e.author === playerId) throw invalidState('Essa página é sua 😉');
        break;
      }
      case 'next':
        if (kind !== 'reveal') throw invalidState('Ainda não é a revelação');
        break;
    }
    return a;
  },

  processAction(s, playerId, a, ctx) {
    const d = (s.drafts[playerId] ??= emptyDraft());
    switch (a.type) {
      case 'text':
        d.text = maskProfanity(cleanText(a.text));
        if (!s.done.includes(playerId)) s.done.push(playerId);
        break;
      case 'draw':
        applyDraw(d, a.ops);
        return; // traços não precisam reenviar a visão
      case 'done':
        if (!s.done.includes(playerId)) s.done.push(playerId);
        break;
      case 'like': {
        const k = `${a.book}:${a.entry}`;
        const list = (s.likes[k] ??= []);
        const i = list.indexOf(playerId);
        if (i >= 0) list.splice(i, 1);
        else list.push(playerId);
        return ctx.sync();
      }
      case 'next':
        return nextPage(s, ctx);
    }
    const online = s.players.filter((p) => ctx.isOnline(p));
    if (online.every((p) => s.done.includes(p))) {
      ctx.clearTimer('phase');
      return telephoneGame.advancePhase(s, ctx);
    }
    ctx.sync();
  },

  advancePhase(s, ctx) {
    if (s.phase === 'reveal') return nextPage(s, ctx);
    if (s.phase === 'finished') return;
    commitStep(s, ctx);
    s.step += 1;
    if (s.step >= s.steps) return startReveal(s, ctx);
    startStep(s, ctx);
  },

  calculateScores(s) {
    const t: Record<string, number> = Object.fromEntries(s.players.map((p) => [p, 0]));
    s.books.forEach((book, b) =>
      book.forEach((e, i) => {
        const filled = e.kind === 'drawing' ? e.ops.length > 0 : !e.text.startsWith('(');
        if (filled) t[e.author] = (t[e.author] ?? 0) + TELEPHONE_POINTS.entry;
        t[e.author] =
          (t[e.author] ?? 0) + (s.likes[`${b}:${i}`]?.length ?? 0) * TELEPHONE_POINTS.like;
      }),
    );
    return t;
  },
  determineWinners(s) {
    return maxBy(telephoneGame.calculateScores(s), s.players);
  },
  finalize: (s) => ({ rounds: s.steps }),
  isParticipant: (s, id) => s.players.includes(id),

  onPlayerLeft(s, _id, ctx) {
    if (s.phase === 'reveal' || s.phase === 'finished') return;
    const online = s.players.filter((p) => ctx.isOnline(p));
    if (online.length && online.every((p) => s.done.includes(p))) {
      ctx.clearTimer('phase');
      telephoneGame.advancePhase(s, ctx);
    }
  },

  viewFor(s, playerId): TelephoneView {
    const idx = playerId ? s.players.indexOf(playerId) : -1;
    let task: TelephoneView['task'] = null;
    if (idx >= 0 && s.phase !== 'reveal' && s.phase !== 'finished') {
      const kind = kindOf(s.step);
      const prev = s.books[bookOf(s, idx)]!.at(-1);
      if (kind === 'write') task = { kind: 'write' };
      else if (kind === 'draw')
        task = { kind: 'draw', prompt: prev?.kind === 'text' ? prev.text : '' };
      else task = { kind: 'describe', ops: prev?.kind === 'drawing' ? prev.ops : [] };
    }
    const d = playerId ? s.drafts[playerId] : undefined;
    const showReveal = s.phase === 'reveal' || s.phase === 'finished';
    const book = s.books[s.revealBook];
    return {
      phase: s.phase,
      step: s.step,
      totalSteps: s.steps,
      deadline: s.deadline,
      participants: [...s.players],
      doneStep: [...s.done],
      task,
      myDraft: { text: d?.text ?? null, ops: d?.items ?? [] },
      reveal:
        showReveal && book
          ? {
              book: s.revealBook,
              totalBooks: s.books.length,
              owner: book[0]?.author ?? s.players[s.revealBook]!,
              shown: s.phase === 'finished' ? book.length : s.revealShown,
              entries: book
                .slice(0, s.phase === 'finished' ? book.length : s.revealShown)
                .map((e, i) => {
                  const likes = s.likes[`${s.revealBook}:${i}`] ?? [];
                  return {
                    ...e,
                    likes: likes.length,
                    likedByMe: !!playerId && likes.includes(playerId),
                  };
                }),
            }
          : null,
      totals: telephoneGame.calculateScores(s),
    };
  },
};
