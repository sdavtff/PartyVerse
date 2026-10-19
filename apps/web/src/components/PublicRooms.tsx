import { GAME_CATALOG, type GameId } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from './Button';
import { GameIcon } from './GameIcon';

export interface RoomSummary {
  code: string;
  name: string;
  gameId: GameId;
  players: number;
  maxPlayers: number;
  phase: string;
  hasPassword?: boolean;
}

/** Lista de salas públicas, atualizada a cada poucos segundos. */
export function usePublicRooms(intervalMs = 8000) {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  useEffect(() => {
    const load = () =>
      api<RoomSummary[]>('/rooms')
        .then(setRooms)
        .catch(() => setRooms((r) => r ?? []));
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return rooms;
}

export function RoomList({ rooms, empty }: { rooms: RoomSummary[] | null; empty: string }) {
  const nav = useNavigate();
  if (rooms === null)
    return (
      <p className="card mt-5 p-6 text-ink-400" role="status">
        Carregando salas…
      </p>
    );
  if (rooms.length === 0) return <p className="card mt-5 p-6 text-ink-400">{empty}</p>;
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {rooms.map((r) => (
        <li key={r.code} className="card flex items-center gap-4 p-4">
          <GameIcon id={r.gameId} small />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">
              {r.hasPassword && <span aria-label="com senha">🔒 </span>}
              {r.name}
            </p>
            <p className="text-xs text-ink-400">
              {GAME_CATALOG.find((g) => g.id === r.gameId)?.name} · {r.players}/{r.maxPlayers} ·{' '}
              {r.phase === 'playing' ? 'em partida' : 'no lobby'}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-900" aria-hidden>
              <div
                className="h-full rounded-full bg-lime-400"
                style={{ width: `${Math.min(100, (r.players / r.maxPlayers) * 100)}%` }}
              />
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => nav(`/sala/${r.code}`)}>
            Entrar
          </Button>
        </li>
      ))}
    </ul>
  );
}
