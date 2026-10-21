import { levelInfo } from '@partyverse/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMyProfile } from '../lib/me';
import { isNativeApp } from '../lib/platform';
import { useSession } from '../lib/session';
import { Avatar, NameTag } from './Avatar';
import { Icon, type IconName } from './Icons';
import { AndroidAppLink, InstallButton } from './InstallButton';
import { InviteCenter } from './InviteCenter';
import { Logo } from './Logo';
import { SoundToggle } from './SoundToggle';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const BASE_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/jogos', label: 'Jogos', icon: 'games' },
  { to: '/desafio', label: 'Desafio do dia', icon: 'daily' },
  { to: '/salas', label: 'Salas', icon: 'rooms' },
  { to: '/ranking', label: 'Ranking', icon: 'ranking' },
  { to: '/clas', label: 'Clãs', icon: 'clans' },
  { to: '/loja', label: 'Loja', icon: 'shop' },
  { to: '/amigos', label: 'Amigos', icon: 'friends' },
  { to: '/ajuda', label: 'Ajuda', icon: 'help' },
];

/** Abas da barra inferior no celular (o resto fica em "Mais"). */
const TABS: NavItem[] = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/jogos', label: 'Jogos', icon: 'games' },
  { to: '/desafio', label: 'Desafio', icon: 'daily' },
  { to: '/ranking', label: 'Ranking', icon: 'ranking' },
];

