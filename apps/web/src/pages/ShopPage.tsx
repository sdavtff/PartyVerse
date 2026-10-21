import { parseAvatar, type ShopItem, type ShopKind } from '@partyverse/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, NameTag } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { api, type Identity } from '../lib/api';
import { useSession } from '../lib/session';
import { sfx } from '../lib/sound';
import { usePageTitle } from '../lib/usePageTitle';

interface Shop {
  items: ShopItem[];
  coins: number;
  owned: string[];
  equipped: { frame?: string; name?: string; title?: string };
}
const SECTIONS: {
  kind: ShopKind;
  title: string;
  slot: 'frame' | 'name' | 'title';
  hint: string;
}[] = [
  {
    kind: 'frame',
    title: 'Molduras',
    slot: 'frame',
    hint: 'Um anel em volta do seu avatar, em todo lugar.',
  },
  {
    kind: 'name',
    title: 'Cor do nome',
    slot: 'name',
    hint: 'Seu apelido colorido nas salas e no ranking.',
  },
  { kind: 'title', title: 'Títulos', slot: 'title', hint: 'Uma etiqueta ao lado do seu nome.' },
];

export function ShopPage() {
  usePageTitle('Loja');
  const { user, setUser } = useSession();
  const toast = useToast();
  const [shop, setShop] = useState<Shop | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const isAccount = Boolean(user && !user.isGuest);

  const load = useCallback(() => {
    api<Shop>('/shop')
      .then(setShop)
      .catch(() => setShop(null));
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const buy = async (it: ShopItem) => {
    setBusy(it.id);
    try {
      const r = await api<{ coins: number; owned: string[] }>('/shop/buy', {
        method: 'POST',
        json: { itemId: it.id },
      });
      setShop((s) => (s ? { ...s, coins: r.coins, owned: r.owned } : s));
      sfx('win');
      toast(`Comprado: ${it.name}! Toque em "Usar" para equipar.`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };
  const equip = async (slot: 'frame' | 'name' | 'title', id: string | null) => {
    setBusy(id ?? slot);
    try {
      const r = await api<{ user: Identity }>('/shop/equip', {
        method: 'POST',
        json: { [slot]: id },
      });
      setUser(r.user);
      setShop((s) => (s ? { ...s, equipped: { ...s.equipped, [slot]: id ?? undefined } } : s));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const base = user ? parseAvatar(user.avatar).base : 'blob-1';
  const preview = (it: ShopItem) =>
    [
      base,
      it.kind === 'frame' ? it.id : null,
      it.kind === 'name' ? it.id : null,
      it.kind === 'title' ? it.id : null,
    ]
      .filter(Boolean)
      .join('.');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Loja</h1>
          <p className="mt-2 max-w-xl text-ink-200">
            Ganhe moedas jogando partidas, o desafio do dia e o torneio da semana. Tudo aqui é só
            visual — não existe compra com dinheiro de verdade.
          </p>
        </div>
        {isAccount && shop && (
          <div className="flex items-center gap-3 rounded-2xl bg-pop-amber/15 px-4 py-3">
            <Avatar avatar={user!.avatar} size={48} />
            <div>
              <NameTag
                nickname={user!.nickname}
                avatar={user!.avatar}
                className="font-bold text-white"
              />
              <p className="font-display text-2xl font-extrabold text-pop-amber">🪙 {shop.coins}</p>
            </div>
          </div>
        )}
      </div>
      {!isAccount && (
        <p className="mt-6 rounded-2xl bg-ink-800 p-4 text-ink-200">
          A loja é para contas.{' '}
          <Link to="/entrar" className="font-bold text-lime-400 hover:underline">
            Crie a sua grátis
          </Link>{' '}
          e comece a juntar moedas.
        </p>
      )}
      {shop &&
        SECTIONS.map((sec) => (
          <section key={sec.kind} className="mt-10">
            <h2 className="text-2xl font-extrabold">{sec.title}</h2>
            <p className="text-sm text-ink-400">{sec.hint}</p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shop.items
                .filter((i) => i.kind === sec.kind && (!i.prizeOnly || shop.owned.includes(i.id)))
                .map((it) => {
                  const owned = shop.owned.includes(it.id);
                  const using = shop.equipped[sec.slot] === it.id;
                  return (
                    <li
                      key={it.id}
                      className={`card flex flex-col items-center gap-2 p-4 text-center ${using ? 'ring-2 ring-lime-400' : ''}`}
                    >
                      {sec.kind === 'frame' ? (
                        <Avatar avatar={preview(it)} size={72} />
                      ) : (
                        <div className="grid h-[72px] place-items-center">
                          <NameTag
                            nickname={user?.nickname ?? 'Você'}
                            avatar={preview(it)}
                            className="text-lg font-extrabold text-white"
                          />
                        </div>
                      )}
                      <p className="font-bold text-white">{it.name}</p>
                      {it.prizeOnly && (
                        <p className="text-xs text-pop-amber">🏆 Prêmio do torneio</p>
                      )}
                      {!owned ? (
                        <button
                          disabled={!isAccount || busy !== null || shop.coins < it.price}
                          onClick={() => buy(it)}
                          className="mt-auto w-full rounded-xl bg-pop-amber px-3 py-2 text-sm font-extrabold text-night disabled:opacity-40"
                        >
                          🪙 {it.price}
                        </button>
                      ) : using ? (
                        <button
                          disabled={busy !== null}
                          onClick={() => equip(sec.slot, null)}
                          className="mt-auto w-full rounded-xl bg-ink-700 px-3 py-2 text-sm font-bold text-white"
                        >
                          Usando ✓ · tirar
                        </button>
                      ) : (
                        <button
                          disabled={busy !== null}
                          onClick={() => equip(sec.slot, it.id)}
                          className="mt-auto w-full rounded-xl bg-lime-400 px-3 py-2 text-sm font-extrabold text-night"
                        >
                          Usar
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      <p className="mt-10 text-sm text-ink-400">
        Como ganhar: partida 5–20 🪙 (mais para o pódio) · desafio do dia 15 🪙 cada · torneio da
        semana até 300 🪙 + moldura e título exclusivos.
      </p>
    </div>
  );
}
