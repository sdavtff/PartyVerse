import {
  EVENTS,
  GAME_CATALOG,
  type GuessSettings,
  type GuessView,
  type ImpostorSettings,
  type ImpostorView,
  type MatchResult,
  type PublicRoom,
  type QuizSettings,
  type QuizView,
  type StopSettings,
  type StopView,
} from '@partyverse/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ChatPanel } from '../components/ChatPanel';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Confetti } from '../components/Confetti';
import { GameIcon } from '../components/GameIcon';
import { NicknameGate } from '../components/NicknameGate';
import { PlayerList } from '../components/PlayerList';
import { useToast } from '../components/Toast';
import { GuessGame } from '../games/guess/GuessGame';
import { GuessSettingsForm } from '../games/guess/GuessSettingsForm';
import { ImpostorGame } from '../games/impostor/ImpostorGame';
import { ImpostorSettingsForm } from '../games/impostor/ImpostorSettingsForm';
import { QuizGame } from '../games/quiz/QuizGame';
import { QuizSettingsForm } from '../games/quiz/QuizSettingsForm';
import { StopGame } from '../games/stop/StopGame';
import { StopSettingsForm } from '../games/stop/StopSettingsForm';
import { useSession } from '../lib/session';
import { emitAck } from '../lib/socket';
import { sfx } from '../lib/sound';
import { useRoom } from '../lib/useRoom';

export function RoomPage() {
  const { code = '' } = useParams();
  return (
    <NicknameGate title="Você foi convidado! Qual seu apelido?">
      <RoomInner code={code.toUpperCase()} />
    </NicknameGate>
  );
}

function RoomInner({ code }: { code: string }) {
  const { user } = useSession();
  const nav = useNavigate();
  const { room, chat, game, result, status, error, rejoin, leave, onGameEvent } = useRoom(code);
  const myId = user!.id;
  const playerCount = room?.players.length ?? 0;
  const prevCount = useRef(playerCount);
  useEffect(() => {
    if (playerCount > prevCount.current && prevCount.current > 0) sfx('join');
    prevCount.current = playerCount;
  }, [playerCount]);

  if (status === 'kicked')
    return <Notice title="Você foi removido da sala" text="O anfitrião tirou você desta sala." />;
  if (status === 'replaced')
    return (
      <Notice
        title="Sala aberta em outro lugar"
        text={error ?? ''}
        action={<Button onClick={() => rejoin()}>Usar esta aba</Button>}
      />
    );
  if (status === 'password' && !room)
    return <PasswordPrompt code={code} error={error} onSubmit={(p) => void rejoin(p)} />;
  if (status === 'failed' && !room)
    return (
      <Notice
        title="Não deu para entrar"
        text={error ?? 'Erro desconhecido'}
        action={<Button onClick={() => rejoin()}>Tentar de novo</Button>}
      />
    );
  if (!room)
    return (
      <div className="p-16 text-center text-ink-400" role="status">
        Entrando na sala {code}…
      </div>
    );

  const amHost = room.hostId === myId;
  const exit = async () => {
    await leave();
    nav('/');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {status === 'reconnecting' && <ReconnectBanner />}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <GameIcon id={room.settings.gameId} small />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{room.settings.name}</h1>
          <p className="text-sm text-ink-400">
            {GAME_CATALOG.find((g) => g.id === room.settings.gameId)?.name} ·{' '}
            {room.settings.isPublic ? 'pública' : 'privada'}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <ShareCode code={room.code} />
          <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={exit}>
            Sair da sala
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          {room.phase === 'lobby' && <Lobby room={room} amHost={amHost} />}
          {room.phase === 'results' && result && (
            <Results result={result} amHost={amHost} myId={myId} />
          )}
          {room.phase !== 'lobby' && game !== null && (
            <GameScreen
              gameId={room.settings.gameId}
              game={game}
              room={room}
              myId={myId}
              subscribe={onGameEvent}
            />
          )}
          {room.phase === 'playing' && amHost && (
            <div className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  confirm('Encerrar a partida para todos?') &&
                  emitAck(EVENTS.ROOM_END).catch(() => undefined)
                }
              >
                Encerrar partida
              </Button>
            </div>
          )}
        </div>
        <aside className="flex flex-col gap-5">
          <PlayerList room={room} myId={myId} showScores={room.phase !== 'lobby'} />
          <div className="h-[24rem] lg:flex-1">
            <ChatPanel messages={chat} myId={myId} disabled={status !== 'online'} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function GameScreen({
  gameId,
  game,
  room,
  myId,
  subscribe,
}: {
  gameId: PublicRoom['settings']['gameId'];
  game: unknown;
  room: PublicRoom;
  myId: string;
  subscribe: (fn: (ev: unknown) => void) => () => void;
}) {
  switch (gameId) {
    case 'draw':
    case 'charades':
    case 'secretword':
      return <GuessGame view={game as GuessView} room={room} myId={myId} subscribe={subscribe} />;
    case 'stop':
      return <StopGame view={game as StopView} room={room} myId={myId} />;
    case 'impostor':
      return <ImpostorGame view={game as ImpostorView} room={room} myId={myId} />;
    case 'quiz':
      return <QuizGame view={game as QuizView} room={room} myId={myId} />;
    default:
      return null;
  }
}

function ShareCode({ code }: { code: string }) {
  const toast = useToast();
  const link = `${location.origin}/sala/${code}`;
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg, 'success');
    } catch {
      toast(`Copie manualmente: ${text}`);
    }
  };
  return (
    <div className="flex items-center gap-1 rounded-2xl border-2 border-dashed border-ink-600 p-1 pl-3">
      <span
        className="font-display text-xl font-extrabold tracking-[0.25em] text-lime-400"
        aria-label={`Código ${code.split('').join(' ')}`}
      >
        {code}
      </span>
      <button
        className="rounded-xl px-2.5 py-1.5 text-sm font-bold hover:bg-ink-700"
        onClick={() => copy(code, 'Código copiado!')}
      >
        Copiar
      </button>
      <button
        className="rounded-xl bg-ink-700 px-2.5 py-1.5 text-sm font-bold text-white hover:bg-ink-600"
        onClick={() => copy(link, 'Link de convite copiado!')}
      >
        Link
      </button>
    </div>
  );
}

