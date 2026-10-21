import type { CheckersView, HangmanView, TicTacToeView } from '@partyverse/shared';
import { describe, expect, it } from 'vitest';
import type { AnyGameModule } from '../src/games/GameModule.js';
import { checkersGame } from '../src/games/classic/checkers.game.js';
import {
  applyMove,
  idx,
  initialBoard,
  legalMoves,
  type Board,
} from '../src/games/classic/checkers.rules.js';
import { hangmanGame } from '../src/games/classic/hangman.game.js';
import { ticTacToeGame, winnerOf } from '../src/games/classic/tictactoe.game.js';
import { termoMarks, checkGuess, termoAnswer } from '../src/modules/daily/termo.js';
import { fakeCtx } from './fakeCtx.js';

function setup(mod: AnyGameModule, settings: Record<string, unknown> = {}, n = 2) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const s = mod.createInitialState(
    players,
    mod.settingsSchema.parse({ ...mod.defaultSettings(), ...settings }),
  );
  const f = fakeCtx();
  const act = (pid: string, a: unknown) =>
    mod.processAction(s, pid, mod.validateAction(s, pid, a), f.ctx);
  mod.startRound(s, f.ctx);
  return { s, ...f, act, view: (id: string | null = null) => mod.viewFor(s, id) };
}

describe('Termo', () => {
  it('cores com letras repetidas e acentos', () => {
    expect(termoMarks('arara', 'carta')).toEqual([
      'present',
      'present',
      'absent',
      'absent',
      'correct',
    ]);
    expect(termoMarks('aviao', 'avião')).toEqual(Array(5).fill('correct'));
    expect(termoMarks('sssss', 'casas')).toEqual([
      'absent',
      'absent',
      'correct',
      'absent',
      'correct',
    ]);
    expect(() => checkGuess('xyzzy')).toThrow('lista');
    expect(() => checkGuess('abc')).toThrow('5 letras');
    expect(checkGuess('Pátio')).toBe('patio');
    expect(termoAnswer('2026-10-21')).toBe(termoAnswer('2026-10-21'));
  });
});

describe('Forca', () => {
  it('turnos, acertos, erros e chute da palavra', () => {
    const g = setup(
      hangmanGame,
      { rounds: 1, lives: 4, category: 'personalizado', customWords: ['maçã verde', 'abc', 'xyz'] },
      2,
    );
    let v = g.view() as HangmanView;
    expect(v.mask.some((c) => c === '_')).toBe(true);
    expect(v.word).toBeNull();
    const first = v.currentId!;
    const other = first === 'p1' ? 'p2' : 'p1';
    expect(() => g.act(other, { type: 'letter', letter: 'a' })).toThrow('vez');
    g.s.word = 'MAÇÃ VERDE';
    g.act(first, { type: 'letter', letter: 'a' }); // acerta 2x (á e a)
    v = g.view() as HangmanView;
    expect(v.totals[first]).toBe(20);
    expect(v.currentId).toBe(first); // acertou, joga de novo
    g.act(first, { type: 'letter', letter: 'z' });
    v = g.view() as HangmanView;
    expect(v.lives).toBe(3);
    expect(v.currentId).toBe(other);
    g.act(other, { type: 'word', word: 'maca verde' });
    v = g.view() as HangmanView;
    expect(v.phase).toBe('round-end');
    expect(v.solvedBy).toBe(other);
    expect(v.word).toBe('MAÇÃ VERDE');
    g.timers.get('phase')!();
    expect(g.ctx.finish).toHaveBeenCalled();
  });
});

describe('Jogo da velha', () => {
  it('vitória, alternância de X e melhor de 3', () => {
    expect(winnerOf(['X', 'X', 'X', null, null, null, null, null, null])?.winner).toBe('X');
    const g = setup(ticTacToeGame, { games: 3 }, 3);
    let v = g.view() as TicTacToeView;
    expect(v.participants).toEqual(['p1', 'p2']);
    expect(v.x).toBe('p1');
    expect(() => g.act('p3', { type: 'mark', cell: 0 })).toThrow();
    for (const [p, c] of [
      ['p1', 0],
      ['p2', 3],
      ['p1', 1],
      ['p2', 4],
      ['p1', 2],
    ] as const)
      g.act(p, { type: 'mark', cell: c });
    v = g.view() as TicTacToeView;
    expect(v.winner).toBe('X');
    expect(v.totals.p1).toBe(3);
    g.timers.get('phase')!();
    v = g.view() as TicTacToeView;
    expect(v.x).toBe('p2'); // inverte
    for (const [p, c] of [
      ['p2', 0],
      ['p1', 3],
      ['p2', 1],
      ['p1', 4],
      ['p2', 2],
    ] as const)
      g.act(p, { type: 'mark', cell: c });
    g.timers.get('phase')!();
    v = g.view() as TicTacToeView;
    expect(v.game).toBe(3);
    // tempo esgotado: jogada automática
    g.timers.get('phase')!();
    expect((g.view() as TicTacToeView).board.filter(Boolean)).toHaveLength(1);
  });
});

describe('Damas (regras brasileiras)', () => {
  const empty = (): Board => Array(64).fill(null);

  it('abertura: 7 jogadas simples das brancas', () => {
    const m = legalMoves(initialBoard(), 'w');
    expect(m).toHaveLength(7);
    expect(m.every((x) => x.captured.length === 0)).toBe(true);
  });

  it('captura obrigatória, para trás e lei da maioria', () => {
    const b = empty();
    b[idx(4, 3)] = 'w';
    b[idx(5, 4)] = 'b'; // atrás do peão: captura para trás vale
    b[idx(3, 2)] = 'b';
    b[idx(1, 2)] = 'b'; // pela esquerda dá para pegar duas
    b[idx(2, 7)] = 'b';
    const m = legalMoves(b, 'w');
    expect(m.every((x) => x.captured.length === 2)).toBe(true);
    expect(m[0]!.path).toEqual([idx(4, 3), idx(2, 1), idx(0, 3)]);
    const after = applyMove(b, m[0]!);
    expect(after[idx(0, 3)]).toBe('W'); // promoveu ao terminar na última fileira
    expect(after[idx(3, 2)]).toBeNull();
  });

  it('dama voadora captura de longe e pousa em várias casas', () => {
    const b = empty();
    b[idx(7, 0)] = 'W';
    b[idx(4, 3)] = 'b';
    b[idx(0, 7)] = 'b'; // trava a diagonal no fim
    const m = legalMoves(b, 'w');
    expect(m.map((x) => x.path.at(-1)).sort()).toEqual([idx(3, 4), idx(2, 5), idx(1, 6)].sort());
  });

  it('partida: jogada inválida é recusada e só quem está na vez vê as jogadas', () => {
    const g = setup(checkersGame, {}, 2);
    let v = g.view('p1') as CheckersView;
    expect(v.white).toBe('p1');
    expect(v.moves.length).toBe(7);
    expect((g.view('p2') as CheckersView).moves).toEqual([]);
    expect(() => g.act('p1', { type: 'move', path: [idx(5, 0), idx(3, 2)] })).toThrow('inválida');
    g.act('p1', { type: 'move', path: v.moves[0]! });
    v = g.view('p2') as CheckersView;
    expect(v.turn).toBe('b');
    expect(v.moves.length).toBeGreaterThan(0);
  });
});
