import type { GameId } from '@partyverse/shared';

const ACCENTS: Record<GameId, string> = {
  stop: '#c6f432',
  draw: '#ff5fa2',
  charades: '#ffc23d',
  quiz: '#5cc8ff',
  secretword: '#a98bff',
  impostor: '#ff7a6b',
  mostlikely: '#ff9a3d',
  truthdare: '#3ee0c0',
  twotruths: '#8f9bff',
  hangman: '#ffd84d',
  tictactoe: '#4de8ff',
  checkers: '#d49a6a',
  telephone: '#ff8fc8',
  spies: '#ff5c5c',
};
export const gameAccent = (id: GameId) => ACCENTS[id];

const GLYPHS: Record<GameId, JSX.Element> = {
  stop: (
    <text
      x="32"
      y="44"
      textAnchor="middle"
      fontSize="30"
      fontWeight="800"
      fontFamily="Bricolage Grotesque, sans-serif"
      fill="#0f0b17"
    >
      A
    </text>
  ),
  draw: (
    <path
      d="M18 46l6-14 22-20 8 8-22 20z M18 46l10-4"
      stroke="#0f0b17"
      strokeWidth="4"
      fill="none"
      strokeLinejoin="round"
    />
  ),
  charades: (
    <path
      d="M20 46c0-8 4-12 8-12V18a3 3 0 0 1 6 0v12m0-6a3 3 0 0 1 6 0v8m0-4a3 3 0 0 1 6 0v12c0 6-4 10-12 10s-14-4-14-12z"
      stroke="#0f0b17"
      strokeWidth="4"
      fill="none"
      strokeLinecap="round"
    />
  ),
  quiz: (
    <text
      x="32"
      y="45"
      textAnchor="middle"
      fontSize="32"
      fontWeight="800"
      fontFamily="Bricolage Grotesque, sans-serif"
      fill="#0f0b17"
    >
      ?
    </text>
  ),
  secretword: (
    <g fill="none" stroke="#0f0b17" strokeWidth="4">
      <rect x="18" y="28" width="28" height="20" rx="4" />
      <path d="M24 28v-6a8 8 0 0 1 16 0v6" />
    </g>
  ),
  impostor: (
    <g fill="#0f0b17">
      <circle cx="24" cy="30" r="4" />
      <circle cx="40" cy="30" r="4" />
      <path d="M22 42h20" stroke="#0f0b17" strokeWidth="4" />
    </g>
  ),
  mostlikely: (
    <g fill="none" stroke="#0f0b17" strokeWidth="4" strokeLinecap="round">
      <path d="M32 20v14" />
      <path d="M22 44l10-10 10 10" />
      <circle cx="32" cy="16" r="2" fill="#0f0b17" />
    </g>
  ),
  truthdare: (
    <g fill="none" stroke="#0f0b17" strokeWidth="4" strokeLinejoin="round">
      <rect x="18" y="18" width="18" height="26" rx="4" transform="rotate(-10 27 31)" />
      <rect
        x="28"
        y="20"
        width="18"
        height="26"
        rx="4"
        transform="rotate(10 37 33)"
        fill="#3ee0c0"
      />
    </g>
  ),
  twotruths: (
    <g fill="#0f0b17">
      <rect x="16" y="20" width="32" height="5" rx="2.5" />
      <rect x="16" y="30" width="32" height="5" rx="2.5" />
      <path d="M16 42l6 6M22 42l-6 6" stroke="#0f0b17" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="42" width="20" height="5" rx="2.5" opacity=".4" />
    </g>
  ),
  hangman: (
    <g fill="none" stroke="#0f0b17" strokeWidth="4" strokeLinecap="round">
      <path d="M16 48h20M22 48V16h18v6" />
      <circle cx="40" cy="28" r="5" />
      <path d="M40 33v9M40 36l-5 4M40 36l5 4" />
    </g>
  ),
  tictactoe: (
    <g fill="none" stroke="#0f0b17" strokeWidth="4" strokeLinecap="round">
      <path d="M26 16v32M38 16v32M16 26h32M16 38h32" />
    </g>
  ),
  checkers: (
    <g stroke="#0f0b17" strokeWidth="4">
      <circle cx="26" cy="38" r="9" fill="#fff8ec" />
      <circle cx="38" cy="26" r="9" fill="#3a2c48" />
    </g>
  ),
  telephone: (
    <g fill="none" stroke="#0f0b17" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 22c0-4 3-6 7-6h14c4 0 7 2 7 6v4H38v-3H26v3H18z" />
      <path d="M22 30h20l4 16H18z" />
      <circle cx="32" cy="38" r="3" />
    </g>
  ),
  spies: (
    <g fill="#0f0b17">
      <path d="M14 30c4-8 32-8 36 0z" />
      <rect x="18" y="32" width="11" height="7" rx="3.5" />
      <rect x="35" y="32" width="11" height="7" rx="3.5" />
      <rect x="28" y="34" width="8" height="2" />
    </g>
  ),
};

export function GameIcon({ id, small }: { id: GameId; small?: boolean }) {
  const s = small ? 44 : 56;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      aria-hidden
      className="shrink-0 transition group-hover:animate-wobble"
    >
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="18"
        fill={ACCENTS[id]}
        stroke="#0f0b17"
        strokeWidth="4"
      />
      {GLYPHS[id]}
    </svg>
  );
}