function Lobby({ room, amHost }: { room: PublicRoom; amHost: boolean }) {
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const online = room.players.filter((p) => p.status === 'online').length;
  const meta = GAME_CATALOG.find((g) => g.id === room.settings.gameId)!;
  const saveRoom = (r: Partial<PublicRoom['settings']>) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { room: r }).catch((e) => toast(e.message, 'error'));

  const start = async () => {
    setStarting(true);
    try {
      await emitAck(EVENTS.ROOM_START);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="card space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">Lobby</h2>
          <p className="text-sm text-ink-400">
            {amHost
              ? 'Você é o anfitrião: ajuste as regras e comece quando todos chegarem.'
              : 'Aguardando o anfitrião começar…'}
          </p>
        </div>
        {amHost ? (
          <Button size="lg" onClick={start} disabled={starting || online < meta.minPlayers}>
            {online < meta.minPlayers
              ? `Mínimo ${meta.minPlayers} jogadores`
              : starting
                ? 'Começando…'
                : 'Começar partida'}
          </Button>
        ) : (
          <span className="chip animate-pulse bg-ink-700 px-4 py-2 text-sm text-ink-200">
            esperando…
          </span>
        )}
      </div>

      {amHost && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-1">
            <span className="label">Nome da sala</span>
            <input
              className="input py-2"
              maxLength={40}
              defaultValue={room.settings.name}
              onBlur={(e) =>
                e.target.value.trim().length >= 2 &&
                e.target.value !== room.settings.name &&
                saveRoom({ name: e.target.value })
              }
            />
          </label>
          <label className="block">
            <span className="label">Máx. jogadores</span>
            <select
              className="input py-2"
              value={room.settings.maxPlayers}
              onChange={(e) => saveRoom({ maxPlayers: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 25, 30, 40, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <PasswordField room={room} />
          <label className="block">
            <span className="label">Visibilidade</span>
            <select
              className="input py-2"
              value={room.settings.isPublic ? '1' : '0'}
              onChange={(e) => saveRoom({ isPublic: e.target.value === '1' })}
            >
              <option value="0">Privada</option>
              <option value="1">Pública</option>
            </select>
          </label>
        </div>
      )}

      <GamePicker room={room} amHost={amHost} onPick={(gameId) => saveRoom({ gameId })} />

      {room.settings.gameId === 'stop' && (
        <StopSettingsForm
          settings={room.gameSettings as unknown as StopSettings}
          editable={amHost}
        />
      )}
      {room.settings.gameId === 'impostor' && (
        <ImpostorSettingsForm
          settings={room.gameSettings as unknown as ImpostorSettings}
          editable={amHost}
        />
      )}
      {(room.settings.gameId === 'draw' ||
        room.settings.gameId === 'charades' ||
        room.settings.gameId === 'secretword') && (
        <GuessSettingsForm
          gameId={room.settings.gameId}
          settings={room.gameSettings as unknown as GuessSettings}
          editable={amHost}
        />
      )}
      {room.settings.gameId === 'quiz' && (
        <QuizSettingsForm
          settings={room.gameSettings as unknown as QuizSettings}
          editable={amHost}
        />
      )}
    </div>
  );
}

function PasswordField({ room }: { room: PublicRoom }) {
  const toast = useToast();
  return (
    <label className="block">
      <span className="label">Senha {room.password ? '🔒' : ''}</span>
      <input
        className="input py-2"
        maxLength={20}
        defaultValue={room.password ?? ''}
        key={room.password ?? ''}
        placeholder="sem senha"
        autoComplete="off"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (room.password ?? ''))
            emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { password: v })
              .then(() => toast(v ? 'Senha definida' : 'Senha removida', 'success'))
              .catch((err) => toast(err.message, 'error'));
        }}
      />
    </label>
  );
}

