import { Link, NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

export function Layout() {
  const { user, logout } = useSession();
  return (
    <div className="bg-confetti flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-lime-400 focus:px-3 focus:py-2 focus:text-ink-950"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b-2 border-ink-800 bg-ink-900/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hidden rounded-xl px-3 py-2 text-sm font-bold sm:block ${isActive ? 'text-lime-400' : 'hover:text-white'}`
              }
            >
              Jogos
            </NavLink>
            {user ? (
              <>
                <Link
                  to="/perfil"
                  className="flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-ink-800"
                  title="Seu perfil"
                >
                  <Avatar avatar={user.avatar} size={30} />
                  <span className="max-w-[9rem] truncate text-sm font-bold text-white">
                    {user.nickname}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="rounded-xl px-3 py-2 text-sm font-bold text-ink-400 hover:text-white"
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
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t-2 border-ink-800 py-6 text-center text-sm text-ink-400">
        PartyVerse · feito para jogar junto
      </footer>
    </div>
  );
}
