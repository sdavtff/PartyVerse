import { GAME_CATALOG, type GameId } from '@partyverse/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RoomList, usePublicRooms } from '../components/PublicRooms';
import { usePageTitle } from '../lib/usePageTitle';

export function RoomsPage() {
  usePageTitle('Salas públicas');
  const rooms = usePublicRooms(5000);
  const [filter, setFilter] = useState<GameId | 'all'>('all');
  const [onlyLobby, setOnlyLobby] = useState(false);
  const shown =
    rooms?.filter(
      (r) => (filter === 'all' || r.gameId === filter) && (!onlyLobby || r.phase !== 'playing'),
    ) ?? null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Salas públicas</h1>
          <p className="mt-2 text-ink-200">
            Entre numa partida aberta e jogue com quem estiver online. A lista se atualiza sozinha.
          </p>
        </div>
        <Link
          to="/#criar"
          className="rounded-2xl bg-lime-400 px-5 py-3 font-bold text-night shadow-chunky hover:bg-lime-300"
        >
          Criar minha sala
        </Link>
      </div>
      <div
        className="mt-6 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar por jogo"
      >
        {[{ id: 'all' as const, name: 'Todos' }, ...GAME_CATALOG].map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={filter === g.id}
            onClick={() => setFilter(g.id)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition ${filter === g.id ? 'border-lime-400 bg-lime-400 text-night' : 'border-ink-600 text-ink-200 hover:border-ink-400'}`}
          >
            {g.name}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-lime-400"
            checked={onlyLobby}
            onChange={(e) => setOnlyLobby(e.target.checked)}
          />
          Só salas esperando jogadores
        </label>
      </div>
      <RoomList
        rooms={shown}
        empty="Nenhuma sala pública com esse filtro agora. Que tal criar uma?"
      />
    </div>
  );
}
