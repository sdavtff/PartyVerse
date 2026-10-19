import { twoTruthsActionSchema, twoTruthsSettingsSchema, } from '@partyverse/shared';
import { AppError, invalidState } from '../../lib/errors.js';
import { maxBy, shuffle } from './util.js';
const REVEAL = 6;
/** Achar a mentira vale FOUND; o autor ganha FOOLED por pessoa enganada. */
export const TWO_TRUTHS_POINTS = { found: 100, fooled: 50 };
const author = (s) => s.authors[s.turn - 1] ?? null;
function setPhase(s, ctx, p, secs) {
    s.phase = p;
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, () => twoTruthsGame.advancePhase(s, ctx));
    ctx.sync();
}
function startWrite(s, ctx) {
    s.round += 1;
    s.submissions = {};
    s.authors = [];
    s.turn = 0;
    s.guesses = {};
    s.last = null;
    ctx.notice(`Rodada ${s.round}: escreva duas verdades e uma mentira sobre você!`);
    setPhase(s, ctx, 'write', s.settings.writeSeconds);
}
function finishGame(s, ctx) {
    s.phase = 'finished';
    s.deadline = null;
    ctx.clearTimer('phase');
    ctx.sync();
    ctx.finish();
}
function nextAuthor(s, ctx) {
    if (s.turn >= s.authors.length) {
        if (s.round < s.settings.rounds)
            return startWrite(s, ctx);
        return finishGame(s, ctx);
    }
    s.turn += 1;
    s.perm = shuffle([0, 1, 2]);
    s.guesses = {};
    s.last = null;
    ctx.notice(`Qual é a mentira de ${ctx.nickname(author(s))}?`);
    setPhase(s, ctx, 'guess', s.settings.guessSeconds);
}
function beginGuessing(s, ctx) {
    s.authors = shuffle(Object.keys(s.submissions));
    if (!s.authors.length)
        ctx.notice('Ninguém escreveu nada nesta rodada 😅');
    nextAuthor(s, ctx);
}
function guessersOnline(s, ctx) {
    return s.players.filter((p) => p !== author(s) && ctx.isOnline(p));
}
function reveal(s, ctx) {
    const a = author(s);
    const lieShown = s.perm.indexOf(s.submissions[a].lie);
    const gained = {};
    let fooled = 0;
    for (const [p, g] of Object.entries(s.guesses)) {
        if (g === lieShown)
            gained[p] = TWO_TRUTHS_POINTS.found;
        else
            fooled++;
    }
    gained[a] = fooled * TWO_TRUTHS_POINTS.fooled;
    for (const [p, g] of Object.entries(gained))
        s.totals[p] = (s.totals[p] ?? 0) + g;
    s.last = { lie: lieShown, guesses: { ...s.guesses }, gained };
    setPhase(s, ctx, 'reveal', REVEAL);
}
export const twoTruthsGame = {
    id: 'twotruths',
    minPlayers: 3,
    settingsSchema: twoTruthsSettingsSchema,
    defaultSettings: () => ({ rounds: 1, writeSeconds: 120, guessSeconds: 25 }),
    createInitialState(players, settings) {
        const ids = players.map((p) => p.id);
        return {
            settings,
            players: ids,
            round: 0,
            phase: 'write',
            deadline: null,
            submissions: {},
            authors: [],
            turn: 0,
            perm: [0, 1, 2],
            guesses: {},
            totals: Object.fromEntries(ids.map((p) => [p, 0])),
            last: null,
        };
    },
    startRound(s, ctx) {
        startWrite(s, ctx);
    },
    validateAction(s, playerId, raw) {
        const a = twoTruthsActionSchema.parse(raw);
        if (!s.players.includes(playerId))
            throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
        if (a.type === 'submit') {
            if (s.phase !== 'write')
                throw invalidState('O tempo de escrever acabou');
            const norm = a.statements.map((t) => t.toLowerCase());
            if (new Set(norm).size < 3)
                throw new AppError('VALIDATION', 'Escreva três frases diferentes');
        }
        else {
            if (s.phase !== 'guess')
                throw invalidState('Espere a sua vez de chutar');
            if (author(s) === playerId)
                throw invalidState('Essas frases são suas!');
        }
        return a;
    },
    processAction(s, playerId, a, ctx) {
        if (a.type === 'submit') {
            s.submissions[playerId] = { statements: a.statements, lie: a.lie };
            const online = s.players.filter((p) => ctx.isOnline(p));
            if (online.every((p) => s.submissions[p])) {
                ctx.clearTimer('phase');
                return beginGuessing(s, ctx);
            }
            return ctx.sync();
        }
        s.guesses[playerId] = a.index;
        if (guessersOnline(s, ctx).every((p) => p in s.guesses)) {
            ctx.clearTimer('phase');
            return reveal(s, ctx);
        }
        ctx.sync();
    },
    advancePhase(s, ctx) {
        switch (s.phase) {
            case 'write':
                return beginGuessing(s, ctx);
            case 'guess':
                return reveal(s, ctx);
            case 'reveal':
                return nextAuthor(s, ctx);
            case 'finished':
                return;
        }
    },
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners: (s) => maxBy(s.totals, s.players),
    finalize: (s) => ({ rounds: s.round }),
    isParticipant: (s, id) => s.players.includes(id),
    onPlayerLeft(s, _id, ctx) {
        if (s.phase === 'write') {
            const online = s.players.filter((p) => ctx.isOnline(p));
            if (online.length && online.every((p) => s.submissions[p])) {
                ctx.clearTimer('phase');
                beginGuessing(s, ctx);
            }
        }
        else if (s.phase === 'guess') {
            const g = guessersOnline(s, ctx);
            if (g.every((p) => p in s.guesses)) {
                ctx.clearTimer('phase');
                reveal(s, ctx);
            }
        }
    },
    viewFor(s, playerId) {
        const a = author(s);
        const showing = (s.phase === 'guess' || s.phase === 'reveal') && a;
        return {
            phase: s.phase,
            round: s.round,
            totalRounds: s.settings.rounds,
            deadline: s.deadline,
            participants: [...s.players],
            submitted: Object.keys(s.submissions),
            mySubmission: playerId ? (s.submissions[playerId] ?? null) : null,
            authorId: showing ? a : null,
            turn: s.turn,
            totalTurns: s.authors.length,
            statements: showing ? s.perm.map((i) => s.submissions[a].statements[i]) : null,
            myGuess: playerId ? (s.guesses[playerId] ?? null) : null,
            guessedPlayers: Object.keys(s.guesses),
            totals: { ...s.totals },
            reveal: s.phase === 'reveal' ? s.last : null,
        };
    },
};
