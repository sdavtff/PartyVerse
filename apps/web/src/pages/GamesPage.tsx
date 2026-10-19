import { GAME_CATALOG } from '@partyverse/shared';
import { Link } from 'react-router-dom';
import { GameIcon, gameAccent } from '../components/GameIcon';
import { guideById } from '../lib/gameGuides';
import { usePageTitle } from '../lib/usePageTitle';

export function GamesPage() {
  usePageTitle('Jogos');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Jogos</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-200">
        Seis jogos para jogar com a galera no navegador, do celular ou do computador. Escolha um,
        veja como funciona e crie sua sala.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAME_CATALOG.map((g, i) => {
          const guide = guideById(g.id);
          return (
            <li key={g.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <Link
                to={`/jogos/${guide?.slug ?? g.id}`}
                className="card group relative flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-1"
              >
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20 transition group-hover:scale-125"
                  style={{ background: gameAccent(g.id) }}
                  aria-hidden
                />
                <GameIcon id={g.id} />
                <h2 className="mt-3 text-xl font-extrabold">{g.name}</h2>
                <p className="mt-1 flex-1 text-sm text-ink-200">{guide?.intro ?? g.tagline}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-ink-400">{guide?.bestWith}</span>
                  <span className="chip bg-lime-400 text-ink-950">Ver como jogar ▸</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
