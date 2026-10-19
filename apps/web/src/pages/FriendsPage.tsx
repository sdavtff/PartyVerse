import { GAME_CATALOG } from '@partyverse/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useSession } from '../lib/session';
import { friendsApi, type FriendEntry, type FriendUser } from '../lib/social';
import { usePageTitle } from '../lib/usePageTitle';

export function FriendsPage() {
  usePageTitle('Amigos');
  const { user, loading } = useSession();
  const toast = useToast();
  const [list, setList] = useState<FriendEntry[] | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FriendUser[]>([]);

  const load = useCallback(() => {
    friendsApi
      .list()
      .then(setList)
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!user || user.isGuest) return;
    load();
    const t = setInterval(load, 20_000); // atualiza quem está online
    return () => clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => {
      friendsApi
        .search(q.trim())
        .then(setFound)
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (p: Promise<unknown>, msg?: string) => {
    try {
      await p;
      if (msg) toast(msg, 'success');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (loading) return null;
  if (!user || user.isGuest)
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🤝
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Amigos</h1>
        <p className="mt-2 text-ink-200">
          Com uma conta você adiciona amigos, vê quem está online e chama a galera para sua sala com
          um toque.
        </p>
        <Link
          to="/entrar"
          className="mt-6 inline-block rounded-2xl bg-lime-400 px-5 py-3 font-bold text-night shadow-chunky hover:bg-lime-300"
        >
          Criar conta grátis
        </Link>
      </div>
    );

  const friends = (list ?? [])
    .filter((f) => f.status === 'friend')
    .sort(
      (a, b) =>
        Number(b.online) - Number(a.online) || a.user.nickname.localeCompare(b.user.nickname),
    );
  const incoming = (list ?? []).filter((f) => f.status === 'incoming');
  const outgoing = (list ?? []).filter((f) => f.status === 'outgoing');
  const known = new Map((list ?? []).map((f) => [f.user.id, f.status]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Amigos</h1>
      <p className="mt-2 text-ink-200">
        Veja quem está online e entre na sala deles. Dentro de uma sala, use{' '}
        <b className="text-white">Chamar amigos</b> para convidar.
      </p>

      <section className="mt-8 rounded-3xl border-2 border-ink-700 bg-ink-800 p-5">
        <label htmlFor="friend-search" className="font-bold text-white">
          Procurar jogador
        </label>
        <input
          id="friend-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite o apelido…"
          maxLength={20}
          className="mt-2 w-full rounded-2xl border-2 border-ink-600 bg-ink-950 px-4 py-3 text-white outline-none focus:border-lime-400"
        />
        {found.length > 0 && (
          <ul className="mt-3 divide-y divide-ink-700">
            {found.map((u) => {
              const st = known.get(u.id);
              return (
                <li key={u.id} className="flex items-center gap-3 py-2">
                  <Avatar avatar={u.avatar} size={36} />
                  <Link
                    to={`/jogador/${u.id}`}
                    className="flex-1 truncate font-bold hover:underline"
                  >
                    {u.nickname}
                  </Link>
                  {st === 'friend' ? (
                    <span className="text-sm text-ink-400">já é amigo</span>
                  ) : st === 'outgoing' ? (
                    <span className="text-sm text-ink-400">pedido enviado</span>
                  ) : (
                    <button
                      className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-night hover:bg-lime-300"
                      onClick={() =>
                        act(
                          friendsApi.add(u.id),
                          st === 'incoming' ? 'Amizade aceita!' : 'Pedido enviado!',
                        )
                      }
                    >
                      {st === 'incoming' ? 'Aceitar' : 'Adicionar'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {q.trim().length >= 2 && !found.length && (
          <p className="mt-3 text-sm text-ink-400">Ninguém encontrado com esse apelido.</p>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold">Pedidos recebidos</h2>
          <ul className="mt-3 space-y-2">
            {incoming.map((f) => (
              <li key={f.user.id} className="flex items-center gap-3 rounded-2xl bg-ink-800 p-3">
                <Avatar avatar={f.user.avatar} size={40} />
                <Link
                  to={`/jogador/${f.user.id}`}
                  className="flex-1 truncate font-bold hover:underline"
                >
                  {f.user.nickname}
                </Link>
                <button
                  className="rounded-xl px-3 py-1.5 text-sm font-bold text-ink-400 hover:text-white"
                  onClick={() => act(friendsApi.remove(f.user.id))}
                >
                  Recusar
                </button>
                <button
                  className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-night hover:bg-lime-300"
                  onClick={() => act(friendsApi.add(f.user.id), 'Amizade aceita!')}
                >
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">
          Seus amigos{' '}
          {friends.length > 0 && <span className="text-ink-400">({friends.length})</span>}
        </h2>
        {list === null ? (
          <p className="mt-3 text-ink-400">Carregando…</p>
        ) : friends.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-ink-800 p-5 text-ink-200">
            Você ainda não tem amigos aqui. Procure pelo apelido acima ou adicione alguém pelo{' '}
            <Link to="/ranking" className="font-bold text-lime-400 hover:underline">
              ranking
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {friends.map((f) => {
              const game = f.room ? GAME_CATALOG.find((g) => g.id === f.room!.gameId) : undefined;
              return (
                <li key={f.user.id} className="flex items-center gap-3 rounded-2xl bg-ink-800 p-3">
                  <span className="relative">
                    <Avatar avatar={f.user.avatar} size={44} />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-800 ${f.online ? 'bg-lime-400' : 'bg-ink-600'}`}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/jogador/${f.user.id}`}
                      className="block truncate font-bold hover:underline"
                    >
                      {f.user.nickname}
                    </Link>
                    <span className="block truncate text-xs text-ink-400">
                      {f.room
                        ? `${f.room.phase === 'playing' ? 'Jogando' : 'Na sala'} · ${game?.name ?? ''}`
                        : f.online
                          ? 'Online'
                          : 'Offline'}
                    </span>
                  </span>
                  {f.room && (
                    <Link
                      to={`/sala/${f.room.code}`}
                      className="rounded-xl bg-lime-400 px-3 py-1.5 text-sm font-bold text-night hover:bg-lime-300"
                    >
                      {f.room.phase === 'playing' ? 'Assistir' : 'Entrar'}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold text-ink-200">Pedidos enviados</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {outgoing.map((f) => (
              <li
                key={f.user.id}
                className="flex items-center gap-2 rounded-full bg-ink-800 py-1 pl-1 pr-3 text-sm"
              >
                <Avatar avatar={f.user.avatar} size={26} />
                {f.user.nickname}
                <button
                  className="ml-1 text-ink-400 hover:text-pop-rose"
                  aria-label={`Cancelar pedido para ${f.user.nickname}`}
                  onClick={() => act(friendsApi.remove(f.user.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
