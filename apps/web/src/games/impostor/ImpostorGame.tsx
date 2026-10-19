import { EVENTS, type ImpostorView, type PublicRoom } from '@partyverse/shared';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { actionId, emitAck } from '../../lib/socket';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';

type Props = { view: ImpostorView; room: PublicRoom; myId: string };

const REASON_TEXT: Record<NonNullable<ImpostorView['outcome']>['reason'], string> = {
  caught: 'O impostor foi pego!',
  escaped: 'O impostor escapou!',
  guessed: 'O impostor descobriu o local!',
  'wrong-guess': 'O impostor chutou errado!',
};

export function ImpostorGame({ view, room, myId }: Props) {
  const toast = useToast();
  const left = useCountdown(view.deadline);
  const isPlayer = view.participants.includes(myId);
  const send = (action: unknown) =>
    emitAck(EVENTS.GAME_ACTION, { action, actionId: actionId() }).catch((e: Error) =>
      toast(e.message, 'error'),
    );
  const player = (id: string) => room.players.find((p) => p.id === id);
  const nick = (id: string) => player(id)?.nickname ?? 'Alguém';
  const avatar = (id: string) => player(id)?.avatar ?? 'blob-1';

  useTickSound(left, view.phase === 'discussion' || view.phase === 'voting');
  useSoundOnChange(`${view.round}-${view.phase}`, () => {
    if (view.phase === 'reveal') return 'reveal';
    if (view.phase === 'voting') return 'stop';
    if (view.phase === 'round-results' && view.outcome) {
      const iAmImpostor = view.outcome.impostorId === myId;
      const impostorWon = view.outcome.reason === 'escaped' || view.outcome.reason === 'guessed';
      return iAmImpostor === impostorWon ? 'correct' : 'wrong';
    }
    return null;
  });

  const title = {
    reveal: 'Confira sua carta',
    discussion: 'Perguntem uns aos outros',
    voting: 'Quem é o impostor?',
    'round-results': view.outcome ? REASON_TEXT[view.outcome.reason] : 'Resultado',
    finished: 'Fim de jogo',
  }[view.phase];

  return (
    <div className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-3xl border-4 border-ink-950 bg-pop-rose font-display text-3xl font-extrabold text-ink-950 shadow-chunky">
          {view.round}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Rodada {view.round} de {view.totalRounds}
          </p>
          <p className="font-display text-2xl font-extrabold text-white">{title}</p>
        </div>
        {view.deadline && view.phase !== 'finished' && (
          <div
            className={`rounded-2xl px-4 py-2 font-display text-3xl font-extrabold tabular-nums ${left <= 10 && view.phase !== 'round-results' ? 'animate-pulse bg-pop-rose text-ink-950' : 'bg-ink-700 text-white'}`}
            role="timer"
            aria-label={`${left} segundos restantes`}
          >
            {formatTime(left)}
          </div>
        )}
      </div>

      {!isPlayer && view.phase !== 'round-results' && view.phase !== 'finished' && (
        <p className="rounded-2xl bg-ink-900 p-3 text-sm text-ink-400">
          Você está assistindo esta rodada. Entra na próxima partida!
        </p>
      )}

      {isPlayer && view.me && view.phase !== 'round-results' && view.phase !== 'finished' && (
        <SecretCard me={view.me} big={view.phase === 'reveal'} />
      )}

      {view.phase === 'reveal' && isPlayer && (
        <ReadyBar
          view={view}
          myId={myId}
          label="Entendi, vamos lá"
          onReady={() => send({ type: 'ready' })}
        />
      )}

      {view.phase === 'discussion' && (
        <Discussion
          view={view}
          myId={myId}
          isPlayer={isPlayer}
          nick={nick}
          avatar={avatar}
          send={send}
        />
      )}

      {view.phase === 'voting' && (
        <Voting
          view={view}
          myId={myId}
          isPlayer={isPlayer}
          nick={nick}
          avatar={avatar}
          send={send}
        />
      )}

      {(view.phase === 'round-results' || view.phase === 'finished') && view.outcome && (
        <Outcome view={view} myId={myId} nick={nick} avatar={avatar} />
      )}

      {view.phase === 'round-results' && isPlayer && (
        <ReadyBar
          view={view}
          myId={myId}
          label={view.round >= view.totalRounds ? 'Ver resultado final' : 'Próxima rodada'}
          onReady={() => send({ type: 'ready' })}
        />
      )}

      {view.me?.isImpostor && (view.phase === 'discussion' || view.phase === 'voting') && (
        <GuessPanel view={view} send={send} />
      )}

      {view.phase !== 'round-results' && view.phase !== 'finished' && (
        <details className="rounded-2xl bg-ink-900 p-3 text-sm">
          <summary className="cursor-pointer font-bold text-ink-200">
            Locais possíveis ({view.locations.length})
          </summary>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {view.locations.map((l) => (
              <li key={l} className="chip bg-ink-700 text-ink-200">
                {l}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const formatTime = (s: number) =>
  s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;

function SecretCard({ me, big }: { me: NonNullable<ImpostorView['me']>; big: boolean }) {
  const [hidden, setHidden] = useState(false);
  const impostor = me.isImpostor;
  return (
    <button
      type="button"
      onClick={() => setHidden((h) => !h)}
      className={`flip-in relative w-full overflow-hidden rounded-3xl border-4 border-ink-950 text-left shadow-chunky transition ${impostor ? 'bg-pop-rose' : 'bg-lime-400'} ${big ? 'p-6 sm:p-8' : 'p-4'}`}
      aria-label={hidden ? 'Mostrar minha carta' : 'Esconder minha carta'}
    >
      {hidden ? (
        <p className="py-2 text-center font-display text-xl font-extrabold text-ink-950">
          Carta escondida · toque para ver
        </p>
      ) : impostor ? (
        <div className="text-ink-950">
          <p className="text-sm font-bold uppercase tracking-widest">Sua carta</p>
          <p className={`font-display font-extrabold ${big ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>
            Você é o impostor!
          </p>
          <p className="mt-1 font-medium">
            Você não sabe o local. Escute, disfarce e tente descobrir onde todos estão.
          </p>
        </div>
      ) : (
        <div className="text-ink-950">
          <p className="text-sm font-bold uppercase tracking-widest">O local é</p>
          <p className={`font-display font-extrabold ${big ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>
            {me.location}
          </p>
          <p className="mt-1 font-medium">
            Seu papel: <strong>{me.role}</strong>. Não entregue o local para o impostor!
          </p>
        </div>
      )}
      <span className="absolute right-3 top-3 rounded-full bg-ink-950/15 px-2 py-0.5 text-xs font-bold text-ink-950">
        {hidden ? 'mostrar' : 'esconder'}
      </span>
    </button>
  );
}

function ReadyBar({
  view,
  myId,
  label,
  onReady,
}: {
  view: ImpostorView;
  myId: string;
  label: string;
  onReady: () => void;
}) {
  const ready = view.readyPlayers.includes(myId);
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink-400">
        {view.readyPlayers.length}/{view.participants.length} prontos
      </p>
      <Button disabled={ready} onClick={onReady}>
        {ready ? 'Aguardando os outros…' : label}
      </Button>
    </div>
  );
}

type Helpers = {
  view: ImpostorView;
  myId: string;
  isPlayer: boolean;
  nick: (id: string) => string;
  avatar: (id: string) => string;
  send: (a: unknown) => Promise<unknown>;
};

function Discussion({ view, myId, isPlayer, nick, avatar, send }: Helpers) {
  const asked = view.callVotePlayers.includes(myId);
  const need = Math.floor(view.participants.length / 2) + 1;
  return (
    <div className="space-y-4">
      {view.firstAsker && (
        <div className="flex items-center gap-3 rounded-2xl bg-ink-900 p-3">
          <Avatar avatar={avatar(view.firstAsker)} size={36} />
          <p className="text-ink-200">
            <strong className="text-white">
              {view.firstAsker === myId ? 'Você' : nick(view.firstAsker)}
            </strong>{' '}
            começa: faça uma pergunta para alguém sobre o local. Quem responde pergunta para o
            próximo.
          </p>
        </div>
      )}
      <ul className="grid gap-1.5 text-sm text-ink-400 sm:grid-cols-2">
        <li>• Perguntas vagas demais denunciam o impostor.</li>
        <li>• Perguntas óbvias demais entregam o local!</li>
        <li>• Conversem por voz ou no chat ao lado.</li>
        <li>• O impostor pode chutar o local a qualquer momento.</li>
      </ul>
      {isPlayer && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-400">
            Pedidos de votação: {view.callVotePlayers.length} (precisa de maioria, ~{need})
          </p>
          <Button
            variant={asked ? 'secondary' : 'primary'}
            onClick={() => send({ type: 'callVote' })}
          >
            {asked ? 'Cancelar pedido' : 'Já sei! Pedir votação'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Voting({ view, myId, isPlayer, nick, avatar, send }: Helpers) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-400">
        {isPlayer
          ? 'Vote em quem você acha que é o impostor. Dá para trocar o voto até o tempo acabar.'
          : 'Os jogadores estão votando…'}{' '}
        ({view.votedPlayers.length}/{view.participants.length} votaram)
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {view.participants.map((p) => {
          const mine = view.myVote === p;
          const self = p === myId;
          return (
            <li key={p}>
              <button
                type="button"
                disabled={!isPlayer || self}
                onClick={() => send({ type: 'vote', targetId: p })}
                aria-pressed={mine}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition disabled:cursor-default disabled:opacity-60 ${mine ? 'border-pop-rose bg-pop-rose/20' : 'border-ink-600 bg-ink-900 enabled:hover:border-ink-400'}`}
              >
                <Avatar avatar={avatar(p)} size={34} />
                <span className="flex-1 truncate font-bold text-white">
                  {nick(p)}
                  {self && ' (você)'}
                </span>
                {view.votedPlayers.includes(p) && (
                  <span className="chip bg-ink-700 text-ink-200">votou</span>
                )}
                {mine && <span className="chip bg-pop-rose text-ink-950">seu voto</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GuessPanel({
  view,
  send,
}: {
  view: ImpostorView;
  send: (a: unknown) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  if (!open)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-pop-rose p-3">
        <p className="text-sm text-ink-200">
          Acha que descobriu o local? Um chute certo vale a rodada — errado, você perde.
        </p>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Chutar o local
        </Button>
      </div>
    );
  return (
    <div className="space-y-3 rounded-2xl border-2 border-pop-rose p-4">
      <p className="font-bold text-white">Qual é o local?</p>
      <div className="flex flex-wrap gap-2">
        {view.locations.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setChoice(l)}
            aria-pressed={choice === l}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition ${choice === l ? 'border-pop-rose bg-pop-rose text-ink-950' : 'border-ink-600 text-ink-200 hover:border-ink-400'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={!choice}
          onClick={() => choice && send({ type: 'guess', location: choice })}
        >
          Confirmar chute
        </Button>
      </div>
    </div>
  );
}

function Outcome({
  view,
  myId,
  nick,
  avatar,
}: {
  view: ImpostorView;
  myId: string;
  nick: (id: string) => string;
  avatar: (id: string) => string;
}) {
  const o = view.outcome!;
  const impostorWon = o.reason === 'escaped' || o.reason === 'guessed';
  const ranking = [...view.participants].sort(
    (a, b) => (view.totals[b] ?? 0) - (view.totals[a] ?? 0),
  );
  return (
    <div className="space-y-4">
      <div
        className={`flip-in flex flex-wrap items-center gap-4 rounded-3xl border-4 border-ink-950 p-5 text-ink-950 shadow-chunky ${impostorWon ? 'bg-pop-rose' : 'bg-lime-400'}`}
      >
        <Avatar avatar={avatar(o.impostorId)} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-widest">O impostor era</p>
          <p className="font-display text-3xl font-extrabold">
            {o.impostorId === myId ? 'Você!' : nick(o.impostorId)}
          </p>
          <p className="font-medium">
            O local era <strong>{o.location}</strong>
            {o.guess && (
              <>
                {' '}
                · chute: <strong>{o.guess}</strong>
              </>
            )}
          </p>
        </div>
      </div>

      {Object.keys(o.votes).length > 0 && (
        <div>
          <p className="label">Votos</p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {Object.entries(o.votes).map(([voter, target]) => (
              <li key={voter} className="flex items-center gap-2 rounded-xl bg-ink-900 px-3 py-1.5">
                <span className="truncate font-bold text-white">{nick(voter)}</span>
                <span className="text-ink-400">→</span>
                <span
                  className={`truncate font-bold ${target === o.impostorId ? 'text-lime-400' : 'text-pop-rose'}`}
                >
                  {nick(target)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {ranking.map((p) => (
          <li key={p} className="flex items-center gap-3 rounded-2xl bg-ink-900 px-3 py-2">
            <Avatar avatar={avatar(p)} size={28} />
            <span className="min-w-0 flex-1 truncate font-bold text-white">
              {nick(p)}
              <span className="block text-xs font-medium text-ink-400">
                {p === o.impostorId ? 'impostor' : (o.roles[p] ?? '')}
              </span>
            </span>
            <span className="text-sm text-lime-400">+{o.roundScores[p] ?? 0}</span>
            <span className="font-display text-xl font-extrabold text-white">
              {view.totals[p] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
