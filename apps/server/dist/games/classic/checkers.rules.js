const DIRS = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
];
export const rc = (i) => [Math.floor(i / 8), i % 8];
export const idx = (r, c) => r * 8 + c;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const colorOf = (p) => p === 'w' || p === 'W' ? 'w' : p === 'b' || p === 'B' ? 'b' : null;
const isKing = (p) => p === 'W' || p === 'B';
const forward = (c) => (c === 'w' ? -1 : 1);
export function initialBoard() {
    const b = Array(64).fill(null);
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 0)
                continue;
            if (r <= 2)
                b[idx(r, c)] = 'b';
            else if (r >= 5)
                b[idx(r, c)] = 'w';
        }
    return b;
}
/** Sequências de captura a partir de uma casa (busca em profundidade). */
function captures(board, from, piece) {
    const me = colorOf(piece);
    const king = isKing(piece);
    const out = [];
    const dfs = (pos, path, taken) => {
        let extended = false;
        const [r0, c0] = rc(pos);
        for (const [dr, dc] of DIRS) {
            let r = r0 + dr;
            let c = c0 + dc;
            // dama: desliza por casas vazias até achar uma peça
            if (king) {
                // (a casa de origem conta como vazia: a peça já saiu dela)
                while (inside(r, c) && (board[idx(r, c)] === null || idx(r, c) === from)) {
                    r += dr;
                    c += dc;
                }
            }
            if (!inside(r, c))
                continue;
            const mid = idx(r, c);
            const p = board[mid];
            if (!p || colorOf(p) === me || taken.includes(mid))
                continue;
            // casas de pouso depois da peça capturada
            let lr = r + dr;
            let lc = c + dc;
            while (inside(lr, lc)) {
                const land = idx(lr, lc);
                // a casa de origem fica vazia durante o lance
                if (board[land] !== null && land !== from)
                    break;
                extended = true;
                dfs(land, [...path, land], [...taken, mid]);
                if (!king)
                    break;
                lr += dr;
                lc += dc;
            }
        }
        if (!extended && taken.length)
            out.push({ path, captured: taken });
    };
    dfs(from, [from], []);
    return out;
}
function simpleMoves(board, from, piece) {
    const me = colorOf(piece);
    const out = [];
    const [r0, c0] = rc(from);
    for (const [dr, dc] of DIRS) {
        if (!isKing(piece) && dr !== forward(me))
            continue;
        let r = r0 + dr;
        let c = c0 + dc;
        while (inside(r, c) && board[idx(r, c)] === null) {
            out.push({ path: [from, idx(r, c)], captured: [] });
            if (!isKing(piece))
                break;
            r += dr;
            c += dc;
        }
    }
    return out;
}
/** Todas as jogadas permitidas (captura obrigatória + lei da maioria). */
export function legalMoves(board, turn) {
    const caps = [];
    const simples = [];
    board.forEach((p, i) => {
        if (colorOf(p) !== turn)
            return;
        caps.push(...captures(board, i, p));
        simples.push(...simpleMoves(board, i, p));
    });
    if (caps.length) {
        const most = Math.max(...caps.map((m) => m.captured.length));
        return caps.filter((m) => m.captured.length === most);
    }
    return simples;
}
/** Aplica uma jogada já validada; devolve o novo tabuleiro. */
export function applyMove(board, move) {
    const b = [...board];
    const from = move.path[0];
    const to = move.path.at(-1);
    let piece = b[from];
    b[from] = null;
    for (const c of move.captured)
        b[c] = null;
    const [r] = rc(to);
    if (piece === 'w' && r === 0)
        piece = 'W';
    if (piece === 'b' && r === 7)
        piece = 'B';
    b[to] = piece;
    return b;
}
export const samePath = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
