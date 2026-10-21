import type { PublicRoom, TicTacToeView } from '@partyverse/shared';
import { Avatar } from '../../components/Avatar';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, useAct, usePlayers } from '../party/shared';

const MarkIcon = ({ m }: { m: 'X' | 'O' }) =>
  m === 'X' ? (
    <svg viewBox="0 0 40 40" className="h-3/5 w-3/5" aria-label="X">
      <path d="M8 8l24 24M32 8L8 32" stroke="#5cc8ff" strokeWidth="7" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 40 40" className="h-3/5 w-3/5" aria-label="O">
      <circle cx="20" cy="20" r="13" stroke="#ff5fa2" strokeWidth="7" fill="none" />
    </svg>
  );

export function TicTacToeGame({
  view,
  room,
  myId,
}: {
  view: TicTacToeView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const turnPlayer = view.turn === 'X' ? view.x : view.o;
  const myTurn = view.phase === 'playing' && turnPlayer === myId;
  const watching = !view.participants.includes(myId);
  useTickSound(left, myTurn, 5);
  useSoundOnChange(`${view.game}-${view.board.filter(Boolean).length}-${view.phase}`, () =>
    view.phase === 'game-end' ? (view.winner === 'draw' ? 'reveal' : 'win') : 'click',
  );

  const side = (id: string, m: 'X' | 'O') => (
    <div
      className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${view.phase === 'playing' && turnPlayer === id ? 'bg-ink-700 ring-2 ring-lime-400' : 'bg-ink-900/60'}`}
    >
      <Avatar avatar={avatar(id)} size={34} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">
          {nick(id)} {id === myId && <span className="text-xs text-ink-400">(você)</span>}
        </span>
        <span className="flex items-center gap-1 text-xs text-ink-400">
          <span className="grid h-4 w-4 place-items-center">
            <MarkIcon m={m} />
          </span>
          {view.totals[id] ?? 0} pts
        </span>
      </span>
    </div>
  );

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Partida {view.game} de até {view.totalGames}
            {watching && ' · você está assistindo'}
          </p>
          <h2 className="text-2xl font-extrabold">
            {view.phase === 'game-end'
              ? view.winner === 'draw'
                ? 'Deu velha! 🤝'
                : `${nick(view.winner === 'X' ? view.x : view.o)} venceu!`
              : myTurn
                ? 'Sua vez!'
                : `Vez de ${nick(turnPlayer)}`}
          </h2>
        </div>
        {view.phase === 'playing' && <Clock left={left} accent="text-pop-sky" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {side(view.x, 'X')}
        {side(view.o, 'O')}
      </div>
      <div
        className="mx-auto grid aspect-square w-full max-w-xs grid-cols-3 gap-2"
        role="grid"
        aria-label="Tabuleiro"
      >
        {view.board.map((c, i) => {
          const inLine = view.line?.includes(i);
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={c ? `Casa ${i + 1}: ${c}` : `Casa ${i + 1} vazia`}
              disabled={!myTurn || c !== null}
              onClick={() => act({ type: 'mark', cell: i })}
              className={`grid place-items-center rounded-2xl border-4 transition ${inLine ? 'border-lime-400 bg-lime-400/15' : 'border-ink-700 bg-ink-900'} ${myTurn && !c ? 'hover:border-ink-400' : ''}`}
            >
              {c && (
                <span className="grid h-full w-full animate-pop place-items-center">
                  <MarkIcon m={c} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-ink-400">
        Vitória vale 3, empate vale 1. Quem joga de X começa e troca a cada partida.
      </p>
    </div>
  );
}
