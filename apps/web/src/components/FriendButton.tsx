import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import { friendsApi, type FriendStatus } from '../lib/social';
import { useToast } from './Toast';

/** Botão de amizade no perfil público: adicionar, aceitar, cancelar ou desfazer. */
export function FriendButton({ userId }: { userId: string }) {
  const { user } = useSession();
  const [status, setStatus] = useState<FriendStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!user || user.isGuest || user.id === userId) return;
    friendsApi
      .relation(userId)
      .then((r) => setStatus(r.status))
      .catch(() => setStatus(null));
  }, [user, userId]);

  if (!user || user.id === userId) return null;
  if (user.isGuest)
    return (
      <Link
        to="/entrar"
        className="rounded-xl bg-ink-700 px-3 py-2 text-sm font-bold text-white hover:bg-ink-600"
      >
        Crie uma conta para adicionar
      </Link>
    );
  if (status === undefined) return null;

  const run = async (fn: () => Promise<{ status: FriendStatus | null }>, msg?: string) => {
    setBusy(true);
    try {
      const r = await fn();
      setStatus(r.status);
      if (msg) toast(msg, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const base = 'rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-50';
  if (status === 'friend')
    return (
      <button
        disabled={busy}
        className={`${base} bg-ink-700 text-white hover:bg-pop-rose hover:text-ink-950`}
        onClick={() => confirm('Desfazer amizade?') && run(() => friendsApi.remove(userId))}
        title="Desfazer amizade"
      >
        🤝 Amigos
      </button>
    );
  if (status === 'outgoing')
    return (
      <button
        disabled={busy}
        className={`${base} bg-ink-700 text-ink-200 hover:text-white`}
        onClick={() => run(() => friendsApi.remove(userId))}
      >
        ⏳ Pedido enviado · cancelar
      </button>
    );
  return (
    <button
      disabled={busy}
      className={`${base} bg-lime-400 text-ink-950 hover:bg-lime-300`}
      onClick={() =>
        run(
          () => friendsApi.add(userId),
          status === 'incoming' ? 'Pedido aceito! Agora vocês são amigos.' : 'Pedido enviado!',
        )
      }
    >
      {status === 'incoming' ? '✅ Aceitar amizade' : '➕ Adicionar amigo'}
    </button>
  );
}
