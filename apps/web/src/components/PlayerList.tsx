import { EVENTS, type PublicRoom } from '@partyverse/shared';
import { emitAck } from '../lib/socket';
import { Avatar } from './Avatar';
import { useToast } from './Toast';

export function PlayerList({
  room,
  myId,
  showScores,
}: {
  room: PublicRoom;
  myId: string;
  showScores?: boolean;
}) {
  const toast = useToast();
  const amHost = room.hostId === myId;
  const act = (event: string, playerId: string, okMsg: string) =>
    emitAck(event, { playerId })
      .then(() => toast(okMsg, 'success'))
      .catch((e) => toast(e.message, 'error'));

  const players = showScores ? [...room.players].sort((a, b) => b.score - a.score) : room.players;

  return (
    <section className="card p-4" aria-label="Jogadores">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Jogadores</h2>
        <span className="text-sm text-ink-400">
          {room.players.length}/{room.settings.maxPlayers}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="group flex items-center gap-3 rounded-2xl bg-ink-900/60 px-3 py-2"
          >
            <div className="relative">
              <Avatar
                avatar={p.avatar}
                size={36}
                dim={p.status !== 'online'}
                label={`avatar de ${p.nickname}`}
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-800 ${p.status === 'online' ? 'bg-lime-400' : 'animate-pulse bg-pop-amber'}`}
                title={p.status === 'online' ? 'online' : 'reconectando'}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">
                {p.nickname}{' '}
                {p.id === myId && <span className="text-xs font-medium text-ink-400">(você)</span>}
              </p>
              <p className="text-xs text-ink-400">
                {p.isHost && <span className="text-pop-amber">★ anfitrião · </span>}
                {p.status === 'online' ? (p.isGuest ? 'convidado' : 'jogador') : 'reconectando…'}
              </p>
            </div>
            {showScores && (
              <span className="font-display text-lg font-extrabold text-lime-400">{p.score}</span>
            )}
            {amHost && p.id === myId && <div className="w-[3.75rem]" aria-hidden />}
            {amHost && p.id !== myId && (
              <div className="flex w-[3.75rem] justify-end gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <button
                  className="rounded-lg px-2 py-1 text-xs font-bold text-pop-amber hover:bg-ink-700 disabled:opacity-40"
                  disabled={p.status !== 'online'}
                  onClick={() =>
                    act(EVENTS.ROOM_TRANSFER_HOST, p.id, `${p.nickname} agora é o anfitrião`)
                  }
                  title="Passar liderança"
                >
                  ★
                </button>
                <button
                  className="rounded-lg px-2 py-1 text-xs font-bold text-pop-rose hover:bg-ink-700"
                  onClick={() =>
                    confirm(`Remover ${p.nickname} da sala?`) &&
                    act(EVENTS.ROOM_KICK, p.id, `${p.nickname} foi removido`)
                  }
                  title="Remover da sala"
                >
                  ✕
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
