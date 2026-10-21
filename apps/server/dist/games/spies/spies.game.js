import { spiesActionSchema, spiesSettingsSchema, } from '@partyverse/shared';
import { AppError, invalidState } from '../../lib/errors.js';
import { normalize } from '../../lib/text.js';
import { containsProfanity } from '../../modules/moderation/profanity.js';
import { wordsFor } from '../guess/words.js';
import { maxBy, shuffle } from '../party/util.js';
const GAME_END_SECONDS = 10;
export const SPIES_POINTS = { card: 1, win: 5 };
const other = (t) => (t === 'red' ? 'blue' : 'red');
const teamOf = (s, id) => s.teams.red.includes(id) ? 'red' : s.teams.blue.includes(id) ? 'blue' : null;
const remaining = (s, t) => s.key.filter((c, i) => c === t && s.revealed[i] === null).length;
const TEAM_NAME = { red: 'Vermelho', blue: 'Azul' };
function arm(s, ctx, secs) {
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, () => spiesGame.advancePhase(s, ctx));
}
/** Palavras curtas e de uma palavra só, para caber nas cartas. */
function pickWords(s) {
    const pool = wordsFor(s.settings.category, 'secretword', s.settings.customWords)
        .map((w) => w.word.trim())
        .filter((w) => /^[\p{L}-]{2,12}$/u.test(w) && !s.usedWords.includes(w));
    let list = [...new Set(pool)];
    if (list.length < 25)
        list = [...new Set([...list, ...wordsFor('misto', 'secretword').map((w) => w.word)])].filter((w) => /^[\p{L}-]{2,12}$/u.test(w));
    return shuffle(list)
        .slice(0, 25)
        .map((w) => w.toUpperCase());
}
function newGame(s, ctx) {
    s.game += 1;
    // times equilibrados; o mestre de cada time troca a cada partida
    if (s.game === 1) {
        const order = shuffle(s.players);
        s.teams = {
            red: order.filter((_, i) => i % 2 === 0),
            blue: order.filter((_, i) => i % 2 === 1),
        };
    }
    s.spymasters = {
        red: s.teams.red[(s.game - 1) % s.teams.red.length],
        blue: s.teams.blue[(s.game - 1) % s.teams.blue.length],
    };
    s.starter = s.game % 2 === 1 ? 'red' : 'blue';
    s.turn = s.starter;
    s.words = pickWords(s);
    s.usedWords.push(...s.words);
    const key = [
        ...Array(9).fill(s.starter),
        ...Array(8).fill(other(s.starter)),
        ...Array(7).fill('neutral'),
        'assassin',
    ];
    s.key = shuffle(key);
    s.revealed = Array(25).fill(null);
    s.clue = null;
    s.guessesLeft = 0;
    s.winner = null;
    s.reason = null;
    s.log = [`Time ${TEAM_NAME[s.starter]} começa (9 cartas).`];
    s.phase = 'clue';
    ctx.notice(`Partida ${s.game}: mestres ${ctx.nickname(s.spymasters.red)} (🔴) e ${ctx.nickname(s.spymasters.blue)} (🔵)`);
    arm(s, ctx, s.settings.clueSeconds);
    ctx.sync();
}
function endTurn(s, ctx, why) {
    s.log.push(why);
    s.turn = other(s.turn);
    s.clue = null;
    s.guessesLeft = 0;
    s.phase = 'clue';
    arm(s, ctx, s.settings.clueSeconds);
    ctx.sync();
}
function endGame(s, ctx, winner, reason) {
    s.winner = winner;
    s.reason = reason;
    s.phase = 'game-end';
    for (const p of s.teams[winner])
        s.totals[p] = (s.totals[p] ?? 0) + SPIES_POINTS.win;
    s.log.push(`🏆 Time ${TEAM_NAME[winner]} venceu! ${reason}`);
    ctx.notice(`🏆 Time ${TEAM_NAME[winner]} venceu! ${reason}`);
    arm(s, ctx, GAME_END_SECONDS);
    ctx.sync();
}
export const spiesGame = {
    id: 'spies',
    minPlayers: 4,
    settingsSchema: spiesSettingsSchema,
    defaultSettings: () => ({
        games: 1,
        clueSeconds: 90,
        guessSeconds: 150,
        category: 'misto',
        customWords: [],
    }),
    createInitialState(players, settings) {
        const ids = players.map((p) => p.id);
        return {
            settings,
            players: ids,
            phase: 'clue',
            game: 0,
            deadline: null,
            teams: { red: [], blue: [] },
            spymasters: { red: '', blue: '' },
            starter: 'red',
            turn: 'red',
            words: [],
            key: [],
            revealed: [],
            clue: null,
            guessesLeft: 0,
            winner: null,
            reason: null,
            log: [],
            totals: Object.fromEntries(ids.map((p) => [p, 0])),
            usedWords: [],
        };
    },
    startRound(s, ctx) {
        newGame(s, ctx);
    },
    validateAction(s, playerId, raw) {
        const a = spiesActionSchema.parse(raw);
        const team = teamOf(s, playerId);
        if (!team)
            throw new AppError('FORBIDDEN', 'Você está assistindo', 403);
        if (team !== s.turn)
            throw invalidState('É a vez do outro time');
        const master = s.spymasters[team] === playerId;
        if (a.type === 'clue') {
            if (s.phase !== 'clue')
                throw invalidState('A dica já foi dada');
            if (!master)
                throw invalidState('Só o mestre dá a dica');
            if (/\s/.test(a.word))
                throw new AppError('VALIDATION', 'A dica é uma palavra só');
            const n = normalize(a.word);
            if (s.words.some((w, i) => s.revealed[i] === null && (normalize(w).includes(n) || n.includes(normalize(w)))))
                throw new AppError('VALIDATION', 'A dica não pode ser (nem conter) uma palavra da mesa');
            if (containsProfanity(a.word))
                throw new AppError('VALIDATION', 'Escolha outra dica 🙂');
        }
        else {
            if (s.phase !== 'guess')
                throw invalidState('Espere a dica do mestre');
            if (master)
                throw invalidState('O mestre não pode escolher cartas');
            if (a.type === 'reveal' && s.revealed[a.card] !== null)
                throw invalidState('Carta já revelada');
        }
        return a;
    },
    processAction(s, playerId, a, ctx) {
        const team = s.turn;
        if (a.type === 'clue') {
            s.clue = { word: a.word.toUpperCase(), count: a.count };
            // 0 = "sem limite": pode tentar até errar
            s.guessesLeft = a.count === 0 ? 25 : a.count + 1;
            s.log.push(`${team === 'red' ? '🔴' : '🔵'} ${ctx.nickname(playerId)}: ${s.clue.word} ${a.count}`);
            s.phase = 'guess';
            arm(s, ctx, s.settings.guessSeconds);
            return ctx.sync();
        }
        if (a.type === 'pass')
            return endTurn(s, ctx, `${ctx.nickname(playerId)} passou a vez.`);
        const color = s.key[a.card];
        s.revealed[a.card] = color;
        const word = s.words[a.card];
        const nick = ctx.nickname(playerId);
        if (color === 'assassin')
            return endGame(s, ctx, other(team), `${nick} tocou no ASSASSINO (${word}) 💀`);
        if (color === team)
            s.totals[playerId] = (s.totals[playerId] ?? 0) + SPIES_POINTS.card;
        if (remaining(s, 'red') === 0)
            return endGame(s, ctx, 'red', 'Achou todos os agentes.');
        if (remaining(s, 'blue') === 0)
            return endGame(s, ctx, 'blue', 'Achou todos os agentes.');
        if (color !== team)
            return endTurn(s, ctx, `${nick} abriu ${word}: ${color === 'neutral' ? 'neutra' : `do time ${TEAM_NAME[color]}`}. Vez do outro time.`);
        s.log.push(`${nick} acertou ${word} ✓`);
        s.guessesLeft -= 1;
        if (s.guessesLeft <= 0)
            return endTurn(s, ctx, 'Acabaram os chutes.');
        ctx.sync();
    },
    advancePhase(s, ctx) {
        if (s.phase === 'clue')
            return endTurn(s, ctx, '⏰ O mestre não deu dica a tempo.');
        if (s.phase === 'guess')
            return endTurn(s, ctx, '⏰ Tempo esgotado.');
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
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners: (s) => maxBy(s.totals, s.players),
    finalize: (s) => ({ rounds: s.game }),
    isParticipant: (s, id) => s.players.includes(id),
    onPlayerLeft(s, id, ctx) {
        if (ctx.inRoom(id) || s.phase === 'finished')
            return;
        // mestre saiu: outro do time assume
        for (const t of ['red', 'blue']) {
            s.teams[t] = s.teams[t].filter((p) => p !== id);
            if (s.spymasters[t] === id && s.teams[t].length) {
                s.spymasters[t] = s.teams[t][0];
                ctx.notice(`${ctx.nickname(s.spymasters[t])} agora é o mestre do time ${TEAM_NAME[t]}`);
            }
            if (!s.teams[t].length && s.phase !== 'game-end')
                return endGame(s, ctx, other(t), 'O outro time ficou sem jogadores.');
        }
        ctx.sync();
    },
    viewFor(s, playerId) {
        const isMaster = !!playerId && (s.spymasters.red === playerId || s.spymasters.blue === playerId);
        const over = s.phase === 'game-end' || s.phase === 'finished';
        return {
            phase: s.phase,
            game: s.game,
            totalGames: s.settings.games,
            deadline: s.deadline,
            participants: [...s.players],
            teams: { red: [...s.teams.red], blue: [...s.teams.blue] },
            spymasters: { ...s.spymasters },
            turn: s.turn,
            words: [...s.words],
            revealed: [...s.revealed],
            key: isMaster || over ? [...s.key] : null,
            clue: s.clue,
            guessesLeft: s.guessesLeft,
            remaining: { red: remaining(s, 'red'), blue: remaining(s, 'blue') },
            winner: s.winner,
            reason: s.reason,
            log: s.log.slice(-8),
            totals: { ...s.totals },
        };
    },
};
