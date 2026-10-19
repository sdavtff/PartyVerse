import { GAME_CATALOG } from '@partyverse/shared';
import { Link, useParams } from 'react-router-dom';
import { GameIcon, gameAccent } from '../components/GameIcon';
import { RoomList, usePublicRooms } from '../components/PublicRooms';
import { guideBySlug } from '../lib/gameGuides';
import { usePageTitle } from '../lib/usePageTitle';
import { Notice } from './RoomPage';

export function GameDetailPage() {
  const { slug = '' } = useParams();
  const guide = guideBySlug(slug);
  const meta = guide && GAME_CATALOG.find((g) => g.id === guide.id);
  usePageTitle(meta?.name ?? 'Jogo');
  const rooms = usePublicRooms();
  if (!guide || !meta)
    return <Notice title="Jogo não encontrado" text="Confira a lista completa de jogos." />;
  const accent = gameAccent(guide.id);
  const open = rooms?.filter((r) => r.gameId === guide.id) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/jogos" className="text-sm font-bold text-ink-400 hover:text-white">
        ‹ Todos os jogos
      </Link>
      <header
        className="card relative mt-3 overflow-hidden p-6 sm:p-8"
        style={{ boxShadow: `inset 0 -6px 0 0 ${accent}` }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-10"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <GameIcon id={guide.id} />
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-extrabold">{meta.name}</h1>
            <p className="text-ink-400">
              {meta.minPlayers}–{meta.maxPlayers} jogadores · melhor com {guide.bestWith}
            </p>
          </div>
          <Link
            to={`/?jogo=${guide.slug}#criar`}
            className="rounded-2xl bg-lime-400 px-6 py-3.5 text-lg font-bold text-night shadow-chunky transition hover:bg-lime-300 active:translate-y-0.5 active:shadow-none"
          >
            Criar sala de {meta.name}
          </Link>
        </div>
        <p className="relative mt-5 max-w-3xl text-lg text-ink-200">{guide.intro}</p>
      </header>

      <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <section className="card p-6" aria-labelledby="how">
          <h2 id="how" className="text-2xl font-extrabold">
            Como jogar
          </h2>
          <ol className="mt-4 space-y-3">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display font-extrabold text-night"
                  style={{ background: accent }}
                >
                  {i + 1}
                </span>
                <span className="pt-1 text-ink-200">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        <div className="space-y-5">
          <section className="card p-6" aria-labelledby="score">
            <h2 id="score" className="text-xl font-extrabold">
              Pontuação
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-200">
              {guide.scoring.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="card p-6" aria-labelledby="tips">
            <h2 id="tips" className="text-xl font-extrabold">
              Dicas
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-200">
              {guide.tips.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="open-rooms">
        <h2 id="open-rooms" className="text-2xl font-extrabold">
          Salas de {meta.name} abertas
        </h2>
        <RoomList
          rooms={open}
          empty={`Nenhuma sala pública de ${meta.name} agora. Crie a primeira!`}
        />
      </section>
    </div>
  );
}
