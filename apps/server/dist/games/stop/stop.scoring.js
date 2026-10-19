import { normalize } from '../../lib/text.js';
export function startsWithLetter(answer, letter) {
    const n = normalize(answer);
    return n.length > 0 && n[0] === normalize(letter);
}
/** Função pura: calcula a pontuação de uma rodada de STOP. */
export function scoreRound(input) {
    const { letter, categories, players, answers, isRejected, points } = input;
    const statuses = {};
    const scores = {};
    const totals = {};
    for (const p of players) {
        statuses[p] = {};
        scores[p] = {};
        totals[p] = 0;
    }
    for (const cat of categories) {
        // 1ª passada: classificar vazias, inválidas e rejeitadas
        const valid = [];
        for (const p of players) {
            const raw = answers[p]?.[cat] ?? '';
            let st;
            if (!raw.trim())
                st = 'empty';
            else if (!startsWithLetter(raw, letter))
                st = 'invalid';
            else if (isRejected(p, cat))
                st = 'rejected';
            else {
                valid.push({ p, norm: normalize(raw) });
                continue;
            }
            statuses[p][cat] = st;
        }
        // 2ª passada: repetidas x únicas entre as válidas
        const counts = new Map();
        for (const v of valid)
            counts.set(v.norm, (counts.get(v.norm) ?? 0) + 1);
        for (const v of valid)
            statuses[v.p][cat] = counts.get(v.norm) > 1 ? 'repeated' : 'unique';
        for (const p of players) {
            const st = statuses[p][cat];
            const pts = st === 'unique'
                ? points.unique
                : st === 'repeated'
                    ? points.repeated
                    : st === 'rejected'
                        ? points.rejected
                        : points.empty;
            scores[p][cat] = pts;
            totals[p] += pts;
        }
    }
    return { scores, statuses, totals };
}
