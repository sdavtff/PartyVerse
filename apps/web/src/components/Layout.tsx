import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Avatar } from './Avatar';
import { InviteCenter } from './InviteCenter';
import { Logo } from './Logo';
import { SoundToggle } from './SoundToggle';

const BASE_NAV = [
  { to: '/jogos', label: 'Jogos' },
  { to: '/salas', label: 'Salas' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/amigos', label: 'Amigos' },
  { to: '/ajuda', label: 'Ajuda' },
];

export function Layout() {
  const { user, logout } = useSession();
  const [menu, setMenu] = useState(false);
  const { pathname, hash } = useLocation();
  const NAV = BASE_NAV;

  // fecha o menu ao navegar; rola para o topo (ou para a âncora, ex.: /#criar)
  useEffect(() => {
    setMenu(false);
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-3 py-2 text-sm font-bold transition ${isActive ? 'bg-ink-800 text-lime-400' : 'text-ink-200 hover:text-white'}`;

  return (
    <div className="bg-confetti flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-lime-400 focus:px-3 focus:py-2 focus:text-ink-950"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b-2 border-ink-800 bg-ink-900/85 backdrop-blur">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3"
          aria-label="Principal"
        >
          <div className="flex items-center gap-4">
            <Logo />
            <div className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={linkClass}>
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <SoundToggle />
            {user ? (
              <>
                <Link
                  to="/perfil"
                  className="flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-ink-800"
                  title="Seu perfil"
                >
                  <Avatar avatar={user.avatar} size={30} />
                  <span className="hidden max-w-[9rem] truncate text-sm font-bold text-white sm:inline">
                    {user.nickname}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="hidden rounded-xl px-3 py-2 text-sm font-bold text-ink-400 hover:text-white sm:block"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link
                to="/entrar"
                className="rounded-xl bg-ink-700 px-4 py-2 text-sm font-bold text-white hover:bg-ink-600"
              >
                Entrar
              </Link>
            )}
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-white hover:bg-ink-800 md:hidden"
              aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menu}
              aria-controls="mobile-menu"
              onClick={() => setMenu((m) => !m)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </nav>
        {menu && (
          <div
            id="mobile-menu"
            className="animate-rise border-t-2 border-ink-800 px-4 pb-4 pt-2 md:hidden"
          >
            <div className="grid grid-cols-2 gap-2">
              {[{ to: '/', label: 'Início' }, ...NAV].map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `rounded-2xl px-4 py-3 text-center font-bold ${isActive ? 'bg-lime-400 text-ink-950' : 'bg-ink-800 text-white'}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              {user && (
                <button
                  onClick={logout}
                  className="rounded-2xl bg-ink-800 px-4 py-3 font-bold text-ink-400"
                >
                  Sair da conta
                </button>
              )}
            </div>
          </div>
        )}
      </header>
      <InviteCenter />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t-2 border-ink-800 py-8 text-sm text-ink-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
          <span>PartyVerse · feito para jogar junto</span>
          <nav className="flex flex-wrap gap-4" aria-label="Rodapé">
            {[{ to: '/', label: 'Início' }, ...NAV, { to: '/perfil', label: 'Perfil' }].map((n) => (
              <Link key={n.to} to={n.to} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
