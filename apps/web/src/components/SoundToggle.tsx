import { usePrefs } from '../lib/prefs';
import { sfx } from '../lib/sound';

/** Botão rápido de som no cabeçalho. */
export function SoundToggle() {
  const { prefs, setPref } = usePrefs();
  const on = prefs.sound;
  return (
    <button
      type="button"
      onClick={() => {
        void setPref('sound', !on);
        if (!on) setTimeout(() => sfx('click'), 0);
      }}
      className="grid h-9 w-9 place-items-center rounded-xl text-ink-200 hover:bg-ink-800 hover:text-white"
      aria-pressed={on}
      aria-label={on ? 'Desligar sons' : 'Ligar sons'}
      title={on ? 'Desligar sons' : 'Ligar sons'}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m16 9 5 6m0-6-5 6" />
        )}
      </svg>
    </button>
  );
}
