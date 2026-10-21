import {
  ACHIEVEMENTS,
  EVENTS,
  GAME_CATALOG,
  levelInfo,
  type GameId,
  type GameMeta,
  type PublicRoom,
} from '@partyverse/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, NameTag, encodeAvatar, randomAvatarParts } from '../components/Avatar';
import { AvatarEditor } from '../components/AvatarEditor';
import { Button } from '../components/Button';
import { GameCover } from '../components/GameCover';
import { GameIcon } from '../components/GameIcon';
import { Icon } from '../components/Icons';
import { AndroidAppLink } from '../components/InstallButton';
import { usePublicRooms, type RoomSummary } from '../components/PublicRooms';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { guideById, guideBySlug } from '../lib/gameGuides';
import { useMyProfile, type MyProfile } from '../lib/me';
import { useSession } from '../lib/session';
import { emitAck, getSocket } from '../lib/socket';
import { usePageTitle } from '../lib/usePageTitle';

interface DailyBrief {
  day: string;
  streak: number;
  recentDays?: string[];
  termoDone?: boolean;
  quiz: { done: unknown };
  stop: { done: unknown };
}

const AVAILABLE = GAME_CATALOG.filter((g) => g.available);

/** Jogo em destaque: muda todo dia. */
function featuredGame(): GameMeta {
  const day = Math.floor((Date.now() - 3 * 3600_000) / 86400_000);
  return AVAILABLE[day % AVAILABLE.length]!;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function Home() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, guest } = useSession();
  const me = useMyProfile();
  const [code, setCode] = useState('');
  const rooms = usePublicRooms();
  const [params] = useSearchParams();
  usePageTitle(null);
  const [online, setOnline] = useState<number | null>(null);
  const [daily, setDaily] = useState<DailyBrief | null>(null);
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
  const featured = featuredGame();

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

  useEffect(() => {
    if (!user) return setDaily(null);
    api<DailyBrief>('/daily')
      .then(setDaily)
      .catch(() => setDaily(null));
  }, [user]);

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

  const join = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) return toast('O código tem 6 letras/números', 'error');
    nav(`/sala/${c}`);
  };

  const pick = (gameId: GameId) => {
    setForm((f) => ({ ...f, gameId }));
    const el = document.getElementById('criar');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById(user ? 'room-name' : 'home-nick')?.focus(), 350);
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

  const account = user && !user.isGuest;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-6 lg:pt-6">
      {/* saudação (celular) */}
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        {user ? (
          <Avatar avatar={user.avatar} size={44} />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-ink-800 text-xl">
            👋
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-400">{greeting()}</p>
          <p className="truncate font-display text-lg font-bold text-white">
            {user ? user.nickname : 'Bora jogar?'}
          </p>
        </div>
        {account && me?.progress?.coins !== undefined ? (
          <Link
            to="/loja"
            className="chip border border-pop-amber/30 bg-pop-amber/10 px-3 py-1.5 text-sm text-pop-amber"
          >
            🪙 {me.progress.coins.toLocaleString('pt-BR')}
          </Link>
        ) : (
          <OnlinePill online={online} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* DESTAQUE */}
        <section
          className="card-glow relative order-1 overflow-hidden lg:order-none lg:col-span-8"
          aria-labelledby="hero-title"
        >
          <GameCover id={featured.id} variant="hero" className="absolute inset-0 h-full w-full" />
          <div
            className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-transparent"
            aria-hidden
          />
          <div className="relative grid gap-4 p-5 sm:p-7 md:grid-cols-[1fr_12.5rem]">
            <div className="flex min-h-[15rem] flex-col justify-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-violet-600 text-[10px] uppercase tracking-wider text-white">
                  Em destaque hoje
                </span>
                <span className="hidden lg:inline-flex">
                  <OnlinePill online={online} />
                </span>
              </div>
              <h1
                id="hero-title"
                className="mt-3 font-display text-4xl font-bold uppercase italic leading-[0.95] sm:text-5xl"
              >
                <TwoTone text={featured.name} />
              </h1>
              <p className="mt-2 text-sm font-semibold text-ink-200">
                {featured.minPlayers}–{featured.maxPlayers} jogadores
                {featured.bots && ' · tem bots'}
              </p>
              <p className="mt-2 max-w-sm text-sm text-ink-400">{featured.tagline}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => pick(featured.id)}
                  className="btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
                >
                  <Icon name="play" size={16} fill /> Criar sala
                </button>
                <Link
                  to={`/jogos/${guideById(featured.id)?.slug ?? featured.id}`}
                  className="rounded-xl border border-ink-600 bg-ink-900/60 px-4 py-2.5 text-sm font-bold text-white hover:border-lime-400"
                >
                  Como jogar
                </Link>
              </div>
            </div>
            <DailyRing daily={daily} account={Boolean(account)} />
          </div>
        </section>

        {/* CRIAR SALA */}
        <form
          onSubmit={create}
          id="criar"
          className="card order-3 scroll-mt-24 p-5 lg:order-none lg:col-span-4 lg:row-span-2"
          aria-labelledby="create-title"
        >
          <p className="eyebrow">Nova partida</p>
          <h2 id="create-title" className="mt-1 text-2xl">
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
                  <Avatar avatar={avatar} size={52} />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-lime-400 text-xs text-night">
                    ✎
                  </span>
                </button>
                <p className="text-sm text-ink-400">
                  {editAvatar ? 'Monte seu personagem:' : 'Toque no avatar para personalizar'}
                </p>
              </div>
              {editAvatar && (
                <div className="mb-4 rounded-2xl bg-ink-950/60 p-3">
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
          <label htmlFor="room-game" className="label mt-4">
            Jogo
          </label>
          <div className="flex items-center gap-2">
            <GameIcon id={form.gameId} small />
            <select
              id="room-game"
              className="input"
              value={form.gameId}
              onChange={(e) => setForm({ ...form, gameId: e.target.value as GameId })}
            >
              {AVAILABLE.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
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
            <div>
              <label htmlFor="room-pass" className="label">
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
                  className={`cursor-pointer rounded-xl border px-3 py-2 transition ${form.isPublic === o.v ? 'border-lime-400 bg-violet-600/15' : 'border-ink-600 hover:border-ink-400'}`}
                >
                  <input
                    type="radio"
                    name="vis"
                    className="sr-only"
                    checked={form.isPublic === o.v}
                    onChange={() => setForm({ ...form, isPublic: o.v })}
                  />
                  <span className="block text-sm font-bold text-white">{o.t}</span>
                  <span className="text-xs text-ink-400">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button className="mt-5 w-full" size="lg" disabled={busy}>
            {busy ? 'Criando…' : 'Criar e convidar'}
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
            <span className="h-px flex-1 bg-ink-700" /> ou entre numa sala{' '}
            <span className="h-px flex-1 bg-ink-700" />
          </div>
          <div className="flex gap-2" role="group" aria-label="Entrar com código">
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
              onKeyDown={(e) => e.key === 'Enter' && void join(e)}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={code.length !== 6}
              onClick={(e) => void join(e)}
            >
              Entrar
            </Button>
          </div>
        </form>

        {/* PROGRESSO */}
        <PlayerPanel me={me} daily={daily} className="order-2 lg:order-none lg:col-span-8" />
      </div>

      <AndroidAppLink className="mt-4 lg:hidden" />

      {/* COLEÇÃO */}
      <section aria-labelledby="games-title" className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Coleção</p>
            <h2 id="games-title" className="text-2xl">
              Jogos
            </h2>
          </div>
          <Link to="/jogos" className="text-sm font-bold text-lime-400 hover:underline">
            Ver todos ({AVAILABLE.length}) ›
          </Link>
        </div>
        <ul className="scrollbar-none -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {AVAILABLE.map((g) => (
            <li
              key={g.id}
              className="card group w-56 shrink-0 snap-start overflow-hidden transition hover:-translate-y-0.5 hover:border-lime-400/50 sm:w-auto"
            >
              <div className="relative h-28 overflow-hidden">
                <GameCover id={g.id} className="h-full w-full transition group-hover:scale-105" />
                {g.bots && (
                  <span className="chip absolute left-2 top-2 bg-ink-950/80 text-[10px] text-ink-200">
                    🤖 bots
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base">
                      <Link
                        to={`/jogos/${guideById(g.id)?.slug ?? g.id}`}
                        className="hover:underline"
                      >
                        {g.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-ink-400">
                      {g.minPlayers}–{g.maxPlayers} jogadores
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => pick(g.id)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600/25 text-lime-300 transition hover:bg-violet-600 hover:text-white"
                    aria-label={`Criar sala de ${g.name}`}
                    title="Criar sala"
                  >
                    <Icon name="play" size={15} fill />
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-ink-200">{g.tagline}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <Goals me={me} daily={daily} className="lg:col-span-7" />
        <RecentAchievements me={me} className="lg:col-span-5" />
      </div>

      {/* SALAS AO VIVO */}
      <section aria-labelledby="rooms-title" className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Ao vivo</p>
            <h2 id="rooms-title" className="text-2xl">
              Salas públicas
            </h2>
          </div>
          <Link to="/salas" className="text-sm font-bold text-lime-400 hover:underline">
            Ver todas ›
          </Link>
        </div>
        <LiveRooms rooms={rooms} />
      </section>
    </div>
  );
}

function OnlinePill({ online }: { online: number | null }) {
  return (
    <span className="chip border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
      {online === null ? 'conectando…' : `${online} jogando agora`}
    </span>
  );
}

/** Primeira palavra branca, o resto em violeta (como o título do banner de referência). */
function TwoTone({ text }: { text: string }) {
  const [first, ...rest] = text.split(' ');
  const grad = 'bg-gradient-to-r from-lime-300 to-violet-500 bg-clip-text pr-1 text-transparent';
  if (!rest.length) return <span className={grad}>{first}</span>;
  return (
    <>
      <span className="text-white">{first}</span>
      <br />
      <span className={grad}>{rest.join(' ')}</span>
    </>
  );
}

function Ring({ value, size = 104, label }: { value: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c4b1ff" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgb(var(--ink-700))"
          strokeWidth="9"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-g)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-xl font-bold text-white">
        {label}
      </span>
    </div>
  );
}

function DailyRing({ daily, account }: { daily: DailyBrief | null; account: boolean }) {
  const parts = [
    { label: 'Quiz', done: Boolean(daily?.quiz.done) },
    { label: 'Adedonha', done: Boolean(daily?.stop.done) },
    { label: 'Termo', done: Boolean(daily?.termoDone) },
  ];
  const done = parts.filter((p) => p.done).length;
  return (
    <Link
      to="/desafio"
      className="hidden flex-col rounded-2xl border border-ink-700/80 bg-ink-950/70 p-4 backdrop-blur transition hover:border-lime-400/60 md:flex"
    >
      <p className="eyebrow !text-[10px]">Desafio do dia</p>
      <p className="mt-0.5 font-display text-sm font-bold uppercase text-white">
        {done === 3 ? 'Completo!' : `${3 - done} para fazer`}
      </p>
      <div className="mx-auto my-3">
        <Ring value={done / 3} label={`${done}/3`} />
      </div>
      <ul className="space-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between">
            <span className={p.done ? 'text-white' : 'text-ink-400'}>{p.label}</span>
            <span className={p.done ? 'text-lime-300' : 'text-ink-600'}>{p.done ? '✓' : '○'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 border-t border-ink-700 pt-2 text-xs text-ink-400">
        <Icon name="flame" size={14} className="text-pop-orange" />
        {account
          ? `${daily?.streak ?? 0} ${daily?.streak === 1 ? 'dia seguido' : 'dias seguidos'}`
          : 'Crie conta para pontuar'}
      </p>
    </Link>
  );
}

/** Dias da semana atual (segunda a domingo), no formato AAAA-MM-DD do horário de Brasília. */
function weekDays(today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return Array.from({ length: 7 }, (_, i) =>
    new Date(d.getTime() + (i - dow) * 86400_000).toISOString().slice(0, 10),
  );
}

function PlayerPanel({
  me,
  daily,
  className,
}: {
  me: MyProfile | null;
  daily: DailyBrief | null;
  className?: string;
}) {
  const { user } = useSession();
  if (!user || user.isGuest)
    return (
      <section className={`card relative overflow-hidden p-5 ${className}`}>
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-violet-600/30 blur-3xl"
          aria-hidden
        />
        <p className="eyebrow">Seu progresso</p>
        <h2 className="mt-1 text-xl">Suba de nível jogando com a galera</h2>
        <p className="mt-2 max-w-lg text-sm text-ink-400">
          Com uma conta grátis você ganha XP e moedas em cada partida, desbloqueia conquistas, entra
          no ranking e no torneio da semana e mantém a sequência do desafio do dia.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/entrar?modo=cadastro"
            className="btn-violet rounded-xl px-5 py-2.5 text-sm font-bold"
          >
            Criar conta grátis
          </Link>
          <Link
            to="/entrar"
            className="rounded-xl border border-ink-600 px-5 py-2.5 text-sm font-bold text-white hover:border-lime-400"
          >
            Já tenho conta
          </Link>
        </div>
      </section>
    );
  const p = me?.progress;
  const s = me?.stats;
  const lvl = p ? levelInfo(p.xp) : null;
  const today = daily?.day ?? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const days = new Set(daily?.recentDays ?? []);
  const week = weekDays(today);
  const tiles = [
    { label: 'Partidas', value: s?.matchesPlayed ?? 0, icon: '🎮' },
    { label: 'Vitórias', value: s?.wins ?? 0, icon: '🏆' },
    { label: 'Conquistas', value: p?.achievements.length ?? 0, icon: '🎖️' },
    { label: 'Pontos', value: s?.totalScore ?? 0, icon: '⭐' },
  ];
  return (
    <section
      className={`card relative overflow-hidden p-5 ${className}`}
      aria-label="Seu progresso"
    >
      <svg
        className="pointer-events-none absolute right-0 top-0 h-28 w-2/3 opacity-60"
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M0 ${70 - i * 8} C 60 ${20 + i * 10}, 110 ${90 - i * 6}, 170 ${45 + i * 4} S 260 ${10 + i * 12}, 300 ${40 + i * 6}`}
            stroke="#8b5cf6"
            strokeOpacity={0.5 - i * 0.12}
            strokeWidth="1.5"
            fill="none"
          />
        ))}
      </svg>
      <div className="relative flex flex-wrap items-center gap-4">
        <Link
          to="/perfil"
          className="rounded-full bg-gradient-to-br from-lime-300 to-violet-700 p-[3px]"
        >
          <span className="block rounded-full bg-ink-900 p-0.5">
            <Avatar avatar={user.avatar} size={64} />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold text-white">
            <NameTag nickname={user.nickname} avatar={user.avatar} />
          </p>
          {lvl ? (
            <>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                <span className="font-bold text-lime-300">Nível {lvl.level}</span>
                <span>
                  {p!.xp - lvl.base}/{lvl.next - lvl.base} XP
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full bg-lime-400"
                  style={{ width: `${Math.round(lvl.progress * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-400">Carregando seu progresso…</p>
          )}
        </div>
        {p?.coins !== undefined && (
          <Link
            to="/loja"
            className="chip hidden border border-pop-amber/30 bg-pop-amber/10 px-3 py-1.5 text-sm text-pop-amber lg:inline-flex"
          >
            🪙 {p.coins.toLocaleString('pt-BR')}
          </Link>
        )}
      </div>
      <dl className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-ink-400">
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold text-white">
              {t.value.toLocaleString('pt-BR')}
            </dd>
          </div>
        ))}
      </dl>
      <div className="relative mt-3 rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Sequência do desafio</p>
          <Link to="/desafio" className="text-xs font-bold text-lime-400 hover:underline">
            {daily?.streak ?? 0} 🔥
          </Link>
        </div>
        <ol className="mt-2 grid grid-cols-7 gap-1 text-center" aria-label="Desafios desta semana">
          {week.map((d, i) => {
            const done = days.has(d);
            const isToday = d === today;
            return (
              <li key={d} className="flex flex-col items-center gap-1">
                <span
                  className={`text-[11px] font-bold ${isToday ? 'text-white' : 'text-ink-400'}`}
                >
                  {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][i]}
                </span>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs ${
                    done
                      ? 'bg-lime-400 text-night'
                      : isToday
                        ? 'border-2 border-dashed border-lime-400/60 text-ink-400'
                        : 'bg-ink-800 text-ink-600'
                  }`}
                  aria-label={`${done ? 'feito' : 'não feito'}${isToday ? ' (hoje)' : ''}`}
                >
                  {done ? '✓' : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Goals({
  me,
  daily,
  className,
}: {
  me: MyProfile | null;
  daily: DailyBrief | null;
  className?: string;
}) {
  const s = me?.stats;
  const p = me?.progress;
  const goals = [
    {
      icon: '🎖️',
      name: 'Veterano',
      desc: 'Jogue 50 partidas',
      value: s?.matchesPlayed ?? 0,
      max: 50,
      color: '#5cc8ff',
    },
    {
      icon: '🏆',
      name: 'Colecionador',
      desc: 'Vença 10 partidas',
      value: s?.wins ?? 0,
      max: 10,
      color: '#ffc23d',
    },
    {
      icon: '🔥',
      name: 'Sem falhar',
      desc: '7 dias de desafio',
      value: daily?.streak ?? 0,
      max: 7,
      color: '#ff9a3d',
    },
    {
      icon: '💎',
      name: 'Lenda',
      desc: 'Todas as conquistas',
      value: p?.achievements.length ?? 0,
      max: ACHIEVEMENTS.length,
      color: '#a585ff',
    },
  ];
  return (
    <section className={`card p-5 ${className}`} aria-labelledby="goals-title">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Metas</p>
          <h2 id="goals-title" className="text-xl">
            Em andamento
          </h2>
        </div>
        <Link to="/perfil" className="text-xs font-bold text-lime-400 hover:underline">
          Ver perfil ›
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {goals.map((g) => {
          const pct = Math.min(1, g.value / g.max);
          return (
            <li
              key={g.name}
              className="flex flex-col items-center rounded-xl border border-ink-700/70 bg-ink-950/50 p-3 text-center"
            >
              <Hex color={g.color}>{g.icon}</Hex>
              <p className="mt-2 font-display text-xs font-bold uppercase tracking-wide text-white">
                {g.name}
              </p>
              <p className="text-[11px] text-ink-400">{g.desc}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct * 100}%`, background: g.color }}
                />
              </div>
              <p className="mt-1 text-[11px] font-bold text-ink-200">
                {Math.min(g.value, g.max)} / {g.max}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Emblema hexagonal com brilho na cor da conquista. */
function Hex({ color, children, dim = false }: { color: string; children: string; dim?: boolean }) {
  return (
    <span
      className={`relative grid h-14 w-14 place-items-center ${dim ? 'opacity-35 grayscale' : ''}`}
    >
      <svg viewBox="0 0 56 56" className="absolute inset-0" aria-hidden>
        <path
          d="M28 3l22 12.5v25L28 53 6 40.5v-25z"
          fill={`${color}22`}
          stroke={color}
          strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <span className="relative text-2xl" aria-hidden>
        {children}
      </span>
    </span>
  );
}

const HEX_COLORS = ['#5cc8ff', '#ffc23d', '#3ee0c0', '#a585ff', '#ff5c5c', '#ff8fc8'];

function RecentAchievements({ me, className }: { me: MyProfile | null; className?: string }) {
  const unlocked = [...(me?.progress?.achievements ?? [])].sort((a, b) =>
    b.unlockedAt.localeCompare(a.unlockedAt),
  );
  const got = unlocked
    .map((u) => ACHIEVEMENTS.find((a) => a.code === u.code))
    .filter((a): a is (typeof ACHIEVEMENTS)[number] => Boolean(a));
  const show = got.length
    ? got.slice(0, 5).map((a) => ({ a, dim: false }))
    : ACHIEVEMENTS.slice(0, 5).map((a) => ({ a, dim: true }));
  return (
    <section className={`card p-5 ${className}`} aria-labelledby="ach-title">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Conquistas</p>
          <h2 id="ach-title" className="text-xl">
            {got.length ? 'Recentes' : 'Para desbloquear'}
          </h2>
        </div>
        <span className="text-xs text-ink-400">
          {got.length}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <ul className="mt-4 grid grid-cols-5 gap-1">
        {show.map(({ a, dim }, i) => (
          <li key={a.code} className="flex flex-col items-center text-center" title={a.description}>
            <Hex color={HEX_COLORS[i % HEX_COLORS.length]!} dim={dim}>
              {a.icon}
            </Hex>
            <p className="mt-1.5 line-clamp-2 text-[10px] font-bold uppercase leading-tight text-ink-200">
              {a.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LiveRooms({ rooms }: { rooms: RoomSummary[] | null }) {
  const nav = useNavigate();
  if (rooms === null)
    return (
      <p className="card mt-4 p-5 text-ink-400" role="status">
        Carregando salas…
      </p>
    );
  if (!rooms.length)
    return (
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-ink-400">
          Nenhuma sala pública aberta agora. Crie uma e marque como pública!
        </p>
        <a href="#criar" className="btn-violet rounded-xl px-4 py-2 text-sm font-bold">
          Criar sala
        </a>
      </div>
    );
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {rooms.slice(0, 6).map((r) => (
        <li key={r.code} className="card flex items-center gap-3 overflow-hidden p-3">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl">
            <GameCover id={r.gameId} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">
              {r.hasPassword && <span aria-label="com senha">🔒 </span>}
              {r.name}
            </p>
            <p className="text-xs text-ink-400">
              {GAME_CATALOG.find((g) => g.id === r.gameId)?.name} ·{' '}
              {r.phase === 'playing' ? 'em partida' : 'no lobby'}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                <div
                  className="h-full rounded-full bg-lime-400"
                  style={{ width: `${Math.min(100, (r.players / r.maxPlayers) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-ink-200">
                {r.players}/{r.maxPlayers}
              </span>
            </div>
          </div>
          <button
            onClick={() => nav(`/sala/${r.code}`)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-white hover:bg-violet-500"
            aria-label={`Entrar na sala ${r.name}`}
          >
            <Icon name="play" size={15} fill />
          </button>
        </li>
      ))}
    </ul>
  );
}
