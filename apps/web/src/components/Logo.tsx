import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2" aria-label="PartyVerse — início">
      <svg
        width="34"
        height="34"
        viewBox="0 0 64 64"
        aria-hidden
        className="transition group-hover:rotate-[-8deg]"
      >
        <circle cx="32" cy="34" r="22" fill="#c6f432" stroke="#0f0b17" strokeWidth="4" />
        <circle cx="25" cy="31" r="4" fill="#0f0b17" />
        <circle cx="39" cy="31" r="4" fill="#0f0b17" />
        <path
          d="M24 41q8 6 16 0"
          stroke="#0f0b17"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="52" cy="10" r="6" fill="#ff5fa2" />
        <circle cx="8" cy="16" r="4" fill="#5cc8ff" />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-tight text-white">
        Party<span className="text-lime-400">Verse</span>
      </span>
    </Link>
  );
}
