import { mostLikelyActionSchema, mostLikelySettingsSchema, } from '@partyverse/shared';
import { AppError, invalidState } from '../../lib/errors.js';
import { MOST_LIKELY_PROMPTS } from './prompts.js';
import { deck, maxBy } from './util.js';
const COUNTDOWN = 3;
const REVEAL = 7;
/** Votar em quem a maioria votou vale MATCH pontos; ser o escolhido vale CHOSEN. */
export const MOST_LIKELY_POINTS = { match: 100, chosen: 50 };
function setPhase(s, ctx, p, secs) {
    s.phase = p;
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, () => mostLikelyGame.advancePhase(s, ctx));
    ctx.sync();
}
/** Conta os votos e pontua. Exportado para testes. */
export function tally(votes, players) {
    const counts = {};
    for (const t of Object.values(votes))
        counts[t] = (counts[t] ?? 0) + 1;
    const chosen = Object.keys(votes).length ? maxBy(counts, players) : [];
    const gained = {};
    for (const p of players) {
        let g = 0;
        if (votes[p] && chosen.includes(votes[p]))
            g += MOST_LIKELY_POINTS.match;
        if (chosen.includes(p))
            g += MOST_LIKELY_POINTS.chosen;
        gained[p] = g;
    }
    return { votes: { ...votes }, counts, chosen, gained };
}
function reveal(s, ctx) {
    s.last = tally(s.votes, s.players);
    for (const [p, g] of Object.entries(s.last.gained))
        s.totals[p] = (s.totals[p] ?? 0) + g;
    const names = s.last.chosen.map((id) => ctx.nickname(id)).join(' e ');
    if (names)
        ctx.notice(`🏅 Mais provável de ${s.prompts[s.round - 1]}: ${names}`);
    setPhase(s, ctx, 'reveal', REVEAL);
}
export const mostLikelyGame = {
    id: 'mostlikely',
    minPlayers: 3,
    settingsSchema: mostLikelySettingsSchema,
    defaultSettings: () => ({ rounds: 8, voteSeconds: 20, customPrompts: [], onlyCustom: false }),
    createInitialState(players, settings) {
        const prompts = deck(MOST_LIKELY_PROMPTS, settings.customPrompts, settings.onlyCustom).slice(0, settings.rounds);
        return {
            settings: { ...settings, rounds: prompts.length },
            players: players.map((p) => p.id),
            phase: 'countdown',
            round: 0,
            deadline: null,
            prompts,
            votes: {},
            totals: Object.fromEntries(players.map((p) => [p.id, 0])),
            last: null,
        };
    },
    startRound(s, ctx) {
        ctx.notice(`Quem é mais provável… ${s.prompts.length} rodadas!`);
        setPhase(s, ctx, 'countdown', COUNTDOWN);
    },
    validateAction(s, playerId, raw) {
        const action = mostLikelyActionSchema.parse(raw);
        if (!s.players.includes(playerId))
            throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
        if (s.phase !== 'vote')
            throw invalidState('Espere a próxima frase');
        if (!s.players.includes(action.targetId))
            throw invalidState('Jogador inválido');
        return action;
    },
    processAction(s, playerId, action, ctx) {
        s.votes[playerId] = action.targetId; // pode trocar o voto até o fim
        const online = s.players.filter((p) => ctx.isOnline(p));
        if (online.every((p) => s.votes[p])) {
            ctx.clearTimer('phase');
            return reveal(s, ctx);
        }
        ctx.sync();
    },
    advancePhase(s, ctx) {
        switch (s.phase) {
            case 'countdown':
            case 'reveal':
                if (s.round >= s.prompts.length) {
                    s.phase = 'finished';
                    s.deadline = null;
                    ctx.clearTimer('phase');
                    ctx.sync();
                    return ctx.finish();
                }
                s.round += 1;
                s.votes = {};
                s.last = null;
                return setPhase(s, ctx, 'vote', s.settings.voteSeconds);
            case 'vote':
                return reveal(s, ctx);
            case 'finished':
                return;
        }
    },
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners: (s) => maxBy(s.totals, s.players),
    finalize: (s) => ({ rounds: s.round }),
    isParticipant: (s, id) => s.players.includes(id),
    onPlayerLeft(s, _id, ctx) {
        if (s.phase !== 'vote')
            return;
        const online = s.players.filter((p) => ctx.isOnline(p));
        if (online.length && online.every((p) => s.votes[p])) {
            ctx.clearTimer('phase');
            reveal(s, ctx);
        }
    },
    viewFor(s, playerId) {
        return {
            phase: s.phase,
            round: s.round,
            totalRounds: s.prompts.length,
            deadline: s.deadline,
            participants: [...s.players],
            prompt: s.round > 0 ? s.prompts[s.round - 1] : null,
            myVote: playerId ? (s.votes[playerId] ?? null) : null,
            votedPlayers: Object.keys(s.votes),
            totals: { ...s.totals },
            reveal: s.phase === 'reveal' || s.phase === 'finished' ? s.last : null,
        };
    },
};
