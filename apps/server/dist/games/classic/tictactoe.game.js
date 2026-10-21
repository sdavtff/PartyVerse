import { ticTacToeActionSchema, ticTacToeSettingsSchema, } from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import { maxBy } from '../party/util.js';
const GAME_END_SECONDS = 4;
export const TTT_POINTS = { win: 3, draw: 1 };
export const LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];
export function winnerOf(b) {
    for (const l of LINES) {
        const [a, c, d] = l;
        if (b[a] && b[a] === b[c] && b[a] === b[d])
            return { winner: b[a], line: l };
    }
    return b.every(Boolean) ? { winner: 'draw', line: null } : null;
}
/** Bot: ganha se der, bloqueia, centro, cantos; às vezes se distrai (para dar chance). */
export function botCell(board, me) {
    const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const other = me === 'X' ? 'O' : 'X';
    const wins = (mark) => free.find((c) => {
        const b = [...board];
        b[c] = mark;
        return winnerOf(b)?.winner === mark;
    });
    if (Math.random() < 0.15)
        return free[randomInt(free.length)];
    const win = wins(me);
    if (win !== undefined)
        return win;
    const block = wins(other);
    if (block !== undefined)
        return block;
    if (free.includes(4))
        return 4;
    const corners = [0, 2, 6, 8].filter((c) => free.includes(c));
    if (corners.length)
        return corners[randomInt(corners.length)];
    return free[randomInt(free.length)];
}
/** Quem é X alterna a cada partida. */
const xOf = (s) => s.duo[(s.game - 1) % 2];
const oOf = (s) => s.duo[s.game % 2];
const playerOf = (s, mark) => (mark === 'X' ? xOf(s) : oOf(s));
function arm(s, ctx, secs) {
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, () => ticTacToeGame.advancePhase(s, ctx));
}
function newGame(s, ctx) {
    s.game += 1;
    s.board = Array(9).fill(null);
    s.turn = 'X';
    s.winner = null;
    s.line = null;
    s.phase = 'playing';
    arm(s, ctx, s.settings.turnSeconds);
    ctx.sync();
}
function place(s, ctx, cell) {
    s.board[cell] = s.turn;
    const w = winnerOf(s.board);
    if (w) {
        s.winner = w.winner;
        s.line = w.line;
        s.phase = 'game-end';
        if (w.winner === 'draw') {
            for (const p of s.duo)
                s.totals[p] = (s.totals[p] ?? 0) + TTT_POINTS.draw;
            ctx.notice('Deu velha! 🤝');
        }
        else {
            const p = playerOf(s, w.winner);
            s.totals[p] = (s.totals[p] ?? 0) + TTT_POINTS.win;
            ctx.notice(`${ctx.nickname(p)} venceu a partida ${s.game}!`);
        }
        arm(s, ctx, GAME_END_SECONDS);
        return ctx.sync();
    }
    s.turn = s.turn === 'X' ? 'O' : 'X';
    arm(s, ctx, s.settings.turnSeconds);
    ctx.sync();
}
export const ticTacToeGame = {
    id: 'tictactoe',
    minPlayers: 2,
    settingsSchema: ticTacToeSettingsSchema,
    defaultSettings: () => ({ games: 3, turnSeconds: 15 }),
    createInitialState(players, settings) {
        const duo = [players[0].id, players[1].id];
        return {
            settings,
            duo,
            phase: 'playing',
            game: 0,
            deadline: null,
            board: Array(9).fill(null),
            turn: 'X',
            winner: null,
            line: null,
            totals: { [duo[0]]: 0, [duo[1]]: 0 },
        };
    },
    startRound(s, ctx) {
        ctx.notice(`${ctx.nickname(s.duo[0])} × ${ctx.nickname(s.duo[1])} — melhor de ${s.settings.games}!`);
        newGame(s, ctx);
    },
    validateAction(s, playerId, raw) {
        const a = ticTacToeActionSchema.parse(raw);
        if (!s.duo.includes(playerId))
            throw new AppError('FORBIDDEN', 'Você está assistindo', 403);
        if (s.phase !== 'playing')
            throw invalidState('Espere a próxima partida');
        if (playerOf(s, s.turn) !== playerId)
            throw invalidState('Não é a sua vez');
        if (s.board[a.cell])
            throw invalidState('Essa casa já está ocupada');
        return a;
    },
    processAction(s, _id, a, ctx) {
        place(s, ctx, a.cell);
    },
    advancePhase(s, ctx) {
        if (s.phase === 'playing') {
            // tempo esgotado: jogada automática numa casa livre
            const free = s.board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
            return place(s, ctx, free[randomInt(free.length)]);
        }
        if (s.phase === 'game-end') {
            const need = Math.floor(s.settings.games / 2) + 1;
            const decided = s.duo.some((p) => (s.totals[p] ?? 0) >= need * TTT_POINTS.win);
            if (s.game >= s.settings.games || decided) {
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
        if (s.phase !== 'playing' || playerOf(s, s.turn) !== botId)
            return null;
        return {
            action: { type: 'mark', cell: botCell(s.board, s.turn) },
            delayMs: 700 + Math.random() * 1000,
        };
    },
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners: (s) => maxBy(s.totals, [...s.duo]),
    finalize: (s) => ({ rounds: s.game }),
    isParticipant: (s, id) => s.duo.includes(id),
    onPlayerLeft(s, id, ctx) {
        // quem fica vence por W.O. quando o adversário sai de vez
        if (s.phase === 'finished' || !s.duo.includes(id) || ctx.inRoom(id))
            return;
        const other = s.duo.find((p) => p !== id);
        s.totals[other] = Math.max(s.totals[other] ?? 0, (s.totals[id] ?? 0) + TTT_POINTS.win);
        ctx.notice(`${ctx.nickname(id)} saiu. ${ctx.nickname(other)} vence por W.O.`);
        s.phase = 'finished';
        s.deadline = null;
        ctx.clearTimer('phase');
        ctx.sync();
        ctx.finish();
    },
    viewFor(s) {
        return {
            phase: s.phase,
            game: s.game,
            totalGames: s.settings.games,
            deadline: s.deadline,
            participants: [...s.duo],
            x: xOf(s),
            o: oOf(s),
            board: [...s.board],
            turn: s.turn,
            winner: s.winner,
            line: s.line,
            totals: { ...s.totals },
        };
    },
};
