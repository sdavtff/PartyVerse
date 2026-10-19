import type { PublicRoom, TwoTruthsView } from '@partyverse/shared';
import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, useAct, usePlayers } from './shared';

const LETTERS = ['A', 'B', 'C'];

export function TwoTruthsGame({
  view,
  room,
  myId,
}: {
  view: TwoTruthsView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const isPlayer = view.participants.includes(myId);
  useTickSound(left, view.phase === 'write' || view.phase === 'guess', 5);
  useSoundOnChange(`${view.round}-${view.turn}-${view.phase}`, () => {
    if (view.phase === 'guess') return 'go';
    if (view.phase === 'reveal' && view.reveal && view.authorId !== myId && isPlayer)
      return (view.reveal.gained[myId] ?? 0) > 0 ? 'correct' : 'wrong';
    return view.phase === 'reveal' ? 'reveal' : null;
  });

  if (view.phase === 'write')
    return (
      <div className="card space-y-5 p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-400">
              Rodada {view.round} de {view.totalRounds} · {view.submitted.length}/
              {view.participants.length} prontos
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">
              Duas verdades e <span className="text-pop-indigo">uma mentira</span> sobre você
            </h2>
          </div>
          <Clock left={left} accent="text-pop-indigo" />
        </div>
        {isPlayer ? (
          view.mySubmission ? (
            <div className="space-y-2">
              <p className="font-bold text-lime-400">✓ Enviado! Esperando a galera…</p>
              <ul className="space-y-1 text-sm text-ink-200">
                {view.mySubmission.statements.map((t, i) => (
                  <li key={i}>
                    {i === view.mySubmission!.lie ? '🤥' : '✅'} {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <WriteForm onSubmit={(statements, lie) => act({ type: 'submit', statements, lie })} />
          )
        ) : (
          <p className="text-ink-200">Os jogadores estão escrevendo…</p>
        )}
      </div>
    );

  if (!view.authorId || !view.statements) return null;
  const author = view.authorId;
  const mineTurn = author === myId;
  const r = view.reveal;

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center gap-3">
        <Avatar avatar={avatar(author)} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Rodada {view.round} · vez {view.turn} de {view.totalTurns}
          </p>
          <h2 className="text-2xl font-extrabold">
            {mineTurn ? 'Suas frases!' : `Qual é a mentira de ${nick(author)}?`}
          </h2>
        </div>
        {view.phase === 'guess' && <Clock left={left} accent="text-pop-indigo" />}
      </div>
      <ul className="space-y-2">
        {view.statements.map((t, i) => {
          const isLie = r?.lie === i;
          const picked = view.myGuess === i;
          const who = r
            ? Object.entries(r.guesses)
                .filter(([, g]) => g === i)
                .map(([p]) => p)
            : [];
          return (
            <li key={i}>
              <button
                type="button"
                disabled={mineTurn || !isPlayer || view.phase !== 'guess'}
                aria-pressed={picked}
                onClick={() => act({ type: 'guess', index: i })}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition enabled:hover:-translate-y-0.5 ${
                  r
                    ? isLie
                      ? 'border-pop-rose bg-pop-rose/15'
                      : 'border-lime-400/60 bg-lime-400/10'
                    : picked
                      ? 'border-pop-indigo bg-pop-indigo/20'
                      : 'border-ink-700 bg-ink-900/60'
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink-700 font-display font-extrabold">
                  {r ? (isLie ? '🤥' : '✅') : LETTERS[i]}
                </span>
                <span className="flex-1 pt-1 font-bold text-white">{t}</span>
                {who.length > 0 && (
                  <span className="flex -space-x-2 pt-0.5">
                    {who.slice(0, 5).map((p) => (
                      <Avatar key={p} avatar={avatar(p)} size={24} label={nick(p)} />
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-sm text-ink-400">
        {r
          ? mineTurn
            ? `Você enganou ${(r.gained[myId] ?? 0) / 50} pessoa(s): +${r.gained[myId] ?? 0}`
            : isPlayer
              ? (r.gained[myId] ?? 0) > 0
                ? '🎯 Você achou a mentira! +100'
                : 'Caiu na mentira 😅'
              : ''
          : mineTurn
            ? 'Faça cara de paisagem enquanto a galera chuta…'
            : `${view.guessedPlayers.length}/${view.participants.length - 1} já chutaram`}
      </p>
    </div>
  );
}

function WriteForm({ onSubmit }: { onSubmit: (s: [string, string, string], lie: number) => void }) {
  const [texts, setTexts] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  const ok = texts.every((t) => t.trim().length >= 3) && lie !== null;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(texts.map((t) => t.trim()) as [string, string, string], lie!);
      }}
    >
      {texts.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className="input flex-1 py-2"
            maxLength={90}
            placeholder={
              ['Ex.: Já comi formiga', 'Ex.: Sei tocar violão', 'Ex.: Nunca andei de avião'][i]
            }
            value={t}
            aria-label={`Frase ${LETTERS[i]}`}
            onChange={(e) => setTexts((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            onClick={() => setLie(i)}
            aria-pressed={lie === i}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${lie === i ? 'bg-pop-rose text-ink-950' : 'bg-ink-700 text-ink-200 hover:text-white'}`}
          >
            🤥 {lie === i ? 'Mentira' : 'É mentira?'}
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-400">
          Marque qual das três é a mentira. Ninguém vê até o fim.
        </p>
        <Button type="submit" disabled={!ok}>
          Enviar
        </Button>
      </div>
    </form>
  );
}
