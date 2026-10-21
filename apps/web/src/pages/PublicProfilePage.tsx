import { GAME_CATALOG } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { AchievementsGrid, LevelBar, type ProgressData } from '../components/Progress';
import { FriendButton } from '../components/FriendButton';
import { ReportDialog } from '../components/ReportDialog';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { usePageTitle } from '../lib/usePageTitle';
import { Notice } from './RoomPage';

interface PublicProfile {
  user: { id: string; nickname: string; avatar: string };
  createdAt?: string;
  stats: { matchesPlayed: number; wins: number; totalScore: number; bestScore: number };
  progress: ProgressData | null;
  history: { gameId: string; endedAt: string; score: number; place: number; players: number }[];
}

export function PublicProfilePage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  usePageTitle(p?.user.nickname ?? 'Jogador');

  useEffect(() => {
    setP(null);
    setError('');
    api<PublicProfile>(`/users/${id}`)
      .then(setP)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <Notice title="Jogador não encontrado" text={error} />;
  if (!p)
    return (
      <p className="p-16 text-center text-ink-400" role="status">
        Carregando perfil…
      </p>
    );
  const me = user?.id === p.user.id;
  const winRate = p.stats.matchesPlayed
    ? Math.round((p.stats.wins / p.stats.matchesPlayed) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="animate-pop rounded-full shadow-chunky">
            <Avatar avatar={p.user.avatar} size={104} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-4xl font-extrabold">{p.user.nickname}</h1>
            {p.createdAt && (
              <p className="text-sm text-ink-400">
                Jogando desde{' '}
                {new Date(p.createdAt).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            {p.progress && (
              <div className="mt-3 max-w-sm">
                <LevelBar xp={p.progress.xp} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {me ? (
              <Link
                to="/perfil"
                className="rounded-2xl bg-ink-700 px-4 py-2.5 font-bold text-white hover:bg-ink-600"
              >
                Editar perfil
              </Link>
            ) : (
              <>
                <FriendButton userId={p.user.id} />
                {user && (
                  <button
                    onClick={() => setReporting(true)}
                    className="rounded-xl px-3 py-2 text-sm font-bold text-ink-400 hover:bg-ink-800 hover:text-pop-rose"
                  >
                    ⚑ Denunciar
                  </button>
                )}
                {reporting && <ReportDialog target={p.user} onClose={() => setReporting(false)} />}
              </>
            )}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Partidas', p.stats.matchesPlayed],
            ['Vitórias', p.stats.wins],
            ['Aproveitamento', `${winRate}%`],
            ['Recorde', p.stats.bestScore],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-ink-900 p-3 text-center">
              <dt className="text-xs text-ink-400">{k}</dt>
              <dd className="font-display text-2xl font-extrabold text-lime-400">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {p.progress && (
        <section className="card p-6" aria-labelledby="ach">
          <h2 id="ach" className="text-xl font-extrabold">
            Conquistas ({p.progress.achievements.length})
          </h2>
          <div className="mt-4">
            <AchievementsGrid unlocked={p.progress.achievements} />
          </div>
        </section>
      )}

      <section className="card p-6" aria-labelledby="recent">
        <h2 id="recent" className="text-xl font-extrabold">
          Últimas partidas
        </h2>
        {p.history.length === 0 ? (
          <p className="mt-3 text-ink-400">Nenhuma partida ainda.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {p.history.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-2.5 text-sm"
              >
                <span className="font-bold text-white">
                  {GAME_CATALOG.find((g) => g.id === h.gameId)?.name ?? h.gameId}
                </span>
                <span className="text-ink-400">
                  {new Date(h.endedAt).toLocaleDateString('pt-BR')}
                </span>
                <span>
                  {h.place === 1 ? '🏆 ' : ''}
                  {h.place}º de {h.players}
                </span>
                <span className="font-display font-extrabold text-lime-400">{h.score} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