function PasswordPrompt({
  code,
  error,
  onSubmit,
}: {
  code: string;
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  const [pass, setPass] = useState('');
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form
        className="card animate-pop space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (pass.trim()) onSubmit(pass.trim());
        }}
      >
        <div className="text-center text-5xl" aria-hidden>
          🔒
        </div>
        <h1 className="text-center text-2xl font-extrabold">Sala {code} tem senha</h1>
        {error && error !== 'Esta sala tem senha' && (
          <p role="alert" className="text-center text-sm text-pop-rose">
            {error}
          </p>
        )}
        <label htmlFor="room-password" className="sr-only">
          Senha da sala
        </label>
        <input
          id="room-password"
          className="input text-center"
          autoFocus
          maxLength={20}
          placeholder="Digite a senha"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <Button className="w-full" size="lg" disabled={!pass.trim()}>
          Entrar
        </Button>
      </form>
    </div>
  );
}

function GamePicker({
  room,
  amHost,
  onPick,
}: {
  room: PublicRoom;
  amHost: boolean;
  onPick: (id: PublicRoom['settings']['gameId']) => void;
}) {
  const games = GAME_CATALOG.filter((g) => g.available);
  return (
    <fieldset>
      <legend className="label">Jogo</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {games.map((g) => {
          const on = g.id === room.settings.gameId;
          return (
            <button
              key={g.id}
              type="button"
              disabled={!amHost}
              aria-pressed={on}
              onClick={() => !on && onPick(g.id)}
              className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition disabled:cursor-default ${on ? 'border-lime-400 bg-ink-700' : 'border-ink-600 enabled:hover:border-ink-400'} ${!amHost && !on ? 'opacity-50' : ''}`}
            >
              <GameIcon id={g.id} small />
              <span className="min-w-0">
                <span className="block font-bold text-white">{g.name}</span>
                <span className="block text-xs text-ink-400">{g.minPlayers}+ jogadores</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pódio animado: os blocos sobem, os avatares caem no lugar e o campeão ganha coroa. */
function Podium({ ranking, myId }: { ranking: MatchResult['ranking']; myId: string }) {
  const top = ranking.slice(0, 3);
  // ordem visual: 2º, 1º, 3º
  const slots = [top[1], top[0], top[2]];
  const style = [
    { h: 'h-24', color: 'bg-ink-200', delay: 300, label: '2º' },
    { h: 'h-36', color: 'bg-pop-amber', delay: 700, label: '1º' },
    { h: 'h-16', color: 'bg-pop-rose', delay: 0, label: '3º' },
  ];
  return (
    <div className="mx-auto grid max-w-md grid-cols-3 items-end gap-2 pt-6" aria-label="Pódio">
      {slots.map((r, i) => {
        const st = style[i]!;
        if (!r) return <div key={i} />;
        const first = i === 1;
        return (
          <div key={r.playerId} className="flex flex-col items-center text-center">
            <div className="drop-in relative" style={{ animationDelay: `${st.delay + 350}ms` }}>
              {first && (
                <span
                  className="absolute -top-6 left-1/2 -translate-x-1/2 animate-wobble text-2xl"
                  aria-hidden
                >
                  👑
                </span>
              )}
              <div className={`rounded-full ${first ? 'ring-4 ring-pop-amber' : ''}`}>
                <Avatar avatar={r.avatar} size={first ? 72 : 56} />
              </div>
            </div>
            <p
              className="drop-in mt-1 w-full truncate text-sm font-bold text-white"
              style={{ animationDelay: `${st.delay + 450}ms` }}
            >
              {r.nickname}
              {r.playerId === myId && ' (você)'}
            </p>
            <p
              className="drop-in font-display text-xl font-extrabold text-lime-400"
              style={{ animationDelay: `${st.delay + 500}ms` }}
            >
              <AnimatedNumber value={r.score} ms={1200} />
            </p>
            <div
              className={`podium-rise mt-1 grid w-full place-items-start justify-center rounded-t-2xl border-4 border-b-0 border-ink-950 pt-2 font-display text-3xl font-extrabold text-ink-950 ${st.h} ${st.color} ${first ? 'shine' : ''}`}
              style={{ animationDelay: `${st.delay}ms` }}
            >
              {r.place}º
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Results({ result, amHost, myId }: { result: MatchResult; amHost: boolean; myId: string }) {
  const toast = useToast();
  const me = result.ranking.find((r) => r.playerId === myId);
  const won = me?.place === 1;
  useEffect(() => {
    if (me) sfx(won ? 'win' : 'lose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.endedAt]);
  return (
    <section className="card animate-pop space-y-5 p-5 sm:p-6" aria-labelledby="results-title">
      {won && <Confetti key={result.endedAt} />}
      <div className="text-center">
        <h2 id="results-title" className="text-3xl font-extrabold">
          {won ? 'Você venceu!' : 'Fim de jogo!'}
        </h2>
        {me && (
          <p className="mt-1 text-ink-200">
            Você ficou em <strong className="text-lime-400">{me.place}º lugar</strong> com{' '}
            {me.score} pontos.
          </p>
        )}
      </div>
      <Podium ranking={result.ranking} myId={myId} />
      {result.ranking.length > 3 && (
        <ol className="space-y-2" aria-label="Demais colocados">
          {result.ranking.slice(3).map((r, i) => (
            <li
              key={r.playerId}
              className={`flex animate-rise items-center gap-3 rounded-2xl px-4 py-2.5 ${r.playerId === myId ? 'bg-lime-400/10 ring-2 ring-lime-400/50' : 'bg-ink-900'}`}
              style={{ animationDelay: `${1200 + i * 70}ms` }}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 font-display font-extrabold text-white">
                {r.place}
              </span>
              <Avatar avatar={r.avatar} size={32} />
              <span className="flex-1 truncate font-bold text-white">
                {r.nickname}
                {r.playerId === myId && ' (você)'}
              </span>
              <span className="font-display text-xl font-extrabold text-lime-400">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
      {amHost ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={() => emitAck(EVENTS.ROOM_START).catch((e) => toast(e.message, 'error'))}
          >
            Jogar novamente
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              emitAck(EVENTS.ROOM_BACK_TO_LOBBY).catch((e) => toast(e.message, 'error'))
            }
          >
            Mudar regras
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-400">O anfitrião decide se joga de novo.</p>
      )}
    </section>
  );
}

function ReconnectBanner() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-16 z-40 mx-auto w-fit animate-pop rounded-2xl border-2 border-pop-amber bg-ink-800 px-4 py-2 font-bold text-pop-amber shadow-chunky"
    >
      Conexão perdida — reconectando{'.'.repeat((secs % 3) + 1)}{' '}
      {secs > 8 && 'Verifique sua internet.'}
    </div>
  );
}

export function Notice({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: JSX.Element;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="card animate-pop p-8">
        <svg width="72" height="72" viewBox="0 0 64 64" className="mx-auto" aria-hidden>
          <circle cx="32" cy="34" r="22" fill="#ff7a6b" stroke="#0f0b17" strokeWidth="4" />
          <circle cx="25" cy="31" r="4" fill="#0f0b17" />
          <circle cx="39" cy="31" r="4" fill="#0f0b17" />
          <path
            d="M24 45q8-6 16 0"
            stroke="#0f0b17"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-ink-200">{text}</p>
        <div className="mt-6 flex justify-center gap-3">
          {action}
          <Link
            to="/"
            className="rounded-2xl bg-ink-700 px-4 py-2.5 font-bold text-white hover:bg-ink-600"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
