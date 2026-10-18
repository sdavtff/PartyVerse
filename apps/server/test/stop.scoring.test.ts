import { describe, expect, it } from 'vitest';
import { scoreRound, startsWithLetter } from '../src/games/stop/stop.scoring.js';

const points = { unique: 10, repeated: 5, empty: 0, rejected: 0 };

describe('STOP — pontuação', () => {
  it('ignora acentos e caixa ao checar a letra', () => {
    expect(startsWithLetter('  Ásia', 'A')).toBe(true);
    expect(startsWithLetter('banana', 'A')).toBe(false);
    expect(startsWithLetter('', 'A')).toBe(false);
  });

  it('pontua únicas, repetidas, vazias, fora da letra e rejeitadas', () => {
    const r = scoreRound({
      letter: 'A',
      categories: ['Animal', 'Fruta'],
      players: ['p1', 'p2', 'p3'],
      answers: {
        p1: { Animal: 'Abelha', Fruta: 'Abacaxi' },
        p2: { Animal: 'abelha ', Fruta: 'Banana' },
        p3: { Animal: 'Arara', Fruta: '' },
      },
      isRejected: (p, c) => p === 'p3' && c === 'Animal',
      points,
    });
    expect(r.statuses.p1).toEqual({ Animal: 'repeated', Fruta: 'unique' });
    expect(r.statuses.p2).toEqual({ Animal: 'repeated', Fruta: 'invalid' });
    expect(r.statuses.p3).toEqual({ Animal: 'rejected', Fruta: 'empty' });
    expect(r.totals).toEqual({ p1: 15, p2: 5, p3: 0 });
  });

  it('respeita pontos configuráveis', () => {
    const r = scoreRound({
      letter: 'C',
      categories: ['Cidade'],
      players: ['a', 'b'],
      answers: { a: { Cidade: 'Curitiba' }, b: { Cidade: '' } },
      isRejected: () => false,
      points: { unique: 7, repeated: 3, empty: 1, rejected: 0 },
    });
    expect(r.totals).toEqual({ a: 7, b: 1 });
  });

  it('resposta rejeitada não transforma a outra em repetida', () => {
    const r = scoreRound({
      letter: 'B',
      categories: ['Nome'],
      players: ['a', 'b'],
      answers: { a: { Nome: 'Bia' }, b: { Nome: 'Bia' } },
      isRejected: (p) => p === 'b',
      points,
    });
    expect(r.statuses.a!.Nome).toBe('unique');
  });
});
