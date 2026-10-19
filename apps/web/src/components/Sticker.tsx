import type { StickerId } from '@partyverse/shared';

/** Figurinhas originais: o "bloco" do PartyVerse com expressões diferentes. */
const INK = '#0f0b17';
const BODY = 'M50 8c22 0 40 14 40 38 0 26-16 46-40 46S10 74 10 48C10 22 28 8 50 8z';

const STICKER_DEF: Record<StickerId, { color: string; label: string; face: JSX.Element }> = {
  risada: {
    color: '#c6f432',
    label: 'Risada',
    face: (
      <>
        <path
          d="M32 44q6-8 12 0M56 44q6-8 12 0"
          stroke={INK}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M30 56h40q-4 22-20 22t-20-22z" fill={INK} />
        <path d="M40 70q10 8 20 0" fill="#ff7aa8" />
        <path d="M18 40l-6 6M82 40l6 6" stroke="#5cc8ff" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  amei: {
    color: '#ff5fa2',
    label: 'Amei',
    face: (
      <>
        {[36, 64].map((x) => (
          <path
            key={x}
            d={`M${x} 52c-8-6-10-12-5-15 3-2 5 0 5 2 0-2 2-4 5-2 5 3 3 9-5 15z`}
            fill="#ff2d6f"
            stroke={INK}
            strokeWidth="3"
          />
        ))}
        <path d="M40 64q10 9 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  bravo: {
    color: '#ff7a6b',
    label: 'Bravo',
    face: (
      <>
        <path d="M28 36l16 6M72 36l-16 6" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="38" cy="50" r="5" fill={INK} />
        <circle cx="62" cy="50" r="5" fill={INK} />
        <path
          d="M38 72q12-10 24 0"
          stroke={INK}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  chorando: {
    color: '#5cc8ff',
    label: 'Chorando',
    face: (
      <>
        <path
          d="M32 48q6 6 12 0M56 48q6 6 12 0"
          stroke={INK}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M34 54v20M66 54v20" stroke="#e6f7ff" strokeWidth="6" strokeLinecap="round" />
        <path d="M40 74q10-8 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  uau: {
    color: '#ffc23d',
    label: 'Uau',
    face: (
      <>
        <circle cx="38" cy="46" r="8" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="62" cy="46" r="8" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="38" cy="46" r="3" fill={INK} />
        <circle cx="62" cy="46" r="3" fill={INK} />
        <ellipse cx="50" cy="70" rx="7" ry="9" fill={INK} />
      </>
    ),
  },
  estiloso: {
    color: '#a98bff',
    label: 'Estiloso',
    face: (
      <>
        <path d="M24 42h52v6q-2 10-12 10t-12-10h-4q-2 10-12 10t-12-10z" fill={INK} />
        <path d="M40 68q10 6 20-2" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  festa: {
    color: '#7be0c3',
    label: 'Festa',
    face: (
      <>
        <path
          d="M36 12L50 -10L60 14Z"
          transform="translate(0 8)"
          fill="#ff5fa2"
          stroke={INK}
          strokeWidth="3"
        />
        <path
          d="M32 48q6-7 12 0M56 48q6-7 12 0"
          stroke={INK}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M42 64q8 8 16 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M58 66l22 4" stroke="#ffc23d" strokeWidth="6" strokeLinecap="round" />
        <circle cx="16" cy="30" r="3" fill="#ff5fa2" />
        <circle cx="86" cy="24" r="3" fill="#5cc8ff" />
      </>
    ),
  },
  pensando: {
    color: '#e8e1d5',
    label: 'Pensando',
    face: (
      <>
        <path d="M30 40l12-2M58 38l12 2" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <circle cx="38" cy="50" r="4.5" fill={INK} />
        <circle cx="62" cy="48" r="4.5" fill={INK} />
        <path d="M42 70h14" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="76" cy="20" r="4" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="86" cy="10" r="6" fill="#fff" stroke={INK} strokeWidth="2" />
      </>
    ),
  },
  dormindo: {
    color: '#3d3257',
    label: 'Dormindo',
    face: (
      <>
        <path
          d="M32 50q6 5 12 0M56 50q6 5 12 0"
          stroke="#fff"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="50" cy="68" rx="5" ry="4" fill="#fff" />
        <text x="70" y="26" fontSize="18" fontWeight="800" fill="#fff" fontFamily="sans-serif">
          z
        </text>
        <text x="80" y="14" fontSize="12" fontWeight="800" fill="#fff" fontFamily="sans-serif">
          z
        </text>
      </>
    ),
  },
  joinha: {
    color: '#c6f432',
    label: 'Joinha',
    face: (
      <>
        <circle cx="38" cy="44" r="5" fill={INK} />
        <circle cx="62" cy="44" r="5" fill={INK} />
        <path d="M40 58q10 8 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path
          d="M70 92V74h-6q-4 0-4-4t4-4h8l2-10q1-4 5-3 3 1 2 5l-1 8h6q4 0 4 4l-3 18q-1 4-5 4z"
          fill="#ffc23d"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  lingua: {
    color: '#ff5fa2',
    label: 'Língua',
    face: (
      <>
        <circle cx="36" cy="44" r="5" fill={INK} />
        <path d="M56 44q6-6 12 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M36 60h28" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M44 60q0 18 8 18t8-18z" fill="#ff7aa8" stroke={INK} strokeWidth="3" />
      </>
    ),
  },
  medo: {
    color: '#e8e1d5',
    label: 'Medo',
    face: (
      <>
        <circle cx="38" cy="44" r="7" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="62" cy="44" r="7" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="38" cy="46" r="2.5" fill={INK} />
        <circle cx="62" cy="46" r="2.5" fill={INK} />
        <path
          d="M36 70l5-5 5 5 4-5 4 5 5-5 5 5"
          stroke={INK}
          strokeWidth="4"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M80 30q4 6 0 10"
          stroke="#5cc8ff"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
};

export const stickerLabel = (id: string) => STICKER_DEF[id as StickerId]?.label ?? 'figurinha';

export function Sticker({ id, size = 56 }: { id: string; size?: number }) {
  const def = STICKER_DEF[id as StickerId];
  if (!def) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={def.label}>
      <path d={BODY} fill={def.color} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      {def.face}
    </svg>
  );
}
