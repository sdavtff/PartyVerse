import { GAME_CATALOG, type GameId } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { usePageTitle } from '../lib/usePageTitle';

interface Row {
  userId: string;
  nickname: string;
  avatar: string;
  matches: number;
  wins: number;
  score: number;
}

const MEDAL = ['bg-pop-amber', 'bg-ink-200', 'bg-pop-rose'];

export function RankingPage() {
  usePageTitle('Ranking');
  const { user } = useSession();
  const [game, setGame] = useState<GameId | 'all'>('all');
  const [data, setData] = useState<{ enabled: boolean; rows: Row[] } | null>(null);

  useEffect(() => {
    setData(null);
    api<{ enabled: boolean; rows: Row[] }>(`/leaderboard${game === 'all' ? '' : `?game=${game}`}`)
      .then(setData)
      .catch(() => setData({ enabled: false, rows: [] }));
  }, [game]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Ranking</h1>
      <p className="mt-2 text-ink-200">
        Quem mais venceu partidas. Só contas registradas entram —{' '}
        {user && !user.isGuest ? (
          'jogue para subir!'
        ) : (
          <Link to="/entrar" className="font-bold text-lime-400 hover:underline">
            crie sua conta
          </Link>
        )}
      </p>
      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por jogo">
        {[{ id: 'all' as const, name: 'Geral' }, ...GAME_CATALOG].map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={game === g.id}
            onClick={() => setGame(g.id)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition ${game === g.id ? 'border-lime-400 bg-lime-400 text-ink-950' : 'border-ink-600 text-ink-200 hover:border-ink-400'}`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {data === null ? (
        <p className="card mt-6 p-6 text-ink-400" role="status">
          Carregando…
        </p>
      ) : !data.enabled ? (
        <p className="card mt-6 p-6 text-ink-400">
          O ranking aparece quando o banco de dados está configurado no servidor.
        </p>
      ) : data.rows.length === 0 ? (
        <p className="card mt-6 p-6 text-ink-400">
          Nenhuma partida registrada ainda. Seja o primeiro!
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {data.rows.map((r, i) => (
            <li
              key={r.userId}
              className={`card flex animate-rise items-center gap-3 px-4 py-3 ${r.userId === user?.id ? 'border-lime-400' : ''}`}
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-extrabold ${MEDAL[i] ? `${MEDAL[i]} text-ink-950` : 'bg-ink-700 text-white'}`}
              >
                {i + 1}
              </span>
              <Avatar avatar={r.avatar} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-white">
                  {r.nickname}
                  {r.userId === user?.id && ' (você)'}
                </span>
                <span className="text-xs text-ink-400">
                  {r.matches} {r.matches === 1 ? 'partida' : 'partidas'} · {r.score} pts
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display text-2xl font-extrabold text-lime-400">
                  {r.wins}
                </span>
                <span className="text-xs text-ink-400">
                  {r.wins === 1 ? 'vitória' : 'vitórias'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
