import { impostorActionSchema, impostorSettingsSchema, } from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import { normalize } from '../../lib/text.js';
import { IMPOSTOR_LOCATIONS } from './impostor.locations.js';
const REVEAL_SECONDS = 15;
const RESULTS_SECONDS = 15;
const LOCATIONS_SHOWN = 16;
export const IMPOSTOR_POINTS = {
    /** impostor descoberto: cada jogador comum ganha */
    caughtCitizen: 2,
    /** bônus para quem votou no impostor */
    correctVote: 1,
    /** impostor escapou ou acertou o local */
    impostorWin: 4,
    /** impostor chutou o local errado: cada jogador comum ganha */
    wrongGuessCitizen: 2,
};
const shuffle = (xs) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
const pickOne = (xs) => xs[randomInt(xs.length)];
const online = (s, ctx) => s.players.filter((p) => ctx.isOnline(p));
function setPhase(s, ctx, phase, secs) {
    s.phase = phase;
    s.ready = [];
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, () => impostorGame.advancePhase(s, ctx));
    ctx.sync();
}
/** Mais votado com maioria simples e sem empate; null se empatar ou ninguém votar. */
export function accusedFrom(votes) {
    const count = new Map();
    for (const t of Object.values(votes))
        count.set(t, (count.get(t) ?? 0) + 1);
    let best = null;
    let bestN = 0;
    let tie = false;
    for (const [t, n] of count) {
        if (n > bestN)
            [best, bestN, tie] = [t, n, false];
        else if (n === bestN)
            tie = true;
    }
    return tie ? null : best;
}
function endRound(s, ctx, reason, guess = null) {
    const accused = reason === 'caught' || reason === 'escaped' ? accusedFrom(s.votes) : null;
    const scores = Object.fromEntries(s.players.map((p) => [p, 0]));
    const citizens = s.players.filter((p) => p !== s.impostorId);
    const P = IMPOSTOR_POINTS;
    if (reason === 'caught' || reason === 'escaped') {
        for (const c of citizens)
            if (s.votes[c] === s.impostorId)
                scores[c] += P.correctVote;
    }
    if (reason === 'caught')
        for (const c of citizens)
            scores[c] += P.caughtCitizen;
    if (reason === 'escaped' || reason === 'guessed')
        scores[s.impostorId] = P.impostorWin;
    if (reason === 'wrong-guess')
        for (const c of citizens)
            scores[c] += P.wrongGuessCitizen;
    for (const p of s.players)
        s.totals[p] = (s.totals[p] ?? 0) + (scores[p] ?? 0);
    s.outcome = {
        impostorId: s.impostorId,
        location: s.location,
        votes: { ...s.votes },
        accused,
        reason,
        guess,
        roundScores: scores,
        roles: { ...s.roles },
    };
    const msg = {
        caught: 'O impostor foi descoberto!',
        escaped: 'O impostor escapou!',
        guessed: 'O impostor adivinhou o local!',
        'wrong-guess': 'O impostor chutou o local errado!',
    }[reason];
    ctx.notice(msg);
    setPhase(s, ctx, 'round-results', RESULTS_SECONDS);
}
function resolveVotes(s, ctx) {
    const accused = accusedFrom(s.votes);
    endRound(s, ctx, accused === s.impostorId ? 'caught' : 'escaped');
}
function checkProgress(s, ctx) {
    const on = online(s, ctx);
    if (on.length === 0)
        return;
    if (s.phase === 'reveal' && on.every((p) => s.ready.includes(p)))
        return impostorGame.advancePhase(s, ctx);
    if (s.phase === 'discussion' && s.callVote.filter((p) => on.includes(p)).length * 2 > on.length)
        return impostorGame.advancePhase(s, ctx);
    if (s.phase === 'voting' && on.every((p) => s.votes[p]))
        return resolveVotes(s, ctx);
    if (s.phase === 'round-results' && on.every((p) => s.ready.includes(p)))
        return impostorGame.advancePhase(s, ctx);
    ctx.sync();
}
export const impostorGame = {
    id: 'impostor',
    minPlayers: 3,
    settingsSchema: impostorSettingsSchema,
    defaultSettings: () => ({ rounds: 5, discussionSeconds: 180, voteSeconds: 45 }),
    createInitialState(players, settings) {
        return {
            settings,
            players: players.map((p) => p.id),
            phase: 'reveal',
            round: 0,
            deadline: null,
            impostorId: '',
            previousImpostors: [],
            location: '',
            usedLocations: [],
            options: [],
            roles: {},
            firstAsker: null,
            ready: [],
            callVote: [],
            votes: {},
            totals: Object.fromEntries(players.map((p) => [p.id, 0])),
            outcome: null,
        };
    },
    startRound(s, ctx) {
        s.round += 1;
        const pool = IMPOSTOR_LOCATIONS.filter((l) => !s.usedLocations.includes(l.name));
        const loc = pickOne(pool.length ? pool : IMPOSTOR_LOCATIONS);
        s.location = loc.name;
        s.usedLocations.push(loc.name);
        const others = shuffle(IMPOSTOR_LOCATIONS.filter((l) => l.name !== loc.name).map((l) => l.name));
        s.options = [loc.name, ...others.slice(0, LOCATIONS_SHOWN - 1)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        // evita repetir o impostor da rodada anterior (quando possível)
        const last = s.previousImpostors.at(-1);
        const candidates = s.players.filter((p) => p !== last);
        s.impostorId = pickOne(candidates.length ? candidates : s.players);
        s.previousImpostors.push(s.impostorId);
        const roles = shuffle(loc.roles);
        s.roles = {};
        s.players
            .filter((p) => p !== s.impostorId)
            .forEach((p, i) => (s.roles[p] = roles[i % roles.length]));
        s.firstAsker = pickOne(s.players);
        s.callVote = [];
        s.votes = {};
        s.outcome = null;
        ctx.notice(`Rodada ${s.round}: confiram suas cartas!`);
        setPhase(s, ctx, 'reveal', REVEAL_SECONDS);
    },
    validateAction(s, playerId, raw) {
        const action = impostorActionSchema.parse(raw);
        if (!s.players.includes(playerId))
            throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
        switch (action.type) {
            case 'ready':
                if (s.phase !== 'reveal' && s.phase !== 'round-results')
                    throw invalidState('Nada para confirmar agora');
                break;
            case 'callVote':
                if (s.phase !== 'discussion')
                    throw invalidState('A votação só pode ser pedida na discussão');
                break;
            case 'vote':
                if (s.phase !== 'voting')
                    throw invalidState('Não estamos na votação');
                if (action.targetId === playerId)
                    throw new AppError('VALIDATION', 'Você não pode votar em si mesmo');
                if (!s.players.includes(action.targetId))
                    throw new AppError('NOT_FOUND', 'Jogador não encontrado', 404);
                break;
            case 'guess':
                if (playerId !== s.impostorId)
                    throw new AppError('FORBIDDEN', 'Só o impostor pode chutar o local', 403);
                if (s.phase !== 'discussion' && s.phase !== 'voting')
                    throw invalidState('Agora não é hora de chutar');
                if (!s.options.some((o) => normalize(o) === normalize(action.location)))
                    throw new AppError('VALIDATION', 'Escolha um dos locais da lista');
                break;
        }
        return action;
    },
    processAction(s, playerId, action, ctx) {
        switch (action.type) {
            case 'ready':
                if (!s.ready.includes(playerId))
                    s.ready.push(playerId);
                return checkProgress(s, ctx);
            case 'callVote':
                // alterna o pedido
                s.callVote = s.callVote.includes(playerId)
                    ? s.callVote.filter((p) => p !== playerId)
                    : [...s.callVote, playerId];
                return checkProgress(s, ctx);
            case 'vote':
                s.votes[playerId] = action.targetId;
                return checkProgress(s, ctx);
            case 'guess': {
                ctx.clearTimer('phase');
                const right = normalize(action.location) === normalize(s.location);
                return endRound(s, ctx, right ? 'guessed' : 'wrong-guess', action.location);
            }
        }
    },
    advancePhase(s, ctx) {
        switch (s.phase) {
            case 'reveal':
                return setPhase(s, ctx, 'discussion', s.settings.discussionSeconds);
            case 'discussion':
                ctx.notice('Hora de votar: quem é o impostor?');
                return setPhase(s, ctx, 'voting', s.settings.voteSeconds);
            case 'voting':
                return resolveVotes(s, ctx);
            case 'round-results':
                if (s.round >= s.settings.rounds) {
                    s.phase = 'finished';
                    s.deadline = null;
                    ctx.clearTimer('phase');
                    ctx.sync();
                    ctx.finish();
                }
                else
                    impostorGame.startRound(s, ctx);
                return;
            case 'finished':
                return;
        }
    },
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners(s) {
        const max = Math.max(...s.players.map((p) => s.totals[p] ?? 0));
        return s.players.filter((p) => (s.totals[p] ?? 0) === max);
    },
    finalize: (s) => ({ rounds: s.round }),
    isParticipant: (s, playerId) => s.players.includes(playerId),
    onPlayerLeft(s, _playerId, ctx) {
        // quem saiu ou caiu não bloqueia "todos prontos" nem "todos votaram"
        if (s.phase !== 'finished')
            checkProgress(s, ctx);
    },
    viewFor(s, playerId) {
        const done = s.phase === 'round-results' || s.phase === 'finished';
        const isPlayer = playerId !== null && s.players.includes(playerId);
        let me = null;
        if (isPlayer && s.location) {
            me =
                playerId === s.impostorId
                    ? { isImpostor: true }
                    : { isImpostor: false, location: s.location, role: s.roles[playerId] ?? 'Visitante' };
        }
        return {
            phase: s.phase,
            round: s.round,
            totalRounds: s.settings.rounds,
            deadline: s.deadline,
            participants: [...s.players],
            locations: [...s.options],
            me,
            firstAsker: s.firstAsker,
            readyPlayers: [...s.ready],
            callVotePlayers: [...s.callVote],
            votedPlayers: Object.keys(s.votes),
            myVote: playerId ? (s.votes[playerId] ?? null) : null,
            totals: { ...s.totals },
            outcome: done ? s.outcome : null,
        };
    },
};
