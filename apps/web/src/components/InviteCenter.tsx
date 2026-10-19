import { EVENTS, GAME_CATALOG } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import { friendsApi, type InvitePayload } from '../lib/social';
import { getSocket } from '../lib/socket';
import { sfx } from '../lib/sound';
import { Avatar } from './Avatar';
import { useToast } from './Toast';

interface Item extends InvitePayload {
  id: number;
}
let seq = 0;

/**
 * Para quem tem conta: mantém a conexão aberta (amigos veem você online) e mostra
 * convites de sala e pedidos de amizade que chegam em tempo real.
 */
export function InviteCenter() {
  const { user } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!user || user.isGuest) return;
    const s = getSocket();
    const onInvite = (p: InvitePayload) => {
      const id = ++seq;
      setItems((xs) =>
        [...xs.filter((x) => x.from.id !== p.from.id || x.kind !== p.kind), { ...p, id }].slice(-3),
      );
      sfx('join');
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 30_000);
    };
    s.on(EVENTS.INVITE, onInvite);
    if (!s.connected) s.connect();
    return () => {
      s.off(EVENTS.INVITE, onInvite);
    };
  }, [user]);

  const dismiss = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  if (!items.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed right-3 top-20 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2"
    >
      {items.map((it) => {
        const game = it.room ? GAME_CATALOG.find((g) => g.id === it.room!.gameId) : undefined;
        return (
          <div
            key={it.id}
            role="status"
            className="animate-rise rounded-2xl border-2 border-lime-400 bg-ink-800 p-3 shadow-chunky"
          >
            <div className="flex items-center gap-3">
              <Avatar avatar={it.from.avatar} size={40} />
              <p className="min-w-0 flex-1 text-sm text-ink-200">
                <b className="text-white">{it.from.nickname}</b>{' '}
                {it.kind === 'room' ? (
                  <>
                    te chamou para jogar
                    {game ? (
                      <>
                        {' '}
                        <b className="text-lime-400">{game.name}</b>
                      </>
                    ) : (
                      ''
                    )}
                    {it.room?.name ? <> na sala “{it.room.name}”</> : ''}
                  </>
                ) : (
                  'quer ser seu amigo'
                )}
              </p>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded-xl px-3 py-1.5 text-sm font-bold text-ink-400 hover:text-white"
                onClick={() => dismiss(it.id)}
              >
                Agora não
              </button>
              {it.kind === 'room' ? (
                <button
                  className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-ink-950 hover:bg-lime-300"
                  onClick={() => {
                    dismiss(it.id);
                    navigate(`/sala/${it.room!.code}`);
                  }}
                >
                  Entrar na sala
                </button>
              ) : (
                <button
                  className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-ink-950 hover:bg-lime-300"
                  onClick={async () => {
                    dismiss(it.id);
                    try {
                      await friendsApi.add(it.from.id);
                      toast(`Agora você e ${it.from.nickname} são amigos!`, 'success');
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    }
                  }}
                >
                  Aceitar
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
