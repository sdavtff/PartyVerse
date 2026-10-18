import {
  EVENTS,
  GAME_CATALOG,
  type GameId,
  type MatchResult,
  type PublicRoom,
  type StopSettings,
  type StopView,
} from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ChatPanel } from '../components/ChatPanel';
import { GameIcon } from '../components/GameIcon';
import { NicknameGate } from '../components/NicknameGate';
import { PlayerList } from '../components/PlayerList';
import { useToast } from '../components/Toast';
import { StopGame } from '../games/stop/StopGame';
import { StopSettingsForm } from '../games/stop/StopSettingsForm';
import { useSession } from '../lib/session';
import { emitAck } from '../lib/socket';
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
  const { room, chat, game, result, status, error, rejoin, leave } = useRoom(code);
  const myId = user!.id;

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
          {room.phase !== 'lobby' && game !== null && room.settings.gameId === 'stop' && (
            <StopGame view={game as StopView} room={room} myId={myId} />
          )}
          {room.phase === 'results' && result && (
            <Results result={result} amHost={amHost} myId={myId} />
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
        <div className="grid gap-3 sm:grid-cols-3">
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
              {Array.from({ length: 15 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
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

      {room.settings.gameId === 'stop' && (
        <StopSettingsForm
          settings={room.gameSettings as unknown as StopSettings}
          editable={amHost}
        />
      )}
      {(['draw', 'charades', 'quiz', 'secretword', 'impostor'] as GameId[]).includes(
        room.settings.gameId,
      ) && <p className="text-ink-400">Este jogo ainda não está disponível.</p>}
    </div>
  );
}

function Results({ result, amHost, myId }: { result: MatchResult; amHost: boolean; myId: string }) {
  const toast = useToast();
  const podium = ['bg-pop-amber', 'bg-ink-200', 'bg-pop-rose'];
  const me = result.ranking.find((r) => r.playerId === myId);
  return (
    <section className="card animate-pop space-y-5 p-5 sm:p-6" aria-labelledby="results-title">
      <div className="text-center">
        <h2 id="results-title" className="text-3xl font-extrabold">
          Fim de jogo!
        </h2>
        {me && (
          <p className="mt-1 text-ink-200">
            Você ficou em <strong className="text-lime-400">{me.place}º lugar</strong> com{' '}
            {me.score} pontos.
          </p>
        )}
      </div>
      <ol className="space-y-2">
        {result.ranking.map((r, i) => (
          <li
            key={r.playerId}
            className="flex animate-rise items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full font-display font-extrabold text-ink-950 ${podium[r.place - 1] ?? 'bg-ink-600 text-white'}`}
            >
              {r.place}
            </span>
            <Avatar avatar={r.avatar} size={34} />
            <span className="flex-1 truncate font-bold text-white">
              {r.nickname}
              {r.playerId === myId && ' (você)'}
            </span>
            <span className="font-display text-2xl font-extrabold text-lime-400">{r.score}</span>
          </li>
        ))}
      </ol>
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
