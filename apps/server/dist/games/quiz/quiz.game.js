import { quizActionSchema, quizSettingsSchema, } from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import { QUIZ_CATEGORY_LABELS, QUIZ_QUESTIONS } from './quiz.questions.js';
const COUNTDOWN_SECONDS = 3;
const REVEAL_SECONDS = 6;
/** Acerto vale BASE + até SPEED pela rapidez; sequência de 3+ acertos dá STREAK extra. */
export const QUIZ_POINTS = { base: 500, speed: 500, streak: 100 };
const shuffle = (xs) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
function prepare(q) {
    const options = shuffle([q.a, ...q.w]);
    return {
        text: q.q,
        options,
        correct: options.indexOf(q.a),
        category: QUIZ_CATEGORY_LABELS[q.c],
        fact: q.f ?? null,
    };
}
export function pickQuestions(settings, bank = QUIZ_QUESTIONS) {
    if (settings.category === 'personalizado') {
        const mine = shuffle(settings.customQuestions ?? []).map((q) => prepare({ ...q, c: 'personalizado' }));
        // completa com perguntas mistas se o anfitrião escreveu poucas
        const extra = mine.length >= settings.questions
            ? []
            : shuffle(bank)
                .slice(0, settings.questions - mine.length)
                .map(prepare);
        return [...mine.slice(0, settings.questions), ...extra];
    }
    const pool = settings.category === 'misto' ? bank : bank.filter((q) => q.c === settings.category);
    return shuffle(pool).slice(0, settings.questions).map(prepare);
}
/** Pontos de um acerto, dado o tempo gasto (ms) e o limite (ms). */
export function speedPoints(elapsedMs, limitMs) {
    const frac = Math.min(1, Math.max(0, 1 - elapsedMs / limitMs));
    return QUIZ_POINTS.base + Math.round(QUIZ_POINTS.speed * frac);
}
function phase(s, ctx, p, secs) {
    s.phase = p;
    s.deadline = ctx.now() + secs * 1000;
    ctx.setTimer('phase', secs * 1000, () => quizGame.advancePhase(s, ctx));
    ctx.sync();
}
function reveal(s, ctx) {
    const q = s.questions[s.index];
    const limit = s.settings.secondsPerQuestion * 1000;
    s.gained = {};
    for (const p of s.players) {
        const a = s.answers[p];
        if (a && a.option === q.correct) {
            s.streaks[p] = (s.streaks[p] ?? 0) + 1;
            s.maxStreaks[p] = Math.max(s.maxStreaks[p] ?? 0, s.streaks[p]);
            const bonus = s.streaks[p] >= 3 ? QUIZ_POINTS.streak : 0;
            s.gained[p] = speedPoints(a.at - s.questionStartedAt, limit) + bonus;
        }
        else {
            s.streaks[p] = 0;
            s.gained[p] = 0;
        }
        s.totals[p] = (s.totals[p] ?? 0) + s.gained[p];
    }
    phase(s, ctx, 'reveal', REVEAL_SECONDS);
}
export const quizGame = {
    id: 'quiz',
    minPlayers: 2,
    settingsSchema: quizSettingsSchema,
    defaultSettings: () => ({
        questions: 10,
        secondsPerQuestion: 15,
        category: 'misto',
        customQuestions: [],
    }),
    createInitialState(players, settings) {
        const questions = pickQuestions(settings);
        return {
            settings: { ...settings, questions: questions.length },
            players: players.map((p) => p.id),
            phase: 'countdown',
            index: -1,
            deadline: null,
            questionStartedAt: 0,
            questions,
            answers: {},
            gained: {},
            totals: Object.fromEntries(players.map((p) => [p.id, 0])),
            streaks: Object.fromEntries(players.map((p) => [p.id, 0])),
            maxStreaks: {},
        };
    },
    startRound(s, ctx) {
        ctx.notice(`Quiz começando: ${s.questions.length} perguntas!`);
        phase(s, ctx, 'countdown', COUNTDOWN_SECONDS);
    },
    validateAction(s, playerId, raw) {
        const action = quizActionSchema.parse(raw);
        if (!s.players.includes(playerId))
            throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
        if (s.phase !== 'question')
            throw invalidState('Espere a próxima pergunta');
        if (s.answers[playerId])
            throw invalidState('Você já respondeu esta pergunta');
        return action;
    },
    processAction(s, playerId, action, ctx) {
        s.answers[playerId] = { option: action.option, at: ctx.now() };
        const online = s.players.filter((p) => ctx.isOnline(p));
        if (online.every((p) => s.answers[p])) {
            ctx.clearTimer('phase');
            return reveal(s, ctx);
        }
        ctx.sync();
    },
    advancePhase(s, ctx) {
        switch (s.phase) {
            case 'countdown':
            case 'reveal':
                if (s.index + 1 >= s.questions.length) {
                    s.phase = 'finished';
                    s.deadline = null;
                    ctx.clearTimer('phase');
                    ctx.sync();
                    return ctx.finish();
                }
                s.index += 1;
                s.answers = {};
                s.gained = {};
                s.questionStartedAt = ctx.now();
                return phase(s, ctx, 'question', s.settings.secondsPerQuestion);
            case 'question':
                return reveal(s, ctx);
            case 'finished':
                return;
        }
    },
    calculateScores: (s) => ({ ...s.totals }),
    determineWinners(s) {
        const max = Math.max(...s.players.map((p) => s.totals[p] ?? 0));
        return s.players.filter((p) => (s.totals[p] ?? 0) === max);
    },
    finalize: (s) => ({ rounds: Math.max(0, s.index + 1) }),
    highlights: (s) => Object.fromEntries(s.players.map((p) => [p, { maxStreak: s.maxStreaks[p] ?? 0 }])),
    bot(s, botId) {
        if (s.phase !== 'question' || s.answers[botId] || !s.players.includes(botId))
            return null;
        const q = s.questions[s.index];
        if (!q)
            return null;
        // acerta ~60% das vezes; erra escolhendo outra alternativa
        const wrong = [0, 1, 2, 3].filter((o) => o !== q.correct && o < q.options.length);
        const option = Math.random() < 0.6 || !wrong.length
            ? q.correct
            : wrong[Math.floor(Math.random() * wrong.length)];
        const secs = s.settings.secondsPerQuestion;
        return {
            action: { type: 'answer', option },
            delayMs: Math.round(secs * 1000 * (0.2 + Math.random() * 0.5)),
        };
    },
    isParticipant: (s, playerId) => s.players.includes(playerId),
    onPlayerLeft(s, _playerId, ctx) {
        if (s.phase !== 'question')
            return;
        const online = s.players.filter((p) => ctx.isOnline(p));
        if (online.length > 0 && online.every((p) => s.answers[p])) {
            ctx.clearTimer('phase');
            reveal(s, ctx);
        }
    },
    viewFor(s, playerId) {
        const q = s.index >= 0 ? s.questions[s.index] : undefined;
        const showQ = q && (s.phase === 'question' || s.phase === 'reveal' || s.phase === 'finished');
        return {
            phase: s.phase,
            index: Math.max(0, s.index),
            total: s.questions.length,
            deadline: s.deadline,
            participants: [...s.players],
            question: showQ ? { text: q.text, options: [...q.options], category: q.category } : null,
            myAnswer: playerId ? (s.answers[playerId]?.option ?? null) : null,
            answeredPlayers: Object.keys(s.answers),
            totals: { ...s.totals },
            streaks: { ...s.streaks },
            reveal: q && (s.phase === 'reveal' || s.phase === 'finished')
                ? {
                    correct: q.correct,
                    answers: Object.fromEntries(Object.entries(s.answers).map(([p, a]) => [p, a.option])),
                    gained: { ...s.gained },
                    fact: q.fact,
                }
                : null,
        };
    },
};
