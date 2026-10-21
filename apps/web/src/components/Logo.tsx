import { useId } from 'react';
import { Link } from 'react-router-dom';

/** Emblema do PartyVerse: escudo hexagonal violeta com um rostinho de controle. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const gid = `pv-mark${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b1ff" />
          <stop offset=".55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <path
        d="M32 3l25 14v30L32 61 7 47V17z"
        fill={`url(#${gid})`}
        stroke="#e9e1ff"
        strokeOpacity=".55"
        strokeWidth="2"
      />
      <path d="M32 11l18 10v22L32 53 14 43V21z" fill="#0c0a16" opacity=".88" />
      <circle cx="25" cy="30" r="3.6" fill="#c4b1ff" />
      <circle cx="39" cy="30" r="3.6" fill="#c4b1ff" />
      <path
        d="M24 38q8 7 16 0"
        stroke="#c4b1ff"
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="51" cy="8" r="4" fill="#ff5fa2" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="PartyVerse — início">
      <span className="transition group-hover:scale-105">
        <LogoMark />
      </span>
      {!compact && (
        <span className="font-display text-xl font-bold uppercase tracking-wide text-white">
          Party<span className="text-lime-400">Verse</span>
        </span>
      )}
    </Link>
  );
}
