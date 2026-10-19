import { useMemo } from 'react';
import { useReducedMotion } from '../lib/prefs';

const COLORS = ['#c6f432', '#ff5fa2', '#5cc8ff', '#ffc23d', '#a98bff', '#ff7a6b'];

/** Chuva de confete para comemorar (some sozinha; desligada com "reduzir animações"). */
export function Confetti({ pieces = 80 }: { pieces?: number }) {
  const reduced = useReducedMotion();
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 240,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        round: Math.random() > 0.6,
      })),
    [pieces],
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              borderRadius: p.round ? '999px' : undefined,
              '--delay': `${p.delay}s`,
              '--dur': `${p.dur}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
