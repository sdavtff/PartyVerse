import type { GameId } from '@partyverse/shared';
import { useId } from 'react';
import { gameAccent, gameGlyph } from './GameIcon';

/**
 * Capa ilustrada de um jogo (desenho próprio em SVG): céu violeta, planeta, cidade em
 * silhueta e o ícone do jogo flutuando com brilho na cor dele.
 */
export function GameCover({
  id,
  className = '',
  variant = 'card',
}: {
  id: GameId;
  className?: string;
  /** hero: ícone grande à direita; card: centralizado */
  variant?: 'hero' | 'card';
}) {
  const uid = useId().replace(/:/g, '');
  const accent = gameAccent(id);
  const hero = variant === 'hero';
  // prédios: alturas fixas por posição (sem aleatório: a capa é sempre igual)
  const towers = [38, 62, 46, 80, 54, 70, 42, 90, 58, 48, 74, 40, 66, 52];
  return (
    <svg
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1036" />
          <stop offset=".65" stopColor="#2c1660" />
          <stop offset="1" stopColor="#0c0a16" />
        </linearGradient>
        <radialGradient id={`glow${uid}`} cx={hero ? '.72' : '.5'} cy=".45" r=".55">
          <stop offset="0" stopColor={accent} stopOpacity=".55" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`moon${uid}`} cx=".35" cy=".35" r=".8">
          <stop offset="0" stopColor="#f4e8ff" />
          <stop offset=".5" stopColor="#c08cff" />
          <stop offset="1" stopColor="#7b3fe4" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky${uid})`} />
      {/* estrelas */}
      {Array.from({ length: 26 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 97) % 400}
          cy={(i * 53) % 120}
          r={i % 5 === 0 ? 1.4 : 0.8}
          fill="#fff"
          opacity={0.35 + (i % 4) * 0.12}
        />
      ))}
      <circle
        cx={hero ? 236 : 300}
        cy="70"
        r={hero ? 58 : 44}
        fill={`url(#moon${uid})`}
        opacity=".85"
      />
      <rect width="400" height="220" fill={`url(#glow${uid})`} />
      {/* cidade */}
      <g fill="#0c0a16" opacity=".92">
        {towers.map((h, i) => (
          <rect key={i} x={i * 29 - 4} y={220 - h} width="26" height={h} rx="2" />
        ))}
      </g>
      <g fill={accent} opacity=".55">
        {towers.map((h, i) =>
          i % 2 ? (
            <rect key={i} x={i * 29 + 4} y={226 - h} width="3" height="3" rx="1" />
          ) : (
            <rect key={i} x={i * 29 + 12} y={234 - h} width="3" height="3" rx="1" />
          ),
        )}
      </g>
      {/* ícone do jogo flutuando */}
      <g
        transform={
          hero
            ? 'translate(196 74) rotate(-8 32 32) scale(1.2)'
            : 'translate(150 46) rotate(-6 50 50) scale(1.55)'
        }
      >
        <rect x="4" y="8" width="56" height="56" rx="16" fill="#000" opacity=".35" />
        <rect x="4" y="4" width="56" height="56" rx="16" fill={accent} />
        <rect
          x="4.75"
          y="4.75"
          width="54.5"
          height="54.5"
          rx="15.25"
          fill="none"
          stroke="#fff"
          strokeOpacity=".4"
          strokeWidth="1.5"
        />
        {gameGlyph(id)}
      </g>
    </svg>
  );
}
