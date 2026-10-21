import { hangmanActionSchema, hangmanSettingsSchema, } from '@partyverse/shared';
import { AppError, invalidState } from '../../lib/errors.js';
import { normalize } from '../../lib/text.js';
import { WORD_CATEGORY_LABELS, wordsFor } from '../guess/words.js';
import { maxBy, shuffle } from '../party/util.js';
const ROUND_END_SECONDS = 5;
export const HANGMAN_POINTS = { letter: 10, solveBonus: 30, perHidden: 10 };
/** Letra sem acento (a palavra "maçã" se resolve com c e a). */
const base = (ch) => normalize(ch).replace(/[^a-z]/g, '');
const current = (s) => s.players[s.turnIdx % s.players.length];
const letters = (w) => [...new Set(w.split('').map(base).filter(Boolean))];
const hidden = (s) => letters(s.word).filter((l) => !s.guessed.includes(l));
function setDeadline(s, ctx, secs, fn) {
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, fn);
}
/** Passa a vez para o próximo jogador online. */
function nextTurn(s, ctx) {
    for (let i = 0; i < s.players.length; i++) {
        s.turnIdx = (s.turnIdx + 1) % s.players.length;
        if (ctx.isOnline(current(s)))
            break;
    }
    setDeadline(s, ctx, s.settings.turnSeconds, () => hangmanGame.advancePhase(s, ctx));
    ctx.sync();
}
function startWord(s, ctx) {
    s.round += 1;
    const w = s.words[(s.round - 1) % s.words.length];
    s.word = w.word;
    s.category = w.category;
    s.guessed = [];
    s.wrong = [];
    s.lives = s.settings.lives;
    s.solvedBy = null;
    s.lastEvent = null;
    s.phase = 'playing';
    s.turnIdx = (s.round - 1) % s.players.length;
    ctx.notice(`Forca ${s.round}/${s.settings.rounds}: ${s.word.replace(/\S/g, '_ ').trim()}`);
    setDeadline(s, ctx, s.settings.turnSeconds, () => hangmanGame.advancePhase(s, ctx));
    ctx.sync();
}
function endWord(s, ctx, solvedBy) {
    s.solvedBy = solvedBy;
    s.phase = 'round-end';
    ctx.notice(solvedBy ? `🎉 ${ctx.nickname(solvedBy)} acertou: ${s.word}` : `💀 Enforcado! Era: ${s.word}`);
    setDeadline(s, ctx, ROUND_END_SECONDS, () => hangmanGame.advancePhase(s, ctx));
    ctx.sync();
}
export const hangmanGame = {
    id: 'hangman',
    minPlayers: 1,
    settingsSchema: hangmanSettingsSchema,
    defaultSettings: () => ({
        rounds: 5,
        turnSeconds: 20,
        lives: 6,
        category: 'misto',
        customWords: [],
    }),
    createInitialState(players, settings) {
        const pool = wordsFor(settings.category, 'secretword', settings.customWords).filter(
        // só letras, espaços e hífen (ex.: "camisa 10" não dá para resolver letra a letra)
        (w) => base(w.word).length >= 3 && /^[\p{L} -]+$/u.test(w.word));
        const words = shuffle(pool)
            .slice(0, settings.rounds)
            .map((w) => ({ word: w.word.toUpperCase(), category: WORD_CATEGORY_LABELS[w.category] }));
        return {
            settings: { ...settings, rounds: words.length },
            players: shuffle(players.map((p) => p.id)),
            phase: 'playing',
            round: 0,
            deadline: null,
            turnIdx: 0,
            words,
            word: '',
            category: '',
            guessed: [],
            wrong: [],
            lives: settings.lives,
            totals: Object.fromEntries(players.map((p) => [p.id, 0])),
            solvedBy: null,
            lastEvent: null,
        };
    },
    startRound(s, ctx) {
        startWord(s, ctx);
    },
    validateAction(s, playerId, raw) {
        const a = hangmanActionSchema.parse(raw);
        if (!s.players.includes(playerId))
            throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
        if (s.phase !== 'playing')
            throw invalidState('Espere a próxima palavra');
        if (current(s) !== playerId)
            throw invalidState('Não é a sua vez');
        if (a.type === 'letter') {
            const l = base(a.letter);
            if (s.guessed.includes(l) || s.wrong.includes(l))
                throw invalidState('Essa letra já foi');
        }
        return a;
    },
    processAction(s, playerId, a, ctx) {
        const nick = ctx.nickname(playerId);
        if (a.type === 'letter') {
            const l = base(a.letter);
            const count = s.word.split('').filter((c) => base(c) === l).length;
            if (count) {
                s.guessed.push(l);
                s.totals[playerId] = (s.totals[playerId] ?? 0) + count * HANGMAN_POINTS.letter;
                s.lastEvent = { playerId, kind: 'hit', text: `${nick}: ${l.toUpperCase()} ✓ (${count}x)` };
                if (!hidden(s).length) {
                    s.totals[playerId] += HANGMAN_POINTS.solveBonus;
                    return endWord(s, ctx, playerId);
                }
                // acertou: joga de novo
                setDeadline(s, ctx, s.settings.turnSeconds, () => hangmanGame.advancePhase(s, ctx));
                return ctx.sync();
            }
            s.wrong.push(l);
            s.lives -= 1;
            s.lastEvent = { playerId, kind: 'miss', text: `${nick}: ${l.toUpperCase()} ✗` };
        }
        else {
            if (normalize(a.word) === normalize(s.word)) {
                const bonus = HANGMAN_POINTS.solveBonus + hidden(s).length * HANGMAN_POINTS.perHidden;
                s.totals[playerId] = (s.totals[playerId] ?? 0) + bonus;
                s.guessed = letters(s.word);
                s.lastEvent = {
                    playerId,
                    kind: 'word-hit',
                    text: `${nick} chutou a palavra certa! +${bonus}`,
                };
                return endWord(s, ctx, playerId);
            }
            s.lives -= 1;
            s.lastEvent = { playerId, kind: 'word-miss', text: `${nick} chutou "${a.word}" ✗` };
        }
        if (s.lives <= 0)
            return endWord(s, ctx, null);
        nextTurn(s, ctx);
    },
    advancePhase(s, ctx) {
        if (s.phase === 'playing') {
            s.lastEvent = {
                playerId: current(s),
                kind: 'timeout',
                text: `${ctx.nickname(current(s))} perdeu a vez ⏰`,
            };
            return nextTurn(s, ctx);
        }
        if (s.phase === 'round-end') {
            if (s.round >= s.words.length) {
                s.phase = 'finished';
                s.deadline = null;
                ctx.clearTimer('phase');
                ctx.sync();
                return ctx.finish();
            }
            return startWord(s, ctx);
        }
    },
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners: (s) => maxBy(s.totals, s.players),
    finalize: (s) => ({ rounds: s.round }),
    isParticipant: (s, id) => s.players.includes(id),
    onPlayerLeft(s, id, ctx) {
        if (s.phase === 'playing' && current(s) === id)
            nextTurn(s, ctx);
    },
    viewFor(s) {
        const reveal = s.phase !== 'playing';
        return {
            phase: s.phase,
            round: s.round,
            totalRounds: s.words.length,
            deadline: s.deadline,
            participants: [...s.players],
            currentId: s.phase === 'playing' ? current(s) : null,
            mask: s.word
                .split('')
                .map((c) => (c === ' ' || c === '-' ? c : reveal || s.guessed.includes(base(c)) ? c : '_')),
            category: s.category || null,
            guessed: [...s.guessed],
            wrong: [...s.wrong],
            lives: s.lives,
            maxLives: s.settings.lives,
            totals: { ...s.totals },
            word: reveal ? s.word : null,
            solvedBy: s.solvedBy,
            lastEvent: s.lastEvent,
        };
    },
};
