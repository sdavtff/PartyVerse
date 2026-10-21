import type { PublicRoom, SpiesColor, SpiesView } from '@partyverse/shared';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, useAct, usePlayers } from '../party/shared';

const CARD: Record<SpiesColor, string> = {
  red: 'bg-[#ff6b6b] text-night border-[#c94545]',
  blue: 'bg-[#5c9dff] text-night border-[#3a6fc4]',
  neutral: 'bg-[#e6d5b8] text-night border-[#b9a586]',
  assassin: 'bg-night text-white border-[#000]',
};
const HINT: Record<SpiesColor, string> = {
  red: 'ring-4 ring-inset ring-[#ff6b6b]',
  blue: 'ring-4 ring-inset ring-[#5c9dff]',
  neutral: 'ring-2 ring-inset ring-[#b9a586]',
  assassin: 'ring-4 ring-inset ring-white bg-ink-950',
};
const NAME = { red: 'Vermelho', blue: 'Azul' } as const;

export function SpiesGame({
  view,
  room,
  myId,
}: {
  view: SpiesView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const myTeam = view.teams.red.includes(myId)
    ? 'red'
    : view.teams.blue.includes(myId)
      ? 'blue'
      : null;
  const iAmMaster = myTeam !== null && view.spymasters[myTeam] === myId;
  const myTurn = myTeam === view.turn;
  const canClue = view.phase === 'clue' && myTurn && iAmMaster;
  const canGuess = view.phase === 'guess' && myTurn && !iAmMaster;
  useTickSound(left, myTurn && (view.phase === 'clue' || view.phase === 'guess'), 10);
  useSoundOnChange(`${view.revealed.filter(Boolean).length}-${view.phase}-${view.turn}`, () =>
    view.phase === 'game-end'
      ? view.winner === myTeam
        ? 'win'
        : 'lose'
      : view.phase === 'guess'
        ? 'reveal'
        : null,
  );

  const team = (t: 'red' | 'blue') => (
    <div
      className={`rounded-2xl p-3 ${t === 'red' ? 'bg-[#ff6b6b]/15' : 'bg-[#5c9dff]/15'} ${view.turn === t && view.phase !== 'game-end' && view.phase !== 'finished' ? 'ring-2 ring-white/60' : ''}`}
    >
      <p className="flex items-center justify-between font-extrabold">
        <span>
          {t === 'red' ? '🔴' : '🔵'} {NAME[t]}
        </span>
        <span className="font-display text-2xl">{view.remaining[t]}</span>
      </p>
      <ul className="mt-1 space-y-1 text-sm">
        {view.teams[t].map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <Avatar avatar={avatar(p)} size={20} />
            <span className={`truncate ${p === myId ? 'font-bold text-white' : 'text-ink-200'}`}>
              {nick(p)}
            </span>
            {view.spymasters[t] === p && <span title="Mestre">🕶️</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Partida {view.game} de {view.totalGames}
            {myTeam
              ? ` · você é do time ${NAME[myTeam]}${iAmMaster ? ' (mestre 🕶️)' : ''}`
              : ' · assistindo'}
          </p>
          <h2 className="text-2xl font-extrabold">
            {view.phase === 'game-end' || view.phase === 'finished'
              ? `🏆 Time ${NAME[view.winner ?? 'red']} venceu!`
              : view.phase === 'clue'
                ? canClue
                  ? 'Dê uma dica para o seu time'
                  : `Mestre ${NAME[view.turn]} pensando na dica…`
                : `Dica: ${view.clue?.word} ${view.clue?.count === 0 ? '∞' : view.clue?.count}`}
          </h2>
          {view.phase === 'guess' && (
            <p className="text-sm text-ink-200">
              Time {NAME[view.turn]} escolhendo · chutes restantes:{' '}
              {view.guessesLeft > 9 ? '∞' : view.guessesLeft}
            </p>
          )}
          {view.reason && <p className="text-sm text-ink-200">{view.reason}</p>}
        </div>
        {(view.phase === 'clue' || view.phase === 'guess') && (
          <Clock left={left} accent="text-pop-rose" />
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="grid" aria-label="Mesa de cartas">
        {view.words.map((w, i) => {
          const r = view.revealed[i];
          const k = view.key?.[i];
          return (
            <button
              key={i}
              role="gridcell"
              disabled={!canGuess || r !== null}
              onClick={() => act({ type: 'reveal', card: i })}
              className={`flex min-h-[3.25rem] items-center justify-center rounded-xl border-b-4 px-1 text-center text-[11px] font-extrabold uppercase leading-tight transition sm:min-h-[4rem] sm:text-sm ${r ? `${CARD[r]} animate-pop` : `border-ink-600 bg-ink-800 text-white ${k ? HINT[k] : ''} ${canGuess ? 'hover:-translate-y-0.5 hover:bg-ink-700' : ''}`}`}
              aria-label={`${w}${r ? ` (${r})` : ''}`}
            >
              <span className="break-all">{r === 'assassin' ? `💀 ${w}` : w}</span>
            </button>
          );
        })}
      </div>

      {canClue && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (word.trim()) {
              void act({ type: 'clue', word: word.trim(), count });
              setWord('');
            }
          }}
        >
          <label className="min-w-[10rem] flex-1">
            <span className="label">Dica (uma palavra)</span>
            <input
              className="input py-2"
              maxLength={24}
              value={word}
              onChange={(e) => setWord(e.target.value.replace(/\s/g, ''))}
            />
          </label>
          <label>
            <span className="label">Quantas</span>
            <select
              className="input py-2"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? '∞' : n}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={!word.trim()}>
            Dar dica
          </Button>
          <p className="w-full text-xs text-ink-400">
            As cartas com borda colorida são do seu time; a preta é o assassino — fuja dela!
          </p>
        </form>
      )}
      {canGuess && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-200">Combinem e toquem nas cartas do seu time.</p>
          <Button variant="secondary" size="sm" onClick={() => act({ type: 'pass' })}>
            Passar a vez
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {team('red')}
        {team('blue')}
      </div>
      {view.log.length > 0 && (
        <ul className="space-y-0.5 rounded-2xl bg-ink-900 p-3 text-xs text-ink-200">
          {view.log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
