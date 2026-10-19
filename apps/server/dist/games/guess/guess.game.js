import { guessActionSchema, guessSettingsSchema, } from '@partyverse/shared';
import { randomInt } from 'node:crypto';
import { AppError, invalidState } from '../../lib/errors.js';
import { normalize } from '../../lib/text.js';
import { WORD_CATEGORY_LABELS, wordsFor } from './words.js';
const CHOOSE_SECONDS = 12;
const TURN_END_SECONDS = 6;
const MAX_STROKE_POINTS = 30_000; // limite de pontos de desenho por turno
const MAX_ITEMS = 3_000;
export const GUESS_POINTS = {
    /** quem acerta: entre min e max conforme o tempo restante */
    max: 100,
    min: 20,
    /** bônus para o 1º e o 2º a acertar */
    firstBonus: 20,
    secondBonus: 10,
    /** quem desenha/encena/dá dicas ganha por pessoa que acerta */
    perGuesser: 25,
};
const shuffle = (xs) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
const isLetter = (ch) => /[\p{L}\p{N}]/u.test(ch);
/** Distância de edição (para avisar "quase!"). */
export function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 2)
        return 99;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return dp[b.length];
}
/** Compara ignorando acento, caixa, espaços e hífens. */
const squash = (s) => normalize(s).replace(/[\s-]+/g, '');
export function isCloseGuess(guess, word) {
    const g = squash(guess);
    const w = squash(word);
    if (!g || g === w)
        return false;
    const limit = w.length >= 7 ? 2 : 1;
    return w.length >= 4 && editDistance(g, w) <= limit;
}
/** Pontos de quem acerta. */
export function guessPoints(elapsedMs, limitMs, order, variant, clues) {
    const frac = Math.min(1, Math.max(0, 1 - elapsedMs / limitMs));
    let pts = GUESS_POINTS.min + Math.round((GUESS_POINTS.max - GUESS_POINTS.min) * frac);
    if (order === 0)
        pts += GUESS_POINTS.firstBonus;
    if (order === 1)
        pts += GUESS_POINTS.secondBonus;
    // Palavra Secreta: cada dica extra vale menos
    if (variant === 'secretword' && clues > 1)
        pts = Math.round(pts * Math.max(0.4, 1 - 0.12 * (clues - 1)));
    return pts;
}
export function createGuessGame(id, variant, defaults) {
    const online = (s, ctx) => s.players.filter((p) => ctx.isOnline(p));
    const guessers = (s, ctx) => online(s, ctx).filter((p) => p !== s.currentId);
    function setPhase(s, ctx, phase, secs) {
        s.phase = phase;
        s.deadline = ctx.now() + secs * 1000;
        ctx.setTimer('phase', secs * 1000, () => game.advancePhase(s, ctx));
        if (phase === 'playing' && s.settings.letterHints)
            scheduleHints(s, ctx);
        ctx.sync();
    }
    /** Revela letras em 50% e 75% do tempo (até ~1/3 das letras). */
    function scheduleHints(s, ctx) {
        const total = s.settings.turnSeconds * 1000;
        const letters = [...s.word].filter(isLetter).length;
        const maxReveal = Math.max(0, Math.floor(letters / 3));
        const marks = maxReveal >= 2 ? [0.5, 0.75] : maxReveal === 1 ? [0.6] : [];
        marks.forEach((m, i) => ctx.setTimer(`hint${i}`, total * m, () => {
            if (s.phase !== 'playing')
                return;
            const hidden = [...s.word]
                .map((ch, idx) => (isLetter(ch) && !s.revealed.includes(idx) ? idx : -1))
                .filter((x) => x >= 0);
            const howMany = i === marks.length - 1 ? maxReveal - s.revealed.length : 1;
            for (const idx of shuffle(hidden).slice(0, Math.max(0, howMany)))
                s.revealed.push(idx);
            ctx.notice('Dica: uma letra foi revelada!');
            ctx.sync();
        }));
    }
    function clearHintTimers(ctx) {
        ctx.clearTimer('hint0');
        ctx.clearTimer('hint1');
    }
    function nextTurn(s, ctx) {
        // próximo da ordem que ainda esteja na partida (pula quem saiu)
        while (true) {
            if (s.turnInRound >= s.order.length) {
                if (s.round >= s.settings.rounds)
                    return finish(s, ctx);
                s.round += 1;
                s.turnInRound = 0;
                s.order = shuffle(s.players);
            }
            const candidate = s.order[s.turnInRound];
            s.turnInRound += 1;
            if (ctx.isOnline(candidate)) {
                s.currentId = candidate;
                break;
            }
            if (online(s, ctx).length === 0)
                return finish(s, ctx);
        }
        s.turn += 1;
        s.word = '';
        s.category = null;
        s.revealed = [];
        s.guessed = [];
        s.turnScores = null;
        s.items = [];
        s.pointCount = 0;
        s.clues = [];
        const pool = wordsFor(s.settings.category, variant).filter((w) => !s.usedWords.includes(w.word));
        s.choices = shuffle(pool.length >= 3 ? pool : wordsFor(s.settings.category, variant)).slice(0, 3);
        ctx.notice(`Vez de ${ctx.nickname(s.currentId)} escolher a palavra`);
        setPhase(s, ctx, 'choosing', CHOOSE_SECONDS);
    }
    function startPlaying(s, ctx, index) {
        const pick = s.choices[index] ?? s.choices[0];
        s.word = pick.word;
        s.category = WORD_CATEGORY_LABELS[pick.category];
        s.usedWords.push(pick.word);
        s.choices = [];
        s.turnStartedAt = ctx.now();
        const verb = { draw: 'desenhando', charades: 'fazendo mímica', secretword: 'dando dicas' }[variant];
        ctx.notice(`${ctx.nickname(s.currentId)} está ${verb}!`);
        setPhase(s, ctx, 'playing', s.settings.turnSeconds);
    }
    function endTurn(s, ctx) {
        clearHintTimers(ctx);
        const scores = Object.fromEntries(s.players.map((p) => [p, 0]));
        for (const g of s.guessed)
            scores[g.id] = g.points;
        if (s.currentId)
            scores[s.currentId] = Math.min(GUESS_POINTS.perGuesser * s.guessed.length, GUESS_POINTS.perGuesser * 6);
        for (const p of s.players)
            s.totals[p] = (s.totals[p] ?? 0) + (scores[p] ?? 0);
        s.turnScores = scores;
        const feat = (id) => (s.feats[id] ??= { firstGuesses: 0, allGuessedTurns: 0 });
        if (s.guessed[0])
            feat(s.guessed[0].id).firstGuesses += 1;
        if (s.currentId && s.guessed.length > 0 && s.guessed.length >= s.players.length - 1)
            feat(s.currentId).allGuessedTurns += 1;
        ctx.notice(`A palavra era: ${s.word}`);
        setPhase(s, ctx, 'turn-end', TURN_END_SECONDS);
    }
    function finish(s, ctx) {
        clearHintTimers(ctx);
        s.phase = 'finished';
        s.deadline = null;
        ctx.clearTimer('phase');
        ctx.sync();
        ctx.finish();
    }
    function checkAllGuessed(s, ctx) {
        const g = guessers(s, ctx);
        if (s.phase === 'playing' &&
            g.length > 0 &&
            g.every((p) => s.guessed.some((x) => x.id === p))) {
            ctx.clearTimer('phase');
            endTurn(s, ctx);
        }
    }
    function applyDraw(s, ops) {
        for (const op of ops) {
            if (op.t === 'clear') {
                s.items = [];
                s.pointCount = 0;
            }
            else if (op.t === 'u') {
                const last = s.items.pop();
                if (last && 'p' in last)
                    s.pointCount -= last.p.length;
            }
            else if (op.t === 'a') {
                let item;
                for (let k = s.items.length - 1; k >= 0 && !item; k--)
                    if (s.items[k].id === op.id)
                        item = s.items[k];
                if (!item || item.t !== 's')
                    continue;
                if (s.pointCount + op.p.length > MAX_STROKE_POINTS)
                    throw new AppError('VALIDATION', 'Desenho muito grande: limpe a tela');
                item.p.push(...op.p);
                s.pointCount += op.p.length;
            }
            else {
                if (s.items.length >= MAX_ITEMS)
                    throw new AppError('VALIDATION', 'Desenho muito grande: limpe a tela');
                const len = 'p' in op ? op.p.length : 0;
                if (s.pointCount + len > MAX_STROKE_POINTS)
                    throw new AppError('VALIDATION', 'Desenho muito grande: limpe a tela');
                s.items.push(op.t === 's' ? { ...op, p: [...op.p] } : op);
                s.pointCount += len;
            }
        }
    }
    const game = {
        id,
        minPlayers: 2,
        settingsSchema: guessSettingsSchema,
        defaultSettings: () => ({ ...defaults }),
        createInitialState(players, settings) {
            const ids = players.map((p) => p.id);
            return {
                variant,
                settings,
                players: ids,
                order: shuffle(ids),
                phase: 'choosing',
                round: 1,
                turnInRound: 0,
                turn: 0,
                deadline: null,
                turnStartedAt: 0,
                currentId: null,
                choices: [],
                word: '',
                category: null,
                revealed: [],
                guessed: [],
                turnScores: null,
                totals: Object.fromEntries(ids.map((p) => [p, 0])),
                usedWords: [],
                items: [],
                pointCount: 0,
                clues: [],
                feats: {},
            };
        },
        startRound(s, ctx) {
            nextTurn(s, ctx);
        },
        validateAction(s, playerId, raw) {
            const action = guessActionSchema.parse(raw);
            if (!s.players.includes(playerId))
                throw new AppError('FORBIDDEN', 'Você está assistindo esta partida', 403);
            const mine = playerId === s.currentId;
            switch (action.type) {
                case 'choose':
                    if (!mine)
                        throw new AppError('FORBIDDEN', 'Não é a sua vez', 403);
                    if (s.phase !== 'choosing')
                        throw invalidState('A palavra já foi escolhida');
                    break;
                case 'draw':
                    if (variant !== 'draw')
                        throw new AppError('VALIDATION', 'Este jogo não tem desenho');
                    if (!mine)
                        throw new AppError('FORBIDDEN', 'Só quem está desenhando pode desenhar', 403);
                    if (s.phase !== 'playing')
                        throw invalidState('Agora não dá para desenhar');
                    break;
                case 'clue': {
                    if (variant !== 'secretword')
                        throw new AppError('VALIDATION', 'Este jogo não tem dicas');
                    if (!mine)
                        throw new AppError('FORBIDDEN', 'Só quem sabe a palavra dá dicas', 403);
                    if (s.phase !== 'playing')
                        throw invalidState('Agora não dá para mandar dica');
                    if (s.clues.length >= s.settings.maxClues)
                        throw new AppError('VALIDATION', 'Você já usou todas as dicas');
                    const c = squash(action.text);
                    const w = squash(s.word);
                    if (!c || c.includes(w) || (c.length >= 4 && w.includes(c)))
                        throw new AppError('VALIDATION', 'A dica não pode conter a palavra');
                    if (action.text.trim().split(/\s+/).length > 3)
                        throw new AppError('VALIDATION', 'Use no máximo 3 palavras por dica');
                    break;
                }
                case 'giveUp':
                    if (!mine || s.phase !== 'playing')
                        throw invalidState('Nada para pular agora');
                    break;
            }
            return action;
        },
        processAction(s, playerId, action, ctx) {
            switch (action.type) {
                case 'choose':
                    ctx.clearTimer('phase');
                    return startPlaying(s, ctx, action.index);
                case 'draw':
                    applyDraw(s, action.ops);
                    // traços vão direto para os outros, sem reenviar a visão inteira
                    ctx.emit({ kind: 'draw', turn: s.turn, ops: action.ops }, playerId);
                    return;
                case 'clue':
                    s.clues.push(action.text.trim());
                    ctx.notice(`Dica ${s.clues.length}: ${action.text.trim()}`);
                    ctx.sync();
                    return;
                case 'giveUp':
                    ctx.clearTimer('phase');
                    ctx.notice(`${ctx.nickname(playerId)} passou a vez`);
                    return endTurn(s, ctx);
            }
        },
        advancePhase(s, ctx) {
            switch (s.phase) {
                case 'choosing':
                    return startPlaying(s, ctx, randomInt(Math.max(1, s.choices.length)));
                case 'playing':
                    return endTurn(s, ctx);
                case 'turn-end':
                    return nextTurn(s, ctx);
                case 'finished':
                    return;
            }
        },
        onChat(s, playerId, text, ctx) {
            if (s.phase !== 'playing' || !s.word)
                return { consumed: false };
            const isWord = squash(text) === squash(s.word);
            const containsWord = squash(text).includes(squash(s.word));
            if (playerId === s.currentId) {
                if (containsWord) {
                    ctx.whisper(playerId, 'Ei, não vale escrever a palavra no chat!');
                    return { consumed: true };
                }
                return { consumed: false };
            }
            if (!s.players.includes(playerId)) {
                // espectador: pode conversar, mas não chutar
                return { consumed: containsWord };
            }
            const already = s.guessed.some((g) => g.id === playerId);
            if (already) {
                // quem já acertou só fala com quem também sabe a resposta
                const insiders = [s.currentId, ...s.guessed.map((g) => g.id)];
                ctx.chatTo(playerId, text, insiders);
                return { consumed: true };
            }
            if (isWord) {
                const pts = guessPoints(ctx.now() - s.turnStartedAt, s.settings.turnSeconds * 1000, s.guessed.length, variant, s.clues.length);
                s.guessed.push({ id: playerId, points: pts });
                ctx.announce(`${ctx.nickname(playerId)} acertou!`, 'guess-correct');
                ctx.sync();
                checkAllGuessed(s, ctx);
                return { consumed: true };
            }
            if (isCloseGuess(text, s.word)) {
                ctx.whisper(playerId, `"${text}" está quase!`, 'guess-close');
                return { consumed: true };
            }
            return { consumed: false };
        },
        calculateScores: (s) => ({ ...s.totals }),
        determineWinners(s) {
            const max = Math.max(...s.players.map((p) => s.totals[p] ?? 0));
            return s.players.filter((p) => (s.totals[p] ?? 0) === max);
        },
        finalize: (s) => ({ rounds: s.round }),
        highlights: (s) => Object.fromEntries(s.players.map((p) => [p, { ...(s.feats[p] ?? {}) }])),
        isParticipant: (s, playerId) => s.players.includes(playerId),
        onPlayerLeft(s, playerId, ctx) {
            // quem está na vez caiu: o turno acaba (a pessoa pode voltar no próximo)
            if (playerId === s.currentId && !ctx.isOnline(playerId)) {
                if (s.phase === 'choosing') {
                    ctx.clearTimer('phase');
                    return nextTurn(s, ctx);
                }
                if (s.phase === 'playing') {
                    ctx.clearTimer('phase');
                    return endTurn(s, ctx);
                }
            }
            checkAllGuessed(s, ctx);
        },
        viewFor(s, playerId) {
            const isCurrent = playerId !== null && playerId === s.currentId;
            const reveal = s.phase === 'turn-end' || s.phase === 'finished';
            const knows = isCurrent || reveal;
            return {
                variant,
                phase: s.phase,
                round: s.round,
                totalRounds: s.settings.rounds,
                turn: s.turn,
                totalTurns: s.settings.rounds * s.players.length,
                deadline: s.deadline,
                participants: [...s.players],
                currentId: s.currentId,
                choices: isCurrent && s.phase === 'choosing' ? s.choices.map((c) => c.word) : null,
                word: knows && s.word ? s.word : null,
                mask: s.word
                    ? [...s.word].map((ch, i) => !isLetter(ch) ? ch : knows || s.revealed.includes(i) ? ch : '_')
                    : [],
                category: s.category,
                guessed: s.guessed.map((g) => ({ ...g })),
                turnScores: s.turnScores,
                totals: { ...s.totals },
                ops: variant === 'draw' ? s.items : [],
                clues: [...s.clues],
                maxClues: s.settings.maxClues,
            };
        },
    };
    return game;
}
export const drawGame = createGuessGame('draw', 'draw', {
    rounds: 2,
    turnSeconds: 80,
    category: 'misto',
    letterHints: true,
    maxClues: 5,
});
export const charadesGame = createGuessGame('charades', 'charades', {
    rounds: 2,
    turnSeconds: 90,
    category: 'acoes',
    letterHints: true,
    maxClues: 5,
});
export const secretWordGame = createGuessGame('secretword', 'secretword', {
    rounds: 2,
    turnSeconds: 90,
    category: 'misto',
    letterHints: false,
    maxClues: 5,
});
