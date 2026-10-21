import type { CheckersPiece, CheckersView, PublicRoom } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, useAct, usePlayers } from '../party/shared';

const Piece = ({ p }: { p: NonNullable<CheckersPiece> }) => {
  const white = p === 'w' || p === 'W';
  const king = p === 'W' || p === 'B';
  return (
    <span
      className={`grid h-[78%] w-[78%] place-items-center rounded-full border-4 shadow-chunky-sm ${white ? 'border-[#d9cfbf] bg-[#fff8ec]' : 'border-[#1a1320] bg-[#3a2c48]'}`}
    >
      {king && <span className="text-[60%] leading-none">👑</span>}
    </span>
  );
};

export function CheckersGame({
  view,
  room,
  myId,
}: {
  view: CheckersView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const [sel, setSel] = useState<number | null>(null);
  const turnPlayer = view.turn === 'w' ? view.white : view.black;
  const myTurn = view.phase === 'playing' && turnPlayer === myId;
  // quem joga de pretas vê o tabuleiro do seu lado
  const flip = myId === view.black;
  useTickSound(left, myTurn, 10);
  useSoundOnChange(`${view.game}-${view.lastMove?.join(',') ?? ''}-${view.phase}`, () =>
    view.phase === 'game-end' ? 'win' : view.lastMove ? 'click' : null,
  );
  useEffect(() => setSel(null), [view.lastMove, view.turn]);

  const starts = new Set(view.moves.map((m) => m[0]!));
  const fromSel = sel === null ? [] : view.moves.filter((m) => m[0] === sel);
  const targets = new Map(fromSel.map((m) => [m.at(-1)!, m]));
  const mustCapture = view.mustCapture;

  const click = (i: number) => {
    if (!myTurn) return;
    const m = targets.get(i);
    if (m) {
      void act({ type: 'move', path: m });
      setSel(null);
    } else if (starts.has(i)) setSel(i);
    else setSel(null);
  };

  const order = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const side = (id: string, color: 'w' | 'b') => (
    <div
      className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${view.phase === 'playing' && turnPlayer === id ? 'bg-ink-700 ring-2 ring-lime-400' : 'bg-ink-900/60'}`}
    >
      <Avatar avatar={avatar(id)} size={32} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{nick(id)}</span>
        <span className="text-xs text-ink-400">
          {color === 'w' ? '⚪ brancas' : '⚫ pretas'} ·{' '}
          {
            view.board.filter((p) =>
              color === 'w' ? p === 'w' || p === 'W' : p === 'b' || p === 'B',
            ).length
          }{' '}
          peças
        </span>
      </span>
    </div>
  );

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Partida {view.game} de {view.totalGames}
            {!view.participants.includes(myId) && ' · você está assistindo'}
          </p>
          <h2 className="text-2xl font-extrabold">
            {view.phase === 'game-end'
              ? view.winner === 'draw'
                ? 'Empate!'
                : `${nick(view.winner === 'w' ? view.white : view.black)} venceu!`
              : myTurn
                ? mustCapture
                  ? 'Sua vez — capture!'
                  : 'Sua vez!'
                : `Vez de ${nick(turnPlayer)}`}
          </h2>
          {view.reason && <p className="text-sm text-ink-200">{view.reason}</p>}
        </div>
        {view.phase === 'playing' && <Clock left={left} accent="text-pop-orange" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {side(flip ? view.white : view.black, flip ? 'w' : 'b')}
        {side(flip ? view.black : view.white, flip ? 'b' : 'w')}
      </div>
      <div
        className="mx-auto grid aspect-square w-full max-w-[28rem] grid-cols-8 overflow-hidden rounded-2xl border-4 border-night shadow-chunky"
        role="grid"
        aria-label="Tabuleiro de damas"
      >
        {order.map((i) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const p = view.board[i];
          const isTarget = targets.has(i);
          const canStart = myTurn && starts.has(i);
          const last = view.lastMove?.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              disabled={!dark}
              onClick={() => click(i)}
              aria-label={`Casa ${i}${p ? `, ${p === 'w' || p === 'W' ? 'branca' : 'preta'}${p === 'W' || p === 'B' ? ' dama' : ''}` : ''}`}
              className={`relative grid place-items-center ${dark ? 'bg-[#7a5a3a]' : 'bg-[#e9d6b5]'} ${last ? 'after:absolute after:inset-0 after:bg-pop-amber/25' : ''} ${sel === i ? 'ring-4 ring-inset ring-lime-400' : canStart ? 'ring-2 ring-inset ring-lime-400/60' : ''}`}
            >
              {p && <Piece p={p} />}
              {isTarget && (
                <span className="absolute h-1/3 w-1/3 rounded-full bg-lime-400/80" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-ink-400">
        Toque na peça e depois no destino. Capturar é obrigatório (e a jogada que pega mais peças);
        a dama anda várias casas.
      </p>
    </div>
  );
}
