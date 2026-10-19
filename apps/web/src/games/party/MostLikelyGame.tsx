import type { MostLikelyView, PublicRoom } from '@partyverse/shared';
import { Avatar } from '../../components/Avatar';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, Countdown, useAct, usePlayers } from './shared';

export function MostLikelyGame({
  view,
  room,
  myId,
}: {
  view: MostLikelyView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const isPlayer = view.participants.includes(myId);
  useTickSound(left, view.phase === 'vote', 5);
  useSoundOnChange(`${view.round}-${view.phase}`, () =>
    view.phase === 'vote' ? 'go' : view.phase === 'reveal' ? 'reveal' : null,
  );

  if (view.phase === 'countdown')
    return (
      <Countdown
        left={left}
        text={`${view.totalRounds} frases · votem sem dó`}
        accent="text-pop-amber"
      />
    );
  if (!view.prompt) return null;
  const r = view.reveal;
  const max = r ? Math.max(1, ...Object.values(r.counts)) : 1;

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Frase {view.round} de {view.totalRounds}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
            Quem é mais provável de <span className="text-pop-amber">{view.prompt}</span>?
          </h2>
        </div>
        {view.phase === 'vote' && <Clock left={left} accent="text-pop-amber" />}
      </div>

      {view.phase === 'vote' && (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {view.participants.map((id) => {
              const on = view.myVote === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={!isPlayer}
                    aria-pressed={on}
                    onClick={() => act({ type: 'vote', targetId: id })}
                    className={`flex w-full items-center gap-2 rounded-2xl border-2 p-2 text-left font-bold transition enabled:hover:-translate-y-0.5 ${on ? 'border-pop-amber bg-pop-amber/20 text-white' : 'border-ink-700 bg-ink-900/60 text-ink-200'}`}
                  >
                    <Avatar avatar={avatar(id)} size={36} />
                    <span className="truncate">
                      {nick(id)}
                      {id === myId && <span className="text-xs text-ink-400"> (você)</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-ink-400">
            {isPlayer
              ? view.myVote
                ? 'Voto registrado — dá para trocar até o tempo acabar.'
                : 'Toque em alguém (pode ser você!).'
              : 'Você está assistindo.'}{' '}
            · {view.votedPlayers.length}/{view.participants.length} votaram
          </p>
        </>
      )}

      {r && (
        <div className="space-y-3">
          {r.chosen.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-3xl bg-pop-amber/15 p-4">
              {r.chosen.map((id) => (
                <div key={id} className="flex animate-pop flex-col items-center gap-1">
                  <Avatar avatar={avatar(id)} size={72} />
                  <span className="font-display text-xl font-extrabold text-pop-amber">
                    {nick(id)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-ink-900 p-4 text-center text-ink-200">Ninguém votou 🦗</p>
          )}
          <ul className="space-y-1.5">
            {Object.entries(r.counts)
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <span className="w-24 truncate font-bold">{nick(id)}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-ink-900">
                    <span
                      className="block h-full rounded-full bg-pop-amber transition-all duration-700"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right font-bold">{n}</span>
                </li>
              ))}
          </ul>
          {isPlayer && (
            <p className="text-center text-sm font-bold text-lime-400">
              {(r.gained[myId] ?? 0) > 0
                ? `+${r.gained[myId]} pontos`
                : 'Sem pontos nesta — vote com a maioria!'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
