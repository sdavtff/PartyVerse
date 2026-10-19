import { GAME_CATALOG, EVENTS, type GameId, type PublicRoom } from '@partyverse/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { emitAck, getSocket } from '../lib/socket';
import { GameIcon, gameAccent } from '../components/GameIcon';
import { Avatar, encodeAvatar, randomAvatarParts } from '../components/Avatar';
import { AvatarEditor } from '../components/AvatarEditor';
import { RoomList, usePublicRooms } from '../components/PublicRooms';
import { guideById, guideBySlug } from '../lib/gameGuides';
import { usePageTitle } from '../lib/usePageTitle';

export function Home() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, guest } = useSession();
  const [code, setCode] = useState('');
  const rooms = usePublicRooms();
  const [params] = useSearchParams();
  usePageTitle(null);
  const [online, setOnline] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    isPublic: false,
    maxPlayers: 8,
    gameId: (guideBySlug(params.get('jogo') ?? '')?.id ?? 'stop') as GameId,
  });
  const [nick, setNick] = useState('');
  const [avatar, setAvatar] = useState(() => encodeAvatar(randomAvatarParts()));
  const [editAvatar, setEditAvatar] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => {
      api<{ online: number }>('/stats')
        .then((s) => setOnline(s.online))
        .catch(() => undefined);
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const ensureSession = async () => {
    if (user) return true;
    if (nick.trim().length < 2) {
      toast('Escolha um apelido primeiro', 'error');
      document.getElementById('home-nick')?.focus();
      return false;
    }
    await guest(nick, avatar);
    return true;
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) return toast('O código tem 6 letras/números', 'error');
    nav(`/sala/${c}`);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!(await ensureSession())) return;
      const s = getSocket();
      if (!s.connected) {
        s.connect();
        await new Promise<void>((res, rej) => {
          s.once('connect', () => res());
          s.once('connect_error', () => rej(new Error('Não foi possível conectar ao servidor')));
        });
      }
      const name = form.name.trim() || `Sala de ${user?.nickname ?? nick.trim()}`;
      const room = await emitAck<PublicRoom>(EVENTS.ROOM_CREATE, {
        settings: { ...form, name },
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      nav(`/sala/${room.code}`);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const available = GAME_CATALOG.filter((g) => g.available);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* HERO */}
      <section className="grid items-center gap-8 py-10 md:grid-cols-[1.15fr_1fr] md:py-16">
        <div className="animate-rise">
          <span className="chip bg-ink-800 text-lime-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-lime-400" aria-hidden />
            {online === null
              ? 'conectando…'
              : `${online} ${online === 1 ? 'pessoa jogando' : 'pessoas jogando'} agora`}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            A festa cabe <br className="hidden sm:block" />
            numa{' '}
            <span className="relative inline-block text-lime-400">
              aba do navegador
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 10" aria-hidden>
                <path
                  d="M2 7q50-6 100 0t96 0"
                  stroke="#ff5fa2"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-200">
            Crie uma sala, mande o código para a galera e joguem juntos: adedonha, rabisco, mímica,
            quiz, palavra secreta e impostor. Até 50 pessoas por sala, sem instalar nada.
          </p>
          <form onSubmit={join} className="mt-7 flex max-w-md gap-2">
            <label htmlFor="code" className="sr-only">
              Código da sala
            </label>
            <input
              id="code"
              className="input font-display text-lg uppercase tracking-[0.3em]"
              placeholder="CÓDIGO"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              autoComplete="off"
            />
            <Button type="submit" variant="secondary" disabled={code.length !== 6}>
              Entrar
            </Button>
          </form>
        </div>

        {/* CRIAR SALA */}
        <form
          onSubmit={create}
          id="criar"
          className="card animate-pop scroll-mt-24 p-6"
          aria-labelledby="create-title"
        >
          <h2 id="create-title" className="text-2xl font-extrabold">
            Criar sala
          </h2>
          {!user && (
            <div className="mt-4">
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditAvatar((v) => !v)}
                  className="relative rounded-full"
                  aria-label="Editar avatar"
                  title="Editar avatar"
                >
                  <Avatar avatar={avatar} size={56} />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-ink-950 bg-lime-400 text-xs text-ink-950">
                    ✎
                  </span>
                </button>
                <p className="text-sm text-ink-400">
                  {editAvatar ? 'Monte seu personagem:' : 'Toque no avatar para personalizar'}
                </p>
              </div>
              {editAvatar && (
                <div className="mb-4 rounded-2xl bg-ink-900/60 p-3">
                  <AvatarEditor value={avatar} onChange={setAvatar} compact />
                </div>
              )}
              <label htmlFor="home-nick" className="label">
                Seu apelido
              </label>
              <input
                id="home-nick"
                className="input"
                maxLength={20}
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="ex.: Tatu Bola"
              />
            </div>
          )}
          <label htmlFor="room-name" className="label mt-4">
            Nome da sala
          </label>
          <input
            id="room-name"
            className="input"
            maxLength={40}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={`Sala de ${user?.nickname ?? (nick || 'você')}`}
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="room-game" className="label">
                Jogo
              </label>
              <select
                id="room-game"
                className="input"
                value={form.gameId}
                onChange={(e) => setForm({ ...form, gameId: e.target.value as GameId })}
              >
                {available.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="room-max" className="label">
                Máx. jogadores
              </label>
              <input
                id="room-max"
                type="number"
                min={2}
                max={50}
                className="input"
                value={form.maxPlayers}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxPlayers: Math.min(50, Math.max(2, Number(e.target.value) || 2)),
                  })
                }
              />
            </div>
          </div>
          <fieldset className="mt-4">
            <legend className="label">Visibilidade</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: false, t: 'Privada', d: 'só com código' },
                { v: true, t: 'Pública', d: 'aparece na lista' },
              ].map((o) => (
                <label
                  key={o.t}
                  className={`cursor-pointer rounded-2xl border-2 px-3 py-2 transition ${form.isPublic === o.v ? 'border-lime-400 bg-ink-700' : 'border-ink-600 hover:border-ink-400'}`}
                >
                  <input
                    type="radio"
                    name="vis"
                    className="sr-only"
                    checked={form.isPublic === o.v}
                    onChange={() => setForm({ ...form, isPublic: o.v })}
                  />
                  <span className="block font-bold text-white">{o.t}</span>
                  <span className="text-xs text-ink-400">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="room-pass" className="label mt-4">
            Senha <span className="font-medium text-ink-400">(opcional)</span>
          </label>
          <input
            id="room-pass"
            className="input"
            maxLength={20}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="sem senha"
            autoComplete="off"
          />
          <Button className="mt-6 w-full" size="lg" disabled={busy}>
            {busy ? 'Criando…' : 'Criar e convidar'}
          </Button>
        </form>
      </section>

      {/* CATÁLOGO */}
      <section aria-labelledby="games-title" className="mt-4">
        <div className="flex items-end justify-between">
          <h2 id="games-title" className="text-3xl font-extrabold">
            Jogos
          </h2>
          <span className="text-sm text-ink-400">
            <Link to="/jogos" className="font-bold text-lime-400 hover:underline">
              {available.length} jogos · ver regras ›
            </Link>
          </span>
        </div>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_CATALOG.map((g, i) => (
            <li
              key={g.id}
              className="card group relative overflow-hidden p-5 transition hover:-translate-y-1"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20 transition group-hover:scale-125"
                style={{ background: gameAccent(g.id) }}
                aria-hidden
              />
              <GameIcon id={g.id} />
              <h3 className="mt-3 text-xl font-extrabold">
                <Link to={`/jogos/${guideById(g.id)?.slug ?? g.id}`} className="hover:underline">
                  {g.name}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-ink-200">{g.tagline}</p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-ink-400">
                  {g.minPlayers}–{g.maxPlayers} jogadores
                </span>
                {g.available ? (
                  <button
                    className="chip bg-lime-400 text-ink-950 hover:bg-lime-300"
                    onClick={() => {
                      setForm({ ...form, gameId: g.id });
                      document.getElementById('room-name')?.focus();
                    }}
                  >
                    Jogar ▸
                  </button>
                ) : (
                  <span className="chip bg-ink-700 text-ink-200">Em breve</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* SALAS PÚBLICAS */}
      <section aria-labelledby="rooms-title" className="mt-12">
        <div className="flex items-end justify-between">
          <h2 id="rooms-title" className="text-3xl font-extrabold">
            Salas públicas
          </h2>
          <Link to="/salas" className="text-sm font-bold text-lime-400 hover:underline">
            Ver todas ›
          </Link>
        </div>
        <RoomList
          rooms={rooms?.slice(0, 6) ?? null}
          empty="Nenhuma sala pública aberta agora. Crie uma e marque como pública!"
        />
        {rooms && rooms.length > 6 && (
          <Link to="/salas" className="mt-4 inline-block font-bold text-lime-400 hover:underline">
            Ver todas as {rooms.length} salas ›
          </Link>
        )}
      </section>
    </div>
  );
}
