import { GAME_CATALOG, type GameId } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, NameTag } from '../components/Avatar';
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

interface Tournament {
  week: string;
  endsAt: string;
  prizes: { place: number; coins: number; items: string[] }[];
  rows: Row[];
  lastWinners: { place: number; userId: string; nickname: string; avatar: string; coins: number }[];
}

function left(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return 'acabando…';
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3600_000) / 60000)}min`;
}

function TournamentInfo({ t }: { t: Tournament }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="card p-4">
        <p className="text-sm text-ink-400">Termina em {left(t.endsAt)} (domingo, meia-noite)</p>
        <ul className="mt-2 space-y-1 text-sm">
          {t.prizes.map((p) => (
            <li key={p.place} className="flex justify-between">
              <span>
                {['🥇', '🥈', '🥉'][p.place - 1]} {p.place}º lugar
              </span>
              <b className="text-pop-amber">
                {p.coins} 🪙{p.items.length ? ' + moldura e título exclusivos' : ''}
              </b>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-400">
          Conta quem mais vence partidas de segunda a domingo.
        </p>
      </div>
      <div className="card p-4">
        <p className="font-bold text-white">Campeões da semana passada</p>
        {t.lastWinners.length === 0 ? (
          <p className="mt-2 text-sm text-ink-400">Ainda não teve. Que tal ser o primeiro?</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {t.lastWinners.map((w) => (
              <li key={w.place} className="flex items-center gap-2 text-sm">
                <span>{['🥇', '🥈', '🥉'][w.place - 1]}</span>
                <Avatar avatar={w.avatar} size={26} />
                <Link to={`/jogador/${w.userId}`} className="truncate font-bold hover:underline">
                  <NameTag nickname={w.nickname} avatar={w.avatar} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function RankingPage() {
  usePageTitle('Ranking');
  const { user } = useSession();
  const [game, setGame] = useState<GameId | 'all'>('all');
  const [period, setPeriod] = useState<'semana' | 'temporada' | 'geral'>('semana');
  const [tour, setTour] = useState<Tournament | null>(null);
  const [data, setData] = useState<{
    enabled: boolean;
    season?: string | null;
    rows: Row[];
  } | null>(null);

  useEffect(() => {
    setData(null);
    if (period === 'semana') {
      api<Tournament | null>('/tournament')
        .then((t) => {
          setTour(t);
          setData({ enabled: Boolean(t), rows: t?.rows ?? [] });
        })
        .catch(() => setData({ enabled: false, rows: [] }));
      return;
    }
    const q = new URLSearchParams();
    if (game !== 'all') q.set('game', game);
    if (period === 'temporada') q.set('periodo', 'temporada');
    api<{ enabled: boolean; season?: string | null; rows: Row[] }>(`/leaderboard?${q}`)
      .then(setData)
      .catch(() => setData({ enabled: false, rows: [] }));
  }, [game, period]);

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
      <div className="mt-6 inline-grid grid-cols-3 gap-1 rounded-2xl bg-ink-950 p-1" role="tablist">
        {(
          [
            ['semana', '🏆 Torneio da semana'],
            ['temporada', 'Temporada do mês'],
            ['geral', 'Todos os tempos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={period === id}
            onClick={() => setPeriod(id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${period === id ? 'bg-lime-400 text-night' : 'text-ink-200 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {period === 'temporada' && data?.season && (
        <p className="mt-2 text-sm text-ink-400">
          {data.season} · o ranking da temporada recomeça todo dia 1º.
        </p>
      )}
      {period === 'semana' && tour && <TournamentInfo t={tour} />}
      {period !== 'semana' && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por jogo">
          {[{ id: 'all' as const, name: 'Geral' }, ...GAME_CATALOG].map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={game === g.id}
              onClick={() => setGame(g.id)}
              className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition ${game === g.id ? 'border-lime-400 bg-lime-400 text-night' : 'border-ink-600 text-ink-200 hover:border-ink-400'}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

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
          {period !== 'geral'
            ? 'Ninguém pontuou ainda neste período. Seja o primeiro!'
            : 'Nenhuma partida registrada ainda. Seja o primeiro!'}
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
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-extrabold ${MEDAL[i] ? `${MEDAL[i]} text-night` : 'bg-ink-700 text-white'}`}
              >
                {i + 1}
              </span>
              <Avatar avatar={r.avatar} size={40} />
              <span className="min-w-0 flex-1">
                <Link
                  to={`/jogador/${r.userId}`}
                  className="block truncate font-bold text-white hover:underline"
                >
                  <NameTag nickname={r.nickname} avatar={r.avatar} />
                  {r.userId === user?.id && ' (você)'}
                </Link>
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