export function Layout() {
  const { user, logout, admin } = useSession();
  const [more, setMore] = useState(false);
  const { pathname, hash } = useLocation();
  const NAV: NavItem[] = admin
    ? [...BASE_NAV, { to: '/admin', label: 'Admin', icon: 'admin' }]
    : BASE_NAV;
  const app = isNativeApp();

  useEffect(() => {
    document.documentElement.classList.toggle('in-app', app);
  }, [app]);

  // fecha o menu ao navegar; rola para o topo (ou para a âncora, ex.: /#criar)
  useEffect(() => {
    setMore(false);
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  const inRoom = pathname.startsWith('/sala/');

  return (
    <div className="bg-confetti flex min-h-dvh flex-col lg:pl-64">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-lime-400 focus:px-3 focus:py-2 focus:text-night"
      >
        Pular para o conteúdo
      </a>
      <Sidebar nav={NAV} />
      <TopBar onLogout={logout} />
      <InviteCenter />
      <main id="main" className={`flex-1 ${inRoom ? 'pb-8' : 'pb-28'} lg:pb-10`}>
        <Outlet />
      </main>
      {!app && (
        <footer className="hidden border-t border-ink-800 py-6 text-sm text-ink-400 lg:block">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
            <span>PartyVerse · feito para jogar junto</span>
            <nav className="flex flex-wrap gap-4" aria-label="Rodapé">
              {[...NAV, { to: '/perfil', label: 'Perfil' }].map((n) => (
                <Link key={n.to} to={n.to} className="hover:text-white">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      )}
      {!inRoom && <TabBar onMore={() => setMore(true)} moreOpen={more} />}
      {more && (
        <MoreSheet
          nav={NAV.filter((n) => !TABS.some((t) => t.to === n.to))}
          onClose={() => setMore(false)}
          onLogout={user ? logout : undefined}
        />
      )}
    </div>
  );
}

// ---------- menu lateral (computador) ----------

function Sidebar({ nav }: { nav: NavItem[] }) {
  const { user } = useSession();
  const me = useMyProfile();
  const xp = me?.progress?.xp;
  const lvl = xp !== undefined ? levelInfo(xp) : null;
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-800 bg-ink-950/80 px-4 py-5 backdrop-blur lg:flex"
      aria-label="Menu"
    >
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Principal">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600/35 to-violet-600/5 text-white shadow-[inset_0_0_0_1px_rgba(165,133,255,.35)]'
                  : 'text-ink-400 hover:bg-ink-800/70 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute -left-4 top-2 h-[calc(100%-1rem)] w-1 rounded-r-full bg-lime-400"
                    aria-hidden
                  />
                )}
                <Icon
                  name={n.icon}
                  className={isActive ? 'text-lime-300' : 'text-ink-400 group-hover:text-white'}
                />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 rounded-2xl border border-ink-700 bg-ink-800/70 p-3">
        {user && !user.isGuest ? (
          <Link to="/perfil" className="block">
            <div className="flex items-center gap-2.5">
              <Avatar avatar={user.avatar} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  <NameTag nickname={user.nickname} avatar={user.avatar} showTitle={false} />
                </p>
                <p className="text-xs text-ink-400">{lvl ? `Nível ${lvl.level}` : 'Carregando…'}</p>
              </div>
            </div>
            {lvl && (
              <>
                <div className="mt-3 flex justify-between text-[11px] text-ink-400">
                  <span>XP {xp!.toLocaleString('pt-BR')}</span>
                  <span>
                    {xp! - lvl.base}/{lvl.next - lvl.base}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-lime-400"
                    style={{ width: `${Math.round(lvl.progress * 100)}%` }}
                  />
                </div>
              </>
            )}
          </Link>
        ) : (
          <div>
            <p className="text-sm font-bold text-white">Ganhe XP e conquistas</p>
            <p className="mt-1 text-xs text-ink-400">Crie uma conta grátis para subir de nível.</p>
            <Link
              to="/entrar?modo=cadastro"
              className="btn-violet mt-3 block rounded-lg px-3 py-2 text-center text-sm font-bold"
            >
              Criar conta
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

// ---------- barra de cima ----------

function TopBar({ onLogout }: { onLogout: () => void }) {
  const { user } = useSession();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      nav(`/sala/${code}`);
      setCode('');
    }
  };
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-900/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:px-6">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="hidden min-w-0 lg:block">
          <p className="eyebrow !text-[10px]">{user ? 'Bem-vindo de volta,' : 'Bem-vindo ao'}</p>
          <p className="flex items-center gap-2 truncate font-display text-lg font-bold text-white">
            {user ? user.nickname : 'PartyVerse'}
            {user && (
              <span className="chip bg-violet-600/25 text-[10px] uppercase tracking-wider text-lime-300">
                {user.isGuest ? 'convidado' : 'jogador'}
              </span>
            )}
          </p>
        </div>
        <form
          onSubmit={go}
          className="mx-auto hidden w-full max-w-sm items-center gap-2 rounded-xl border border-ink-700 bg-ink-950/60 px-3 focus-within:border-lime-400 md:flex"
          role="search"
        >
          <Icon name="search" size={18} className="text-ink-400" />
          <label htmlFor="top-code" className="sr-only">
            Código da sala
          </label>
          <input
            id="top-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={6}
            placeholder="Entrar com o código da sala…"
            autoComplete="off"
            className="w-full bg-transparent py-2 text-sm text-white placeholder:text-ink-400 focus:outline-none"
          />
          {code.length === 6 && (
            <button className="rounded-lg bg-lime-400 px-2.5 py-1 text-xs font-bold text-night">
              Entrar
            </button>
          )}
        </form>
        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
          <InstallButton />
          <ThemeToggle />
          <SoundToggle />
          {user ? (
            <>
              <Link
                to="/perfil"
                className="flex items-center gap-2 rounded-xl p-1 hover:bg-ink-800"
                title="Seu perfil"
              >
                <span className="rounded-full p-0.5 ring-2 ring-lime-400/70">
                  <Avatar avatar={user.avatar} size={30} />
                </span>
              </Link>
              <button
                onClick={onLogout}
                className="hidden rounded-xl p-2 text-ink-400 hover:bg-ink-800 hover:text-white lg:block"
                title="Sair"
                aria-label="Sair da conta"
              >
                <Icon name="logout" size={19} />
              </button>
            </>
          ) : (
            <Link to="/entrar" className="btn-violet rounded-xl px-4 py-2 text-sm font-bold">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------- barra de abas (celular) ----------

function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { pathname } = useLocation();
  const onTab = TABS.some((t) => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Abas"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-2xl border border-ink-700 bg-ink-950/90 p-1.5 shadow-[0_-8px_30px_-12px_rgba(0,0,0,.8)] backdrop-blur-xl">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
                isActive ? 'btn-violet' : 'text-ink-400 hover:text-white'
              }`
            }
          >
            <Icon name={t.icon} size={21} />
            {t.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
            !onTab && pathname !== '/' && !pathname.startsWith('/sala/')
              ? 'text-lime-300'
              : 'text-ink-400 hover:text-white'
          }`}
        >
          <Icon name="more" size={21} />
          Mais
        </button>
      </div>
    </nav>
  );
}

function MoreSheet({
  nav,
  onClose,
  onLogout,
}: {
  nav: NavItem[];
  onClose: () => void;
  onLogout?: () => void;
}) {
  const { user } = useSession();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mais opções"
        className="absolute inset-x-0 bottom-0 animate-rise rounded-t-3xl border-t border-ink-700 bg-ink-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-600" aria-hidden />
        <div className="grid grid-cols-3 gap-2">
          {[...nav, { to: '/perfil', label: 'Perfil', icon: 'profile' as IconName }].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-bold ${
                  isActive
                    ? 'border-lime-400/60 bg-violet-600/20 text-white'
                    : 'border-ink-700 bg-ink-800/70 text-ink-200'
                }`
              }
            >
              <Icon name={n.icon} size={22} className="text-lime-300" />
              {n.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          <InstallButton block />
          <AndroidAppLink />
          {onLogout && user && (
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-800/70 px-4 py-3 text-sm font-bold text-ink-400"
            >
              <Icon name="logout" size={18} /> Sair da conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
