import type { HangmanView, PublicRoom } from '@partyverse/shared';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, useAct, usePlayers } from '../party/shared';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Desenho da forca: partes aparecem conforme as vidas acabam. */
function Gallows({ lost, max }: { lost: number; max: number }) {
  const parts = 6;
  const shown = Math.round((lost / max) * parts);
  const stroke = 'currentColor';
  return (
    <svg
      viewBox="0 0 120 140"
      className="h-40 w-32 text-white"
      aria-label={`${lost} de ${max} erros`}
    >
      <path
        d="M10 132h70M30 132V10h50v18"
        stroke={stroke}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {shown > 0 && <circle cx="80" cy="40" r="12" stroke="#ff7a6b" strokeWidth="5" fill="none" />}
      {shown > 1 && <path d="M80 52v34" stroke="#ff7a6b" strokeWidth="5" strokeLinecap="round" />}
      {shown > 2 && (
        <path d="M80 60l-16 14" stroke="#ff7a6b" strokeWidth="5" strokeLinecap="round" />
      )}
      {shown > 3 && (
        <path d="M80 60l16 14" stroke="#ff7a6b" strokeWidth="5" strokeLinecap="round" />
      )}
      {shown > 4 && (
        <path d="M80 86l-14 22" stroke="#ff7a6b" strokeWidth="5" strokeLinecap="round" />
      )}
      {shown > 5 && (
        <path d="M80 86l14 22" stroke="#ff7a6b" strokeWidth="5" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function HangmanGame({
  view,
  room,
  myId,
}: {
  view: HangmanView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const [word, setWord] = useState('');
  const myTurn = view.phase === 'playing' && view.currentId === myId;
  useTickSound(left, myTurn, 5);
  useSoundOnChange(`${view.round}-${view.guessed.length}-${view.wrong.length}-${view.phase}`, () =>
    view.phase === 'round-end'
      ? view.solvedBy
        ? 'win'
        : 'lose'
      : view.lastEvent?.kind === 'hit'
        ? 'correct'
        : view.lastEvent?.kind === 'miss' || view.lastEvent?.kind === 'word-miss'
          ? 'wrong'
          : null,
  );
  const used = new Set([...view.guessed, ...view.wrong]);

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Palavra {view.round} de {view.totalRounds}
            {view.category && <> · {view.category}</>}
          </p>
          <h2 className="truncate text-2xl font-extrabold">
            {view.phase !== 'playing'
              ? view.solvedBy
                ? `🎉 ${nick(view.solvedBy)} acertou!`
                : '💀 Enforcado!'
              : myTurn
                ? 'Sua vez!'
                : `Vez de ${nick(view.currentId ?? '')}`}
          </h2>
        </div>
        {view.phase === 'playing' && view.currentId && (
          <Avatar avatar={avatar(view.currentId)} size={44} />
        )}
        {view.phase === 'playing' && <Clock left={left} accent="text-pop-amber" />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <Gallows lost={view.maxLives - view.lives} max={view.maxLives} />
        <div className="space-y-3 text-center">
          <p className="flex flex-wrap justify-center gap-1.5" aria-label="Palavra">
            {view.mask.map((c, i) =>
              c === ' ' ? (
                <span key={i} className="w-4" />
              ) : (
                <span
                  key={i}
                  className={`grid h-11 w-8 place-items-center border-b-4 font-display text-2xl font-extrabold uppercase sm:w-9 ${c === '_' ? 'border-ink-400 text-transparent' : 'animate-pop border-lime-400 text-white'}`}
                >
                  {c === '_' ? '·' : c}
                </span>
              ),
            )}
          </p>
          <p className="text-sm text-ink-200">
            ❤️ {view.lives}/{view.maxLives}
            {view.wrong.length > 0 && (
              <>
                {' '}
                · erradas: <b className="uppercase text-pop-rose">{view.wrong.join(' ')}</b>
              </>
            )}
          </p>
          {view.lastEvent && (
            <p className="text-sm font-bold text-ink-200">{view.lastEvent.text}</p>
          )}
        </div>
      </div>

      {view.phase === 'playing' && (
        <>
          <div className="flex flex-wrap justify-center gap-1.5" aria-label="Letras">
            {ALPHABET.map((l) => {
              const hit = view.guessed.includes(l);
              const miss = view.wrong.includes(l);
              return (
                <button
                  key={l}
                  disabled={!myTurn || used.has(l)}
                  onClick={() => act({ type: 'letter', letter: l })}
                  className={`h-10 w-9 rounded-lg text-sm font-extrabold uppercase transition ${hit ? 'bg-lime-400 text-night' : miss ? 'bg-ink-700 text-ink-400 line-through' : 'bg-ink-600 text-white enabled:hover:bg-pop-amber enabled:hover:text-night'} disabled:cursor-default`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          {myTurn && (
            <form
              className="flex justify-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (word.trim().length >= 2) {
                  void act({ type: 'word', word: word.trim() });
                  setWord('');
                }
              }}
            >
              <input
                className="input max-w-xs py-2"
                placeholder="Sabe a palavra? Chute aqui"
                value={word}
                maxLength={40}
                onChange={(e) => setWord(e.target.value)}
              />
              <button className="rounded-xl bg-pop-amber px-4 py-2 font-bold text-night">
                Chutar
              </button>
            </form>
          )}
          <p className="text-center text-xs text-ink-400">
            Letra certa vale 10 por vez que aparece e você joga de novo. Errou: perde uma vida e
            passa a vez. Chutar a palavra certa vale bônus.
          </p>
        </>
      )}
    </div>
  );
}
