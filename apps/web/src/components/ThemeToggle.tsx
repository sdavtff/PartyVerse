import { usePrefs } from '../lib/prefs';

/** Alterna entre tema escuro e claro. */
export function ThemeToggle() {
  const { prefs, setPref } = usePrefs();
  const light = prefs.theme === 'light';
  return (
    <button
      type="button"
      onClick={() => void setPref('theme', light ? 'dark' : 'light')}
      className="grid h-9 w-9 place-items-center rounded-xl text-ink-200 hover:bg-ink-800 hover:text-white"
      aria-label={light ? 'Usar tema escuro' : 'Usar tema claro'}
      title={light ? 'Tema escuro' : 'Tema claro'}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden
      >
        {light ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
