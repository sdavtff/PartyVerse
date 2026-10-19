import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi, type FriendEntry } from '../lib/social';
import { Avatar } from './Avatar';
import { useToast } from './Toast';

/** Janela "Chamar amigos": lista amigos online e envia convite para a sala atual. */
export function InviteFriends({ onClose, roomCode }: { onClose: () => void; roomCode: string }) {
  const [list, setList] = useState<FriendEntry[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const toast = useToast();

  useEffect(() => {
    friendsApi
      .list()
      .then((l) => setList(l.filter((f) => f.status === 'friend')))
      .catch(() => setList([]));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const invite = async (f: FriendEntry) => {
    try {
      await friendsApi.invite(f.user.id);
      setSent((s) => new Set(s).add(f.user.id));
      toast(`Convite enviado para ${f.user.nickname}!`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const sorted = [...(list ?? [])].sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className="card w-full max-w-md animate-pop p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="invite-title" className="text-xl font-extrabold">
            Chamar amigos
          </h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-400 hover:bg-ink-700 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {list === null ? (
          <p className="mt-4 text-ink-400">Carregando…</p>
        ) : sorted.length === 0 ? (
          <p className="mt-4 text-ink-200">
            Você ainda não tem amigos.{' '}
            <Link to="/amigos" target="_blank" className="font-bold text-lime-400 hover:underline">
              Adicione alguns
            </Link>{' '}
            ou mande o link da sala pelo WhatsApp.
          </p>
        ) : (
          <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
            {sorted.map((f) => {
              const here = f.room?.code === roomCode;
              return (
                <li
                  key={f.user.id}
                  className="flex items-center gap-3 rounded-2xl bg-ink-900/60 p-2"
                >
                  <span className="relative">
                    <Avatar avatar={f.user.avatar} size={36} dim={!f.online} />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-800 ${f.online ? 'bg-lime-400' : 'bg-ink-600'}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{f.user.nickname}</span>
                    <span className="text-xs text-ink-400">
                      {here
                        ? 'já está aqui'
                        : f.online
                          ? f.room
                            ? 'em outra sala'
                            : 'online'
                          : 'offline'}
                    </span>
                  </span>
                  <button
                    disabled={!f.online || here || sent.has(f.user.id)}
                    onClick={() => invite(f)}
                    className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-night hover:bg-lime-300 disabled:bg-ink-700 disabled:text-ink-400"
                  >
                    {sent.has(f.user.id) ? 'Enviado ✓' : 'Convidar'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
