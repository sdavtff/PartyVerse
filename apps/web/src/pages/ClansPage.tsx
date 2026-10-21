import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, NameTag } from '../components/Avatar';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { usePageTitle } from '../lib/usePageTitle';

interface ClanSummary {
  tag: string;
  name: string;
  emoji: string;
  description: string;
  size: number;
  wins: number;
}
interface ClanFull {
  tag: string;
  name: string;
  emoji: string;
  description: string;
  ownerId: string;
  wins: number;
  members: { userId: string; nickname: string; avatar: string; role: string; wins: number }[];
}
const EMOJIS = [
  '🔥',
  '⭐',
  '🐉',
  '🦊',
  '🐺',
  '🦁',
  '👑',
  '⚡',
  '🍕',
  '🎮',
  '🎨',
  '🛡️',
  '🚀',
  '🌈',
  '💎',
  '🐸',
];

/** /clas — ranking de clãs, criar e entrar. */
export function ClansPage() {
  usePageTitle('Clãs');
  const { user } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState<{ season: string; clans: ClanSummary[] } | null>(null);
  const [mine, setMine] = useState<{ tag: string } | null>(null);
  const [form, setForm] = useState({ name: '', tag: '', emoji: '🔥', description: '' });
  const [busy, setBusy] = useState(false);
  const isAccount = Boolean(user && !user.isGuest);

  useEffect(() => {
    api<{ season: string; clans: ClanSummary[] }>('/clans')
      .then(setData)
      .catch(() => setData({ season: '', clans: [] }));
    if (isAccount)
      api<{ tag: string } | null>('/clans/mine')
        .then(setMine)
        .catch(() => undefined);
  }, [isAccount]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Clãs</h1>
      <p className="mt-2 text-ink-200">
        Monte um grupo com a sua turma. O ranking soma as vitórias dos membros na temporada{' '}
        {data?.season && <b className="text-white">({data.season})</b>}.
      </p>
      {mine && (
        <Link
          to={`/cla/${mine.tag}`}
          className="mt-4 inline-block rounded-2xl bg-lime-400 px-4 py-2 font-bold text-night"
        >
          Ver meu clã ›
        </Link>
      )}

      {isAccount && !mine && (
        <form
          className="card mt-6 grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const c = await api<{ tag: string }>('/clans', { method: 'POST', json: form });
              toast('Clã criado! Chame a galera para entrar.', 'success');
              nav(`/cla/${c.tag}`);
            } catch (err) {
              toast((err as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="text-xl font-extrabold sm:col-span-2">Criar um clã</h2>
          <label className="block">
            <span className="label">Nome</span>
            <input
              className="input py-2"
              maxLength={24}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Sigla (2 a 5)</span>
            <input
              className="input py-2 uppercase"
              maxLength={5}
              value={form.tag}
              onChange={(e) =>
                setForm({ ...form, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
              }
            />
          </label>
          <div className="sm:col-span-2">
            <span className="label">Símbolo</span>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setForm({ ...form, emoji: em })}
                  aria-pressed={form.emoji === em}
                  className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${form.emoji === em ? 'bg-lime-400' : 'bg-ink-900 hover:bg-ink-700'}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <label className="block sm:col-span-2">
            <span className="label">Descrição (opcional)</span>
            <input
              className="input py-2"
              maxLength={120}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={busy || form.name.trim().length < 3 || form.tag.length < 2}
            >
              Criar clã
            </Button>
          </div>
        </form>
      )}
      {!isAccount && (
        <p className="mt-6 rounded-2xl bg-ink-800 p-4 text-ink-200">
          <Link to="/entrar" className="font-bold text-lime-400 hover:underline">
            Crie uma conta
          </Link>{' '}
          para criar ou entrar em um clã.
        </p>
      )}

      <h2 className="mt-10 text-2xl font-extrabold">Ranking de clãs</h2>
      {!data ? (
        <p className="mt-3 text-ink-400">Carregando…</p>
      ) : data.clans.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-ink-800 p-5 text-ink-200">
          Nenhum clã ainda. Crie o primeiro!
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {data.clans.map((c, i) => (
            <li key={c.tag}>
              <Link
                to={`/cla/${c.tag}`}
                className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-3 hover:bg-ink-700"
              >
                <span className="w-8 font-display text-xl font-extrabold text-ink-400">
                  {['🥇', '🥈', '🥉'][i] ?? i + 1}
                </span>
                <span className="text-2xl">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-white">
                    [{c.tag}] {c.name}
                  </span>
                  <span className="text-xs text-ink-400">
                    {c.size} {c.size === 1 ? 'membro' : 'membros'}
                    {c.description && ` · ${c.description}`}
                  </span>
                </span>
                <span className="font-display text-lg font-extrabold text-lime-400">
                  {c.wins} 🏆
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** /cla/:tag — página do clã. */
export function ClanPage() {
  const { tag = '' } = useParams();
  const { user } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [c, setC] = useState<ClanFull | null | undefined>(undefined);
  const [mine, setMine] = useState<{ tag: string } | null>(null);
  usePageTitle(c ? `[${c.tag}] ${c.name}` : 'Clã');
  const isAccount = Boolean(user && !user.isGuest);

  const load = useCallback(() => {
    api<ClanFull>(`/clans/${tag}`)
      .then(setC)
      .catch(() => setC(null));
    if (isAccount)
      api<{ tag: string } | null>('/clans/mine')
        .then(setMine)
        .catch(() => undefined);
  }, [tag, isAccount]);
  useEffect(load, [load]);

  const run = async (p: Promise<unknown>, msg: string) => {
    try {
      await p;
      toast(msg, 'success');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (c === undefined) return <p className="p-16 text-center text-ink-400">Carregando…</p>;
  if (c === null)
    return (
      <div className="p-16 text-center">
        <p className="text-ink-200">Clã não encontrado.</p>
        <Link to="/clas" className="font-bold text-lime-400 hover:underline">
          Ver clãs
        </Link>
      </div>
    );
  const amMember = c.members.some((m) => m.userId === user?.id);
  const amOwner = c.ownerId === user?.id;
  const members = [...c.members].sort((a, b) => b.wins - a.wins);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/clas" className="text-sm font-bold text-ink-400 hover:text-white">
        ‹ Clãs
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-ink-800 text-5xl">
          {c.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-extrabold">
            [{c.tag}] {c.name}
          </h1>
          {c.description && <p className="text-ink-200">{c.description}</p>}
          <p className="text-sm text-ink-400">
            {c.members.length}/30 membros · {c.wins} vitórias na temporada
          </p>
        </div>
        {isAccount && !amMember && !mine && (
          <Button
            onClick={() =>
              run(api(`/clans/${c.tag}/join`, { method: 'POST' }), `Bem-vindo ao ${c.name}!`)
            }
          >
            Entrar no clã
          </Button>
        )}
        {amMember && (
          <Button
            variant="ghost"
            onClick={() =>
              confirm(
                amOwner && c.members.length === 1
                  ? 'Você é o único membro: o clã será apagado. Sair?'
                  : 'Sair do clã?',
              ) &&
              run(api('/clans/leave', { method: 'POST' }), 'Você saiu do clã').then(
                () => c.members.length === 1 && nav('/clas'),
              )
            }
          >
            Sair do clã
          </Button>
        )}
      </div>
      {amMember && (
        <p className="mt-4 rounded-2xl bg-ink-800 p-3 text-sm text-ink-200">
          Convide a galera: mande a sigla <b className="text-lime-400">{c.tag}</b> ou o link desta
          página.
        </p>
      )}
      <ol className="mt-6 space-y-2">
        {members.map((m, i) => (
          <li key={m.userId} className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-2">
            <span className="w-6 text-center font-bold text-ink-400">{i + 1}</span>
            <Avatar avatar={m.avatar} size={36} />
            <Link
              to={`/jogador/${m.userId}`}
              className="flex min-w-0 flex-1 items-center gap-2 font-bold text-white hover:underline"
            >
              <NameTag nickname={m.nickname} avatar={m.avatar} />
              {m.role === 'owner' && <span title="Líder">👑</span>}
            </Link>
            <span className="text-sm font-bold text-lime-400">{m.wins} 🏆</span>
            {amOwner && m.userId !== user?.id && (
              <button
                className="rounded-lg px-2 py-1 text-xs font-bold text-pop-rose hover:bg-ink-700"
                onClick={() =>
                  confirm(`Remover ${m.nickname} do clã?`) &&
                  run(
                    api(`/clans/${c.tag}/members/${m.userId}`, { method: 'DELETE' }),
                    `${m.nickname} saiu do clã`,
                  )
                }
              >
                Remover
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
