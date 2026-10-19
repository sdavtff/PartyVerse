import { useEffect, useRef } from 'react';
import { sfx, type Sfx } from './sound';

/** Bipe nos últimos segundos do cronômetro. */
export function useTickSound(secondsLeft: number, active: boolean, from = 5) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    if (secondsLeft > 0 && secondsLeft <= from && last.current !== secondsLeft) sfx('tick');
    last.current = secondsLeft;
  }, [secondsLeft, active, from]);
}

/** Toca um som quando a "chave" (ex.: fase do jogo) muda — não toca na primeira renderização. */
export function useSoundOnChange(key: string, pick: (key: string) => Sfx | null) {
  const prev = useRef(key);
  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    const s = pick(key);
    if (s) sfx(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
