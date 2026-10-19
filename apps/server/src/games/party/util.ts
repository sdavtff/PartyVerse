import { randomInt } from 'node:crypto';

export const shuffle = <T>(xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Junta a lista padrão com a personalizada (ou só a personalizada, se pedido e houver o bastante). */
export function deck(
  base: readonly string[],
  custom: readonly string[],
  onlyCustom: boolean,
  min = 1,
) {
  if (onlyCustom && custom.length >= min) return shuffle(custom);
  // as do anfitrião aparecem primeiro, misturadas, e depois as padrão
  return [...shuffle(custom), ...shuffle(base.filter((b) => !custom.includes(b)))];
}

export const maxBy = (scores: Record<string, number>, ids: string[]) => {
  const max = Math.max(0, ...ids.map((p) => scores[p] ?? 0));
  return ids.filter((p) => (scores[p] ?? 0) === max);
};
