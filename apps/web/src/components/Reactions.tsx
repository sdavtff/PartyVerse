import { EVENTS, REACTIONS, type PublicRoom } from '@partyverse/shared';
import { useEffect, useRef, useState } from 'react';
import { emitAck, getSocket } from '../lib/socket';

interface Flying {
  id: number;
  emoji: string;
  name: string;
  x: number;
  drift: number;
}
let seq = 0;

/** Emojis que sobem pela tela de todo mundo da sala. */
export function ReactionLayer({ room }: { room: PublicRoom }) {
  const [items, setItems] = useState<Flying[]>([]);
  const names = useRef(new Map<string, string>());
  names.current = new Map(room.players.map((p) => [p.id, p.nickname]));

  useEffect(() => {
    const s = getSocket();
    const on = (r: { playerId: string; emoji: string }) => {
      const id = ++seq;
      setItems((xs) => [
        ...xs.slice(-24),
        {
          id,
          emoji: r.emoji,
          name: names.current.get(r.playerId) ?? '',
          x: 8 + Math.random() * 84,
          drift: Math.round((Math.random() - 0.5) * 80),
        },
      ]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2600);
    };
    s.on(EVENTS.REACTION, on);
    return () => {
      s.off(EVENTS.REACTION, on);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {items.map((it) => (
        <span
          key={it.id}
          className="reaction-fly absolute bottom-6 flex flex-col items-center"
          style={{ left: `${it.x}%`, ['--drift' as string]: `${it.drift}px` }}
        >
          <span className="text-4xl drop-shadow-lg sm:text-5xl">{it.emoji}</span>
          {it.name && (
            <span className="mt-0.5 max-w-[7rem] truncate rounded-full bg-ink-950/80 px-2 text-[11px] font-bold text-white">
              {it.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Barra de reações rápidas. */
export function ReactionBar() {
  const last = useRef(0);
  const send = (emoji: string) => {
    const now = Date.now();
    if (now - last.current < 700) return; // evita spam
    last.current = now;
    emitAck(EVENTS.REACTION, { emoji }).catch(() => undefined);
  };
  return (
    <div
      className="card flex items-center justify-between gap-1 px-2 py-1.5"
      role="group"
      aria-label="Reações rápidas"
    >
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => send(e)}
          className="grid h-10 w-10 place-items-center rounded-xl text-2xl transition hover:scale-125 hover:bg-ink-700 active:scale-95"
          aria-label={`Reagir com ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
