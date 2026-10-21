import { AppError } from '../../lib/errors.js';
import { rotation } from './generator.js';
import { TERMO_ANSWERS, TERMO_VALID } from './termo.words.js';

export const TERMO_MAX = 6;
export type Mark = 'correct' | 'present' | 'absent';

/** Sem acentos e minúsculo (Á → a, Ç → c). */
export const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Palavra do dia, em rodízio: não repete até todas saírem. */
export const termoAnswer = (day: string) => rotation(TERMO_ANSWERS, day, 1, 'termo')[0]!;

/** Cores de cada letra, tratando letras repetidas como no Wordle. */
export function termoMarks(guess: string, answer: string): Mark[] {
  const g = plain(guess).split('');
  const a = plain(answer).split('');
  const marks: Mark[] = g.map(() => 'absent');
  const left = new Map<string, number>();
  g.forEach((ch, i) => {
    if (ch === a[i]) marks[i] = 'correct';
    else left.set(a[i]!, (left.get(a[i]!) ?? 0) + 1);
  });
  g.forEach((ch, i) => {
    if (marks[i] === 'correct') return;
    const n = left.get(ch) ?? 0;
    if (n > 0) {
      marks[i] = 'present';
      left.set(ch, n - 1);
    }
  });
  return marks;
}

export interface TermoData {
  guesses: string[];
  done: boolean;
  won: boolean;
}

export function checkGuess(raw: string) {
  const guess = plain(raw.trim());
  if (!/^[a-z]{5}$/.test(guess)) throw new AppError('VALIDATION', 'Use uma palavra de 5 letras');
  if (!TERMO_VALID.has(guess)) throw new AppError('VALIDATION', 'Essa palavra não está na lista');
  return guess;
}

/** Pontos: acertar na 1ª vale 600, na 6ª vale 100; errar vale 0. */
export const termoScore = (d: TermoData) => (d.won ? (TERMO_MAX + 1 - d.guesses.length) * 100 : 0);
