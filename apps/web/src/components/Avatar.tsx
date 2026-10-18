const COLORS = ['#c6f432', '#ff5fa2', '#5cc8ff', '#ffc23d', '#a98bff', '#ff7a6b'];
const SHAPES: Record<string, string> = {
  blob: 'M50 8c22 0 40 14 40 38 0 26-16 46-40 46S10 74 10 48C10 22 28 8 50 8z',
  star: 'M50 6l12 26 28 4-20 20 5 28-25-14-25 14 5-28-20-20 28-4z',
  bolt: 'M18 14h64l-8 30h12L40 96l8-34H30z',
  moon: 'M62 8a44 44 0 1 0 30 70A36 36 0 1 1 62 8z',
  leaf: 'M14 86C14 40 40 12 88 12c0 48-28 74-74 74z',
  drop: 'M50 6c18 26 34 44 34 62a34 34 0 0 1-68 0C16 50 32 32 50 6z',
};

/** Avatar original: forma + cor derivadas de "forma-n". */
export function Avatar({
  avatar,
  size = 40,
  dim = false,
  label,
}: {
  avatar: string;
  size?: number;
  dim?: boolean;
  label?: string;
}) {
  const [shape = 'blob', n = '1'] = avatar.split('-');
  const color = COLORS[(Number(n) - 1 + COLORS.length) % COLORS.length];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label ?? 'avatar'}
      className={`shrink-0 transition ${dim ? 'opacity-40 grayscale' : ''}`}
    >
      <path
        d={SHAPES[shape] ?? SHAPES.blob}
        fill={color}
        stroke="#0f0b17"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="50" r="6" fill="#0f0b17" />
      <circle cx="60" cy="50" r="6" fill="#0f0b17" />
      <circle cx="42" cy="48" r="2" fill="#fff" />
      <circle cx="62" cy="48" r="2" fill="#fff" />
      <path
        d="M42 64q8 6 16 0"
        stroke="#0f0b17"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const AVATAR_OPTIONS = Object.keys(SHAPES).flatMap((s) =>
  [1, 2, 3, 4, 5, 6].map((n) => `${s}-${n}`),
);
