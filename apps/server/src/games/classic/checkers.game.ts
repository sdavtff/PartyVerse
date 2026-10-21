import {
  checkersActionSchema,
  checkersSettingsSchema,
  type CheckersAction,
  type CheckersSettings,
  type CheckersView,
} from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import type { GameContext, GameModule } from '../GameModule.js';
import { maxBy } from '../party/util.js';
import {
  applyMove,
  colorOf,
  initialBoard,
  legalMoves,
  samePath,
  type Board,
  type Color,
  type Move,
} from './checkers.rules.js';

const GAME_END_SECONDS = 6;
/** 20 lances de cada lado só com damas e sem captura = empate. */
const KING_ONLY_DRAW = 40;
export const CHECKERS_POINTS = { win: 3, draw: 1 };

export interface CheckersState {
  settings: CheckersSettings;
  duo: [string, string];
  phase: CheckersView['phase'];
  game: number;
  deadline: number | null;
  board: Board;
  turn: Color;
  moves: Move[];
  lastMove: number[] | null;
  quietKingPlies: number;
  winner: CheckersView['winner'];
  reason: string | null;
  totals: Record<string, number>;
}

/** Bot de 1 lance: evita entregar peças, gosta de promover; um pouco de sorte no meio. */
export function botMove(board: Board, turn: Color, moves: Move[]): Move {
  const opp: Color = turn === 'w' ? 'b' : 'w';
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const after = applyMove(board, m);
    const reply = legalMoves(after, opp);
    const loss = reply.reduce((mx, r) => Math.max(mx, r.captured.length), 0);
    const end = m.path.at(-1)!;
    const promoted = board[m.path[0]!] !== after[end];
    const score = m.captured.length * 3 - loss * 3 + (promoted ? 2 : 0) + Math.random() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** Quem joga de brancas alterna a cada partida (brancas começam). */
const whiteOf = (s: CheckersState) => s.duo[(s.game - 1) % 2]!;
const blackOf = (s: CheckersState) => s.duo[s.game % 2]!;
const playerOf = (s: CheckersState, c: Color) => (c === 'w' ? whiteOf(s) : blackOf(s));

function arm(s: CheckersState, ctx: GameContext, secs: number) {
  s.deadline = ctx.now() + secs * 1000;
  ctx.setTimer('phase', secs * 1000, () => checkersGame.advancePhase(s, ctx));
}

function newGame(s: CheckersState, ctx: GameContext) {
  s.game += 1;
  s.board = initialBoard();
  s.turn = 'w';
  s.moves = legalMoves(s.board, 'w');
  s.lastMove = null;
  s.quietKingPlies = 0;
  s.winner = null;
  s.reason = null;
  s.phase = 'playing';
  arm(s, ctx, s.settings.turnSeconds);
  ctx.sync();
}

function endGame(s: CheckersState, ctx: GameContext, winner: Color | 'draw', reason: string) {
  s.winner = winner;
  s.reason = reason;
  s.phase = 'game-end';
  if (winner === 'draw')
    for (const p of s.duo) s.totals[p] = (s.totals[p] ?? 0) + CHECKERS_POINTS.draw;
  else {
    const p = playerOf(s, winner);
    s.totals[p] = (s.totals[p] ?? 0) + CHECKERS_POINTS.win;
  }
  ctx.notice(
    winner === 'draw'
      ? `Empate: ${reason}`
      : `${ctx.nickname(playerOf(s, winner))} venceu! ${reason}`,
  );
  arm(s, ctx, GAME_END_SECONDS);
  ctx.sync();
}

function play(s: CheckersState, ctx: GameContext, move: Move) {
  const piece = s.board[move.path[0]!];
  const kingMove = piece === 'W' || piece === 'B';
  s.board = applyMove(s.board, move);
  s.lastMove = move.path;
  s.quietKingPlies = kingMove && !move.captured.length ? s.quietKingPlies + 1 : 0;
  const opp: Color = s.turn === 'w' ? 'b' : 'w';
  if (!s.board.some((p) => colorOf(p) === opp))
    return endGame(s, ctx, s.turn, 'Capturou todas as peças.');
  const next = legalMoves(s.board, opp);
  if (!next.length) return endGame(s, ctx, s.turn, 'O adversário ficou sem jogadas.');
  if (s.quietKingPlies >= KING_ONLY_DRAW)
    return endGame(s, ctx, 'draw', '20 lances de damas sem captura.');
  s.turn = opp;
  s.moves = next;
  arm(s, ctx, s.settings.turnSeconds);
  ctx.sync();
}

export const checkersGame: GameModule<CheckersState, CheckersSettings, CheckersAction> = {
  id: 'checkers',
  minPlayers: 2,
  settingsSchema: checkersSettingsSchema,
  defaultSettings: () => ({ games: 1, turnSeconds: 60 }),

  createInitialState(players, settings) {
    const duo: [string, string] = [players[0]!.id, players[1]!.id];
    return {
      settings,
      duo,
      phase: 'playing',
      game: 0,
      deadline: null,
      board: initialBoard(),
      turn: 'w',
      moves: [],
      lastMove: null,
      quietKingPlies: 0,
      winner: null,
      reason: null,
      totals: { [duo[0]]: 0, [duo[1]]: 0 },
    };
  },

  startRound(s, ctx) {
    ctx.notice(`${ctx.nickname(s.duo[0])} × ${ctx.nickname(s.duo[1])} nas Damas!`);
    newGame(s, ctx);
  },

  validateAction(s, playerId, raw) {
    const a = checkersActionSchema.parse(raw);
    if (!s.duo.includes(playerId)) throw new AppError('FORBIDDEN', 'Você está assistindo', 403);
    if (s.phase !== 'playing') throw invalidState('Espere a próxima partida');
    if (playerOf(s, s.turn) !== playerId) throw invalidState('Não é a sua vez');
    if (!s.moves.some((m) => samePath(m.path, a.path)))
      throw new AppError(
        'VALIDATION',
        'Jogada inválida (lembre: capturar é obrigatório, e a que pega mais peças)',
      );
    return a;
  },

  processAction(s, _id, a, ctx) {
    play(
      s,
      ctx,
      s.moves.find((m) => samePath(m.path, a.path))!,
    );
  },

  advancePhase(s, ctx) {
    if (s.phase === 'playing') {
      ctx.notice(`⏰ Tempo esgotado: jogada automática para ${ctx.nickname(playerOf(s, s.turn))}`);
      return play(s, ctx, s.moves[randomInt(s.moves.length)]!);
    }
    if (s.phase === 'game-end') {
      if (s.game >= s.settings.games) {
        s.phase = 'finished';
        s.deadline = null;
        ctx.clearTimer('phase');
        ctx.sync();
        return ctx.finish();
      }
      newGame(s, ctx);
    }
  },

  bot(s, botId) {
    if (s.phase !== 'playing' || playerOf(s, s.turn) !== botId || !s.moves.length) return null;
    return {
      action: { type: 'move', path: botMove(s.board, s.turn, s.moves).path },
      delayMs: 900 + Math.random() * 1500,
    };
  },

  calculateScores: (s) => ({ ...s.totals }),
  determineWinners: (s) => maxBy(s.totals, [...s.duo]),
  finalize: (s) => ({ rounds: s.game }),
  isParticipant: (s, id) => s.duo.includes(id),

  onPlayerLeft(s, id, ctx) {
    if (s.phase === 'finished' || !s.duo.includes(id) || ctx.inRoom(id)) return;
    const other = s.duo.find((p) => p !== id)!;
    s.totals[other] = Math.max(s.totals[other] ?? 0, (s.totals[id] ?? 0) + CHECKERS_POINTS.win);
    ctx.notice(`${ctx.nickname(id)} saiu. ${ctx.nickname(other)} vence por W.O.`);
    s.phase = 'finished';
    s.deadline = null;
    ctx.clearTimer('phase');
    ctx.sync();
    ctx.finish();
  },

  viewFor(s, playerId): CheckersView {
    const mine = s.phase === 'playing' && playerId === playerOf(s, s.turn);
    return {
      phase: s.phase,
      game: s.game,
      totalGames: s.settings.games,
      deadline: s.deadline,
      participants: [...s.duo],
      white: whiteOf(s),
      black: blackOf(s),
      board: [...s.board],
      turn: s.turn,
      moves: mine ? s.moves.map((m) => m.path) : [],
      mustCapture: s.moves.some((m) => m.captured.length > 0),
      lastMove: s.lastMove,
      winner: s.winner,
      reason: s.reason,
      totals: { ...s.totals },
    };
  },
};
