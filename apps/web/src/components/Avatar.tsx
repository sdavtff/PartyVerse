import { parseAvatar, shopItem } from '@partyverse/shared';
import { useId } from 'react';
/**
 * Avatares originais do PartyVerse.
 * - Formato antigo "forma-n": bichinho de uma forma geométrica.
 * - Formato montado "c-xxxxxx": 6 partes em base 36 (fundo, pele, cabelo, olhos, boca, acessório),
 *   criado no AvatarEditor.
 */
const COLORS = ['#c6f432', '#ff5fa2', '#5cc8ff', '#ffc23d', '#a98bff', '#ff7a6b'];
const SHAPES: Record<string, string> = {
  blob: 'M50 8c22 0 40 14 40 38 0 26-16 46-40 46S10 74 10 48C10 22 28 8 50 8z',
  star: 'M50 6l12 26 28 4-20 20 5 28-25-14-25 14 5-28-20-20 28-4z',
  bolt: 'M18 14h64l-8 30h12L40 96l8-34H30z',
  moon: 'M62 8a44 44 0 1 0 30 70A36 36 0 1 1 62 8z',
  leaf: 'M14 86C14 40 40 12 88 12c0 48-28 74-74 74z',
  drop: 'M50 6c18 26 34 44 34 62a34 34 0 0 1-68 0C16 50 32 32 50 6z',
};

const INK = '#0f0b17';

export const PARTS = {
  bg: [
    '#c6f432',
    '#ff5fa2',
    '#5cc8ff',
    '#ffc23d',
    '#a98bff',
    '#ff7a6b',
    '#7be0c3',
    '#3d3257',
    '#e8b923',
    '#1b2550',
  ],
  skin: ['#ffe0c7', '#f5c6a0', '#e0a676', '#b97a4f', '#8a5636', '#5b3a26'],
  hairColor: ['#2b1d16', '#6b4226', '#d9a441', '#e8e1d5', '#ff5fa2', '#5cc8ff'],
  hairStyle: ['Careca', 'Curto', 'Comprido', 'Cacheado', 'Moicano', 'Coque'],
  eyes: ['Pontinhos', 'Felizes', 'Grandes', 'Sonolentos', 'Piscando', 'Espantados'],
  mouth: ['Sorriso', 'Risada', 'Boca aberta', 'Sério', 'Língua', 'Ó'],
  accessory: [
    'Nada',
    'Óculos',
    'Boné',
    'Coroa',
    'Fones',
    'Laço',
    'Chapéu de festa',
    'Gorro',
    'Óculos escuros',
    'Bandana',
    'Cartola',
    'Auréola',
    'Chapéu de mago',
    'Coroa de diamante',
  ],
} as const;

export interface AvatarParts {
  bg: number;
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyes: number;
  mouth: number;
  accessory: number;
}

const b36 = (n: number) => n.toString(36);

export function encodeAvatar(p: AvatarParts): string {
  const hair = p.hairStyle * PARTS.hairColor.length + p.hairColor; // 0..35 cabe num dígito
  return `c-${b36(p.bg)}${b36(p.skin)}${b36(hair)}${b36(p.eyes)}${b36(p.mouth)}${b36(p.accessory)}`;
}

export function decodeAvatar(code: string): AvatarParts | null {
  // ignora os itens da loja (".f2.n1") no fim do código
  const m = /^c-([0-9a-z]{6})(\.|$)/.exec(code);
  if (!m) return null;
  const d = [...m[1]!].map((c) => parseInt(c, 36));
  const hair = d[2]!;
  const clamp = (v: number, len: number) => (v >= 0 && v < len ? v : 0);
  return {
    bg: clamp(d[0]!, PARTS.bg.length),
    skin: clamp(d[1]!, PARTS.skin.length),
    hairStyle: clamp(Math.floor(hair / PARTS.hairColor.length), PARTS.hairStyle.length),
    hairColor: clamp(hair % PARTS.hairColor.length, PARTS.hairColor.length),
    eyes: clamp(d[3]!, PARTS.eyes.length),
    mouth: clamp(d[4]!, PARTS.mouth.length),
    accessory: clamp(d[5]!, PARTS.accessory.length),
  };
}

