import { EVENTS, type PublicRoom } from '@partyverse/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { emitAck } from '../lib/socket';
import { AnimatedNumber } from './AnimatedNumber';
import { Avatar } from './Avatar';
import { useToast } from './Toast';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Lista de jogadores. Durante a partida vira um placar ao vivo:
 * posições trocam com animação, "+pontos" sobe ao lado de quem pontuou e o líder ganha coroa.
 */
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

  const players = showScores
    ? [...room.players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
    : room.players;
  const top = players[0]?.score ?? 0;
  const leaderId = showScores && top > 0 && players[1]?.score !== top ? players[0]?.id : null;

  // "+pontos" de quem acabou de pontuar
  const prevScores = useRef<Record<string, number>>({});
  const [gains, setGains] = useState<Record<string, { n: number; key: number }>>({});
  useEffect(() => {
    if (!showScores) {
      prevScores.current = {};
      return;
    }
    const next: Record<string, { n: number; key: number }> = {};
    for (const p of room.players) {
      const before = prevScores.current[p.id];
      if (before !== undefined && p.score > before)
        next[p.id] = { n: p.score - before, key: Date.now() };
      prevScores.current[p.id] = p.score;
    }
    if (Object.keys(next).length) {
      setGains((g) => ({ ...g, ...next }));
      const t = setTimeout(
        () =>
          setGains((g) => {
            const c = { ...g };
            for (const id of Object.keys(next)) if (c[id]?.key === next[id]!.key) delete c[id];
            return c;
          }),
        1800,
      );
      return () => clearTimeout(t);
    }
  }, [room.players, showScores]);

  // animação de troca de posição (técnica FLIP)
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const lastTops = useRef(new Map<string, number>());
  const order = players.map((p) => p.id).join(',');
  useLayoutEffect(() => {
    const reduce =
      document.documentElement.classList.contains('reduce-motion') ||
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    itemRefs.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top;
      const before = lastTops.current.get(id);
      lastTops.current.set(id, top);
      if (reduce || before === undefined || Math.abs(before - top) < 2) return;
      el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], {
        duration: 450,
        easing: 'cubic-bezier(.2,1.2,.4,1)',
      });
    });
  }, [order]);

  return (
    <section className="card p-4" aria-label={showScores ? 'Placar ao vivo' : 'Jogadores'}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">
          {showScores ? (
            <span className="flex items-center gap-2">
              Placar
              <span className="chip bg-pop-rose text-ink-950">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-950" aria-hidden />
                ao vivo
              </span>
            </span>
          ) : (
            'Jogadores'
          )}
        </h2>
        <span className="text-sm text-ink-400">
          {room.players.length}/{room.settings.maxPlayers}
        </span>
      </div>
      <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {players.map((p, i) => {
          const gain = gains[p.id];
          const isLeader = p.id === leaderId;
          return (
            <li
              key={p.id}
              ref={(el) => {
                if (el) itemRefs.current.set(p.id, el);
                else itemRefs.current.delete(p.id);
              }}
              className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors ${isLeader ? 'bg-pop-amber/15 ring-2 ring-pop-amber/60' : p.id === myId ? 'bg-lime-400/10' : 'bg-ink-900/60'}`}
            >
              {showScores && (
                <span className="w-6 text-center font-display text-lg font-extrabold text-ink-400">
                  {p.score > 0 && MEDALS[i] ? MEDALS[i] : i + 1}
                </span>
              )}
              <div className="relative">
                {isLeader && (
                  <span
                    className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 animate-wobble text-base"
                    aria-label="líder"
                  >
                    👑
                  </span>
                )}
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
                  {p.id === myId && (
                    <span className="text-xs font-medium text-ink-400">(você)</span>
                  )}
                </p>
                <p className="text-xs text-ink-400">
                  {p.isHost && <span className="text-pop-amber">★ anfitrião · </span>}
                  {p.status === 'online' ? (p.isGuest ? 'convidado' : 'jogador') : 'reconectando…'}
                </p>
              </div>
              {showScores && (
                <span className="relative font-display text-lg font-extrabold text-lime-400">
                  <AnimatedNumber value={p.score} />
                  {gain && (
                    <span
                      key={gain.key}
                      className="float-up pointer-events-none absolute -top-4 right-0 whitespace-nowrap rounded-full bg-lime-400 px-1.5 text-xs font-extrabold text-ink-950"
                    >
                      +{gain.n}
                    </span>
                  )}
                </span>
              )}
              {amHost && p.id === myId && !showScores && (
                <div className="w-[3.75rem]" aria-hidden />
              )}
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
          );
        })}
      </ul>
    </section>
  );
}
