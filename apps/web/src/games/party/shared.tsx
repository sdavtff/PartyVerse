import { EVENTS, type PublicRoom } from '@partyverse/shared';
import { useToast } from '../../components/Toast';
import { actionId, emitAck } from '../../lib/socket';

export function usePlayers(room: PublicRoom) {
  const player = (id: string) => room.players.find((p) => p.id === id);
  return {
    nick: (id: string) => player(id)?.nickname ?? 'Alguém',
    avatar: (id: string) => player(id)?.avatar ?? 'blob-1',
  };
}

export function useAct() {
  const toast = useToast();
  return (action: unknown) =>
    emitAck(EVENTS.GAME_ACTION, { action, actionId: actionId() }).catch((e) =>
      toast((e as Error).message, 'error'),
    );
}

/** Relógio redondo com segundos restantes. */
export function Clock({ left, accent = 'text-lime-400' }: { left: number; accent?: string }) {
  return (
    <span
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-ink-700 font-display text-xl font-extrabold ${left <= 5 ? 'animate-pulse text-pop-rose' : accent}`}
      aria-label={`${left} segundos`}
    >
      {left}
    </span>
  );
}

export function Countdown({ left, text, accent }: { left: number; text: string; accent: string }) {
  return (
    <div className="card grid place-items-center gap-3 p-10 text-center">
      <p className="text-ink-400">{text}</p>
      <p key={left} className={`animate-pop font-display text-8xl font-extrabold ${accent}`}>
        {left || 'Já!'}
      </p>
    </div>
  );
}