export function randomAvatarParts(): AvatarParts {
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    bg: r(8),
    skin: r(PARTS.skin.length),
    hairStyle: r(PARTS.hairStyle.length),
    hairColor: r(PARTS.hairColor.length),
    eyes: r(PARTS.eyes.length),
    mouth: r(PARTS.mouth.length),
    accessory: Math.random() < 0.4 ? 0 : r(8),
  };
}

function Character({ p }: { p: AvatarParts }) {
  const skin = PARTS.skin[p.skin];
  const hc = PARTS.hairColor[p.hairColor];
  const s = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const };
  const behindHair =
    p.hairStyle === 2 ? (
      <path d="M19 52Q19 21 50 21Q81 21 81 52L84 88Q50 95 16 88Z" fill={hc} {...s} />
    ) : null;
  const frontHair = [
    null,
    <path key="1" d="M22 52Q20 23 50 23Q80 23 78 52Q72 36 50 35Q30 35 22 52Z" fill={hc} {...s} />,
    <path key="2" d="M22 54Q20 23 50 23Q80 23 78 54Q74 38 58 34Q42 42 22 54Z" fill={hc} {...s} />,
    <g key="3" fill={hc} {...s}>
      {[
        [26, 44],
        [30, 32],
        [41, 25],
        [54, 23],
        [66, 28],
        [74, 38],
        [77, 50],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={10} />
      ))}
    </g>,
    <path key="4" d="M41 36Q44 8 50 6Q56 8 59 36Z" fill={hc} {...s} />,
    <g key="5" fill={hc} {...s}>
      <circle cx="50" cy="17" r="10" />
      <path d="M22 52Q20 23 50 23Q80 23 78 52Q72 36 50 35Q30 35 22 52Z" />
    </g>,
  ][p.hairStyle];

  const eyes = [
    <g key="0" fill={INK}>
      <circle cx="40" cy="55" r="4.5" />
      <circle cx="60" cy="55" r="4.5" />
    </g>,
    <g key="1" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
      <path d="M35 56q5-6 10 0" />
      <path d="M55 56q5-6 10 0" />
    </g>,
    <g key="2">
      <circle cx="40" cy="54" r="7.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="60" cy="54" r="7.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="41" cy="55" r="3.5" fill={INK} />
      <circle cx="61" cy="55" r="3.5" fill={INK} />
    </g>,
    <g key="3" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
      <path d="M35 55h10" />
      <path d="M55 55h10" />
    </g>,
    <g key="4">
      <circle cx="40" cy="55" r="4.5" fill={INK} />
      <path d="M55 56q5-6 10 0" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </g>,
    <g key="5" fill="#fff" stroke={INK} strokeWidth="3">
      <circle cx="40" cy="54" r="6" />
      <circle cx="60" cy="54" r="6" />
      <circle cx="40" cy="54" r="1.8" fill={INK} />
      <circle cx="60" cy="54" r="1.8" fill={INK} />
    </g>,
  ][p.eyes];

  const mouth = [
    <path
      key="0"
      d="M42 67q8 7 16 0"
      fill="none"
      stroke={INK}
      strokeWidth="3.5"
      strokeLinecap="round"
    />,
    <path key="1" d="M40 65h20q-2 12-10 12t-10-12z" fill={INK} />,
    <ellipse key="2" cx="50" cy="70" rx="6" ry="7" fill={INK} />,
    <path key="3" d="M43 69h14" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />,
    <g key="4">
      <path d="M40 65h20q-2 10-10 10t-10-10z" fill={INK} />
      <path d="M45 70q5 12 10 0z" fill="#ff7aa8" stroke={INK} strokeWidth="2" />
    </g>,
    <circle key="5" cx="50" cy="69" r="4" fill="none" stroke={INK} strokeWidth="3" />,
  ][p.mouth];

  const acc = [
    null,
    <g key="1" fill="none" stroke={INK} strokeWidth="3">
      <circle cx="40" cy="55" r="9" fill="#ffffff55" />
      <circle cx="60" cy="55" r="9" fill="#ffffff55" />
      <path d="M49 55h2M31 54l-8-3M69 54l8-3" />
    </g>,
    <g key="2" {...s}>
      <path d="M23 42Q24 18 50 18Q76 18 77 42Z" fill="#5cc8ff" />
      <path d="M60 42h28q0 7-9 7H60Z" fill="#5cc8ff" />
    </g>,
    <path key="3" d="M30 33L33 13L42 23L50 9L58 23L67 13L70 33Z" fill="#ffc23d" {...s} />,
    <g key="4" {...s}>
      <path d="M21 54Q21 16 50 16Q79 16 79 54" fill="none" strokeWidth="5" />
      <rect x="14" y="46" width="12" height="20" rx="5" fill="#ff5fa2" />
      <rect x="74" y="46" width="12" height="20" rx="5" fill="#ff5fa2" />
    </g>,
    <g key="5" fill="#ff5fa2" {...s}>
      <path d="M66 26L56 19L57 33Z" />
      <path d="M66 26L76 19L75 33Z" />
      <circle cx="66" cy="26" r="3.5" />
    </g>,
    <g key="6" {...s}>
      <path d="M37 32L50 3L63 32Z" fill="#a98bff" />
      <path d="M42 22L58 26M46 13L55 16" stroke="#ffc23d" strokeWidth="3.5" />
      <circle cx="50" cy="4" r="4" fill="#ffc23d" />
    </g>,
    <g key="7" {...s}>
      <path d="M22 44Q22 15 50 15Q78 15 78 44Z" fill="#ff7a6b" />
      <rect x="20" y="38" width="60" height="9" rx="4" fill="#ff7a6b" />
      <circle cx="50" cy="12" r="6" fill="#fff" />
    </g>,
    <g key="8">
      <rect x="29" y="48" width="18" height="12" rx="5" fill={INK} />
      <rect x="53" y="48" width="18" height="12" rx="5" fill={INK} />
      <path d="M47 52h6M29 51l-7-2M71 51l7-2" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 51h5M56 51h5" stroke="#ffffff99" strokeWidth="2" strokeLinecap="round" />
    </g>,
    <g key="9" {...s}>
      <path d="M22 44Q24 27 50 27Q76 27 78 44L78 46L22 46Z" fill="#e8302e" />
      <path d="M76 42l12 4-10 6z" fill="#e8302e" />
      <circle cx="40" cy="36" r="2" fill="#fff" stroke="none" />
      <circle cx="58" cy="34" r="2" fill="#fff" stroke="none" />
    </g>,
    <g key="10" {...s}>
      <rect x="34" y="6" width="32" height="26" rx="3" fill="#1b1b24" />
      <rect x="34" y="24" width="32" height="5" fill="#e8302e" />
      <path d="M22 34h56v5H22z" fill="#1b1b24" />
    </g>,
    <ellipse
      key="11"
      cx="50"
      cy="16"
      rx="20"
      ry="5"
      fill="none"
      stroke="#ffd23f"
      strokeWidth="4.5"
    />,
    <g key="12" {...s}>
      <path d="M28 34L50 0L72 34Z" fill="#5b3fd6" />
      <path d="M22 34h56v5H22z" fill="#5b3fd6" />
      <path d="M48 14l2-5 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3z" fill="#ffd23f" strokeWidth="1.5" />
    </g>,
    <g key="13" {...s}>
      <path d="M28 33L32 11L41 22L50 6L59 22L68 11L72 33Z" fill="#9fe8ff" />
      <path d="M50 14l4 6-4 6-4-6z" fill="#fff" strokeWidth="2" />
      <circle cx="33" cy="12" r="2.5" fill="#ff5fa2" strokeWidth="1.5" />
      <circle cx="67" cy="12" r="2.5" fill="#ff5fa2" strokeWidth="1.5" />
    </g>,
  ][p.accessory];

  return (
    <>
      <rect x="0" y="0" width="100" height="100" rx="50" fill={PARTS.bg[p.bg]} />
      {behindHair}
      <circle cx="22" cy="58" r="6" fill={skin} {...s} />
      <circle cx="78" cy="58" r="6" fill={skin} {...s} />
      <circle cx="50" cy="56" r="28" fill={skin} {...s} />
      <ellipse cx="33" cy="64" rx="4.5" ry="3" fill="#ff7a6b" opacity="0.45" />
      <ellipse cx="67" cy="64" rx="4.5" ry="3" fill="#ff7a6b" opacity="0.45" />
      {frontHair}
      {eyes}
      {mouth}
      {acc}
    </>
  );
}

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
  const cos = parseAvatar(avatar);
  const parts = decodeAvatar(cos.base);
  const [shape = 'blob', n = '1'] = cos.base.split('-');
  const color = COLORS[(Number(n) - 1 + COLORS.length) % COLORS.length];
  const frame = cos.frame ? shopItem(cos.frame) : undefined;
  const gid = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label ?? 'avatar'}
      className={`shrink-0 transition ${dim ? 'opacity-40 grayscale' : ''}`}
    >
      {parts ? (
        <Character p={parts} />
      ) : (
        <>
          <path
            d={SHAPES[shape] ?? SHAPES.blob}
            fill={color}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <circle cx="40" cy="50" r="6" fill={INK} />
          <circle cx="60" cy="50" r="6" fill={INK} />
          <circle cx="42" cy="48" r="2" fill="#fff" />
          <circle cx="62" cy="48" r="2" fill="#fff" />
          <path
            d="M42 64q8 6 16 0"
            stroke={INK}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {frame?.colors && (
        <>
          <defs>
            <linearGradient id={`fr${gid}`} x1="0" y1="0" x2="1" y2="1">
              {frame.colors.map((c, i) => (
                <stop
                  key={i}
                  offset={`${(i / Math.max(1, frame.colors!.length - 1)) * 100}%`}
                  stopColor={c}
                />
              ))}
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke={INK} strokeWidth="9" />
          <circle cx="50" cy="50" r="46" fill="none" stroke={`url(#fr${gid})`} strokeWidth="6" />
          {cos.frame === 'f9' && (
            <text x="50" y="16" textAnchor="middle" fontSize="18">
              🏆
            </text>
          )}
        </>
      )}
    </svg>
  );
}

/** Apelido com a cor e o título comprados na loja. */
export function NameTag({
  nickname,
  avatar,
  className = '',
  showTitle = true,
}: {
  nickname: string;
  avatar: string;
  className?: string;
  showTitle?: boolean;
}) {
  const cos = parseAvatar(avatar);
  const nameItem = cos.name ? shopItem(cos.name) : undefined;
  const title = cos.title ? shopItem(cos.title)?.label : undefined;
  const colors = nameItem?.colors ?? [];
  const style =
    colors.length > 1
      ? {
          backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }
      : colors.length === 1
        ? { color: colors[0] }
        : undefined;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate" style={style}>
        {nickname}
      </span>
      {showTitle && title && (
        <span className="shrink-0 rounded-full bg-pop-violet/20 px-1.5 py-px text-[10px] font-extrabold uppercase tracking-wide text-pop-violet">
          {title}
        </span>
      )}
    </span>
  );
}

export const AVATAR_OPTIONS = Object.keys(SHAPES).flatMap((s) =>
  [1, 2, 3, 4, 5, 6].map((n) => `${s}-${n}`),
);
