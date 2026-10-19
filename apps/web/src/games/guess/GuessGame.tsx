import { EVENTS, type GuessView, type PublicRoom } from '@partyverse/shared';
import { useState, type FormEvent } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { actionId, emitAck } from '../../lib/socket';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { DrawingBoard } from './DrawingBoard';

const VERB = {
  draw: { doing: 'está desenhando', you: 'Desenhe', pick: 'Escolha o que desenhar' },
  charades: { doing: 'está fazendo mímica', you: 'Faça a mímica de', pick: 'Escolha o que imitar' },
  secretword: { doing: 'está dando dicas', you: 'Dê dicas de', pick: 'Escolha a palavra secreta' },
};

export function GuessGame({
  view,
  room,
  myId,
  subscribe,
}: {
  view: GuessView;
  room: PublicRoom;
  myId: string;
  subscribe: (fn: (ev: unknown) => void) => () => void;
}) {
  const toast = useToast();
  const left = useCountdown(view.deadline);
  const isPlayer = view.participants.includes(myId);
  const mine = view.currentId === myId;
  const iGuessed = view.guessed.some((g) => g.id === myId);
  const player = (id: string | null) => room.players.find((p) => p.id === id);
  const nick = (id: string | null) => player(id)?.nickname ?? 'Alguém';
  const avatar = (id: string | null) => player(id)?.avatar ?? 'blob-1';
  const send = (action: unknown) =>
    emitAck(EVENTS.GAME_ACTION, { action, actionId: actionId() }).catch((e: Error) =>
      toast(e.message, 'error'),
    );
  const v = VERB[view.variant];

  useTickSound(left, view.phase === 'playing' || (view.phase === 'choosing' && mine));
  useSoundOnChange(`${view.turn}-${view.phase}`, () =>
    view.phase === 'playing' ? 'go' : view.phase === 'turn-end' ? 'reveal' : null,
  );

  const letters = view.mask.filter((c) => /[\p{L}\p{N}_]/u.test(c)).length;

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      {/* cabeçalho: vez, palavra/máscara, cronômetro */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar avatar={avatar(view.currentId)} size={44} />
          <div className="min-w-0">
            <p className="text-xs text-ink-400">
              Rodada {view.round}/{view.totalRounds} · vez {view.turn}
            </p>
            <p className="truncate font-display text-lg font-extrabold text-white">
              {mine
                ? 'Sua vez!'
                : `${nick(view.currentId)} ${view.phase === 'choosing' ? 'está escolhendo…' : v.doing}`}
            </p>
          </div>
        </div>
        {view.deadline && view.phase !== 'finished' && (
          <div
            className={`rounded-2xl px-4 py-2 font-display text-2xl font-extrabold tabular-nums ${left <= 10 && view.phase === 'playing' ? 'animate-pulse bg-pop-rose text-ink-950' : 'bg-ink-700 text-white'}`}
            role="timer"
            aria-label={`${left} segundos restantes`}
          >
            {left}s
          </div>
        )}
      </div>

      {view.mask.length > 0 && view.phase !== 'choosing' && (
        <div className="text-center">
          {mine && view.phase === 'playing' && (
            <p className="text-sm font-bold uppercase tracking-widest text-ink-400">{v.you}</p>
          )}
          <p
            className="font-display text-3xl font-extrabold tracking-[0.18em] text-white sm:text-4xl"
            aria-label={view.word ? `Palavra: ${view.word}` : `Palavra com ${letters} letras`}
          >
            {view.mask.map((c, i) =>
              c === ' ' ? (
                <span key={i} className="inline-block w-4" />
              ) : (
                <span
                  key={i}
                  className={
                    c === '_'
                      ? 'text-ink-400'
                      : mine || view.word
                        ? 'text-lime-400'
                        : 'text-pop-amber'
                  }
                >
                  {c}
                </span>
              ),
            )}
          </p>
          <p className="mt-1 text-sm text-ink-400">
            {view.category} · {letters} {letters === 1 ? 'letra' : 'letras'}
          </p>
        </div>
      )}

      {/* escolha da palavra */}
      {view.phase === 'choosing' &&
        (mine && view.choices ? (
          <div className="space-y-3 text-center">
            <p className="font-bold text-white">{v.pick}:</p>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Opções de palavra">
              {view.choices.map((w, i) => (
                <Button
                  key={w}
                  size="lg"
                  variant={i === 0 ? 'primary' : 'secondary'}
                  onClick={() => send({ type: 'choose', index: i })}
                >
                  {w}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-ink-400">
            Aguardando {nick(view.currentId)} escolher a palavra…
          </p>
        ))}

      {/* área do jogo */}
      {view.variant === 'draw' && (view.phase === 'playing' || view.phase === 'turn-end') && (
        <DrawingBoard
          turn={view.turn}
          serverOps={view.ops}
          canDraw={mine && view.phase === 'playing'}
          subscribe={subscribe}
        />
      )}

      {view.variant === 'charades' && view.phase === 'playing' && (
        <div className="grid place-items-center gap-3 rounded-3xl border-4 border-dashed border-pop-amber p-6 text-center">
          <Avatar avatar={avatar(view.currentId)} size={88} />
          {mine ? (
            <p className="max-w-sm text-ink-200">
              Imite <strong className="text-white">sem falar e sem escrever</strong> — use a chamada
              de vídeo ou façam ao vivo. A turma chuta no chat!
            </p>
          ) : (
            <p className="max-w-sm text-ink-200">
              Olhe a mímica de <strong className="text-white">{nick(view.currentId)}</strong> (na
              chamada ou ao vivo) e chute a resposta abaixo.
            </p>
          )}
        </div>
      )}

      {view.variant === 'secretword' && (view.phase === 'playing' || view.phase === 'turn-end') && (
        <Clues view={view} mine={mine} send={send} />
      )}

      {/* palpite rápido (bom no celular, onde o chat fica lá embaixo) */}
      {view.phase === 'playing' && isPlayer && !mine && !iGuessed && <GuessInput />}
      {view.phase === 'playing' && iGuessed && (
        <p className="rounded-2xl bg-lime-400/15 p-3 text-center font-bold text-lime-400">
          Você acertou! Agora só quem acertou vê suas mensagens.
        </p>
      )}
      {view.phase === 'playing' && mine && (
        <div className="text-right">
          <Button variant="ghost" size="sm" onClick={() => send({ type: 'giveUp' })}>
            Passar a vez
          </Button>
        </div>
      )}

      {/* quem já acertou / pontos do turno */}
      {(view.phase === 'playing' || view.phase === 'turn-end') && (
        <ul className="flex flex-wrap gap-2">
          {view.participants
            .filter((p) => p !== view.currentId)
            .map((p) => {
              const g = view.guessed.find((x) => x.id === p);
              const pts = view.turnScores?.[p];
              return (
                <li
                  key={p}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold ${g ? 'bg-lime-400 text-ink-950' : 'bg-ink-900 text-ink-400'}`}
                >
                  <Avatar avatar={avatar(p)} size={20} />
                  {nick(p)}
                  {g && ` +${g.points}`}
                  {!g && pts !== undefined && view.phase === 'turn-end' && ' +0'}
                </li>
              );
            })}
        </ul>
      )}

      {view.phase === 'turn-end' && (
        <p className="text-center text-sm text-ink-400">
          {view.guessed.length === 0
            ? 'Ninguém acertou dessa vez!'
            : `${nick(view.currentId)} ganhou +${view.turnScores?.[view.currentId ?? ''] ?? 0} pelos acertos.`}{' '}
          Próxima vez em instantes…
        </p>
      )}
    </div>
  );
}

function GuessInput() {
  const toast = useToast();
  const [text, setText] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await emitAck(EVENTS.CHAT_SEND, { text: t });
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <label htmlFor="guess" className="sr-only">
        Seu palpite
      </label>
      <input
        id="guess"
        className="input"
        placeholder="Seu palpite…"
        autoComplete="off"
        maxLength={60}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" disabled={!text.trim()}>
        Chutar
      </Button>
    </form>
  );
}

function Clues({
  view,
  mine,
  send,
}: {
  view: GuessView;
  mine: boolean;
  send: (a: unknown) => Promise<unknown>;
}) {
  const [text, setText] = useState('');
  const canSend = mine && view.phase === 'playing' && view.clues.length < view.maxClues;
  return (
    <div className="space-y-3 rounded-3xl border-4 border-dashed border-pop-violet p-4">
      <p className="text-center text-sm font-bold text-ink-200">
        Dicas ({view.clues.length}/{view.maxClues}) — cada dica a mais vale menos pontos
      </p>
      {view.clues.length === 0 ? (
        <p className="text-center text-ink-400">
          {mine ? 'Mande a primeira dica!' : 'Esperando a primeira dica…'}
        </p>
      ) : (
        <ol className="flex flex-wrap justify-center gap-2">
          {view.clues.map((c, i) => (
            <li
              key={i}
              className="animate-pop rounded-2xl bg-pop-violet px-4 py-2 font-display text-lg font-extrabold text-ink-950"
            >
              {i + 1}. {c}
            </li>
          ))}
        </ol>
      )}
      {canSend && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void send({ type: 'clue', text }).then(() => setText(''));
          }}
        >
          <input
            className="input"
            placeholder="Uma dica (até 3 palavras, sem a palavra secreta)"
            maxLength={30}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Nova dica"
          />
          <Button type="submit" disabled={!text.trim()}>
            Dar dica
          </Button>
        </form>
      )}
    </div>
  );
}
