import type { PublicRoom, TelephoneView } from '@partyverse/shared';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { DrawingBoard } from '../guess/DrawingBoard';
import { DrawingView } from '../guess/DrawingView';
import { Clock, useAct, usePlayers } from '../party/shared';

const IDEAS = [
  'Um gato de óculos dirigindo um ônibus',
  'Pizza voando no espaço',
  'Vovó surfando numa onda gigante',
  'Um dinossauro tomando sorvete',
  'Cachorro fazendo churrasco',
  'Robô apaixonado por uma geladeira',
  'Polvo tocando bateria',
  'Pinguim de férias na praia',
];

export function TelephoneGame({
  view,
  room,
  myId,
  subscribe,
}: {
  view: TelephoneView;
  room: PublicRoom;
  myId: string;
  subscribe: (fn: (ev: unknown) => void) => () => void;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const [text, setText] = useState('');
  const doneMe = view.doneStep.includes(myId);
  const noop = useCallback(() => () => undefined, []);
  useEffect(() => setText(''), [view.step]);
  useTickSound(left, !doneMe && view.phase !== 'reveal' && view.phase !== 'finished', 10);
  useSoundOnChange(`${view.phase}-${view.step}-${view.reveal?.book}-${view.reveal?.shown}`, () =>
    view.phase === 'reveal' ? 'reveal' : view.phase === 'finished' ? null : 'go',
  );
  void subscribe;

  // ---------- revelação ----------
  if (view.reveal) {
    const r = view.reveal;
    return (
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar avatar={avatar(r.owner)} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-400">
              Caderno {r.book + 1} de {r.totalBooks}
            </p>
            <h2 className="truncate text-2xl font-extrabold">Caderno de {nick(r.owner)}</h2>
          </div>
          {view.phase === 'reveal' && (
            <Button size="sm" variant="secondary" onClick={() => act({ type: 'next' })}>
              Próxima ›
            </Button>
          )}
        </div>
        <ol className="space-y-3">
          {r.entries.map((e, i) => (
            <li key={i} className="animate-rise">
              <div className="mb-1 flex items-center gap-2 text-sm text-ink-400">
                <Avatar avatar={avatar(e.author)} size={22} />
                <b className="text-ink-200">{nick(e.author)}</b>
                {e.kind === 'text' ? (i === 0 ? 'escreveu' : 'achou que era') : 'desenhou'}
              </div>
              {e.kind === 'text' ? (
                <p className="rounded-2xl bg-ink-900 px-4 py-3 font-display text-xl font-extrabold text-white">
                  “{e.text}”
                </p>
              ) : e.ops.length ? (
                <div className="max-w-md">
                  <DrawingView ops={e.ops} label={`Desenho de ${nick(e.author)}`} />
                </div>
              ) : (
                <p className="rounded-2xl bg-ink-900 px-4 py-3 text-ink-400">(não desenhou nada)</p>
              )}
              {e.author !== myId && view.participants.includes(myId) && (
                <button
                  onClick={() => act({ type: 'like', book: r.book, entry: i })}
                  aria-pressed={e.likedByMe}
                  className={`mt-1 rounded-full px-3 py-1 text-sm font-bold ${e.likedByMe ? 'bg-pop-pink text-night' : 'bg-ink-800 text-ink-200 hover:bg-ink-700'}`}
                >
                  ❤️ {e.likes}
                </button>
              )}
              {e.author === myId && e.likes > 0 && (
                <span className="mt-1 inline-block text-sm text-pop-pink">❤️ {e.likes}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // ---------- jogando ----------
  const task = view.task;
  const header = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-400">
          Passo {view.step + 1} de {view.totalSteps} · {view.doneStep.length}/
          {view.participants.length} prontos
        </p>
        <h2 className="text-2xl font-extrabold">
          {!task
            ? 'A turma está jogando…'
            : task.kind === 'write'
              ? '✍️ Escreva uma frase'
              : task.kind === 'draw'
                ? '🎨 Desenhe isto'
                : '🔎 O que é este desenho?'}
        </h2>
      </div>
      <Clock left={left} accent="text-pop-pink" />
    </div>
  );

  if (!task)
    return (
      <div className="card space-y-4 p-5">
        {header}
        <p className="text-ink-200">Você está assistindo. A revelação aparece no fim!</p>
      </div>
    );

  if (doneMe && task.kind !== 'draw')
    return (
      <div className="card space-y-4 p-5">
        {header}
        <p className="rounded-2xl bg-lime-400/10 p-4 font-bold text-lime-400">
          ✓ Enviado! Esperando os outros…
        </p>
        <WaitList view={view} nick={nick} avatar={avatar} />
      </div>
    );

  return (
    <div className="card space-y-4 p-5">
      {header}
      {task.kind === 'draw' && (
        <>
          <p className="rounded-2xl bg-pop-pink/15 px-4 py-3 text-center font-display text-2xl font-extrabold text-white">
            “{task.prompt}”
          </p>
          <DrawingBoard
            turn={view.step}
            serverOps={view.myDraft.ops}
            canDraw={!doneMe}
            subscribe={noop}
          />
          {doneMe ? (
            <p className="text-center font-bold text-lime-400">✓ Pronto! Esperando os outros…</p>
          ) : (
            <div className="text-right">
              <Button onClick={() => act({ type: 'done' })}>Terminei!</Button>
            </div>
          )}
        </>
      )}
      {task.kind === 'describe' && (
        <div className="mx-auto max-w-md">
          {task.ops.length ? (
            <DrawingView ops={task.ops} />
          ) : (
            <p className="rounded-2xl bg-ink-900 p-4 text-ink-400">
              A pessoa não desenhou nada… invente algo divertido!
            </p>
          )}
        </div>
      )}
      {(task.kind === 'write' || task.kind === 'describe') && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void act({ type: 'text', text: text.trim() });
          }}
        >
          <input
            className="input min-w-[12rem] flex-1"
            autoFocus
            maxLength={80}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              task.kind === 'write' ? 'Ex.: um gato de óculos dirigindo um ônibus' : 'Acho que é…'
            }
          />
          <Button type="submit" disabled={!text.trim()}>
            Enviar
          </Button>
          {task.kind === 'write' && (
            <button
              type="button"
              className="text-sm font-bold text-pop-sky hover:underline"
              onClick={() => setText(IDEAS[Math.floor(Math.random() * IDEAS.length)]!)}
            >
              🎲 Me dá uma ideia
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function WaitList({
  view,
  nick,
  avatar,
}: {
  view: TelephoneView;
  nick: (id: string) => string;
  avatar: (id: string) => string;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {view.participants.map((p) => (
        <li
          key={p}
          className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-3 text-sm font-bold ${view.doneStep.includes(p) ? 'bg-lime-400/15 text-lime-400' : 'bg-ink-900 text-ink-400'}`}
        >
          <Avatar avatar={avatar(p)} size={24} />
          {nick(p)} {view.doneStep.includes(p) ? '✓' : '…'}
        </li>
      ))}
    </ul>
  );
}
