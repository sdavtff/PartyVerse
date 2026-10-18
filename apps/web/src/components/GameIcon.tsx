import type { GameId } from '@partyverse/shared';

const ACCENTS: Record<GameId, string> = {
  stop: '#c6f432',
  draw: '#ff5fa2',
  charades: '#ffc23d',
  quiz: '#5cc8ff',
  secretword: '#a98bff',
  impostor: '#ff7a6b',
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
