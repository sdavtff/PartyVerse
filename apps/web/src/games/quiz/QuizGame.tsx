import { EVENTS, type PublicRoom, type QuizView } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/Toast';
import { actionId, emitAck } from '../../lib/socket';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';

const OPTION_STYLE = [
  { bg: 'bg-pop-sky', ring: 'ring-pop-sky', glyph: '▲' },
  { bg: 'bg-pop-pink', ring: 'ring-pop-pink', glyph: '◆' },
  { bg: 'bg-pop-amber', ring: 'ring-pop-amber', glyph: '●' },
  { bg: 'bg-lime-400', ring: 'ring-lime-400', glyph: '■' },
];

export function QuizGame({ view, room, myId }: { view: QuizView; room: PublicRoom; myId: string }) {
  const toast = useToast();
  const left = useCountdown(view.deadline);
  const isPlayer = view.participants.includes(myId);
  const [pending, setPending] = useState<number | null>(null);
  const limit = Number(room.gameSettings.secondsPerQuestion) || 15;
  const player = (id: string) => room.players.find((p) => p.id === id);
  const nick = (id: string) => player(id)?.nickname ?? 'Alguém';
  const avatar = (id: string) => player(id)?.avatar ?? 'blob-1';

  useEffect(() => setPending(null), [view.index]);
  useTickSound(
    left,
    view.phase === 'question' || view.phase === 'countdown',
    view.phase === 'countdown' ? 3 : 5,
  );
  useSoundOnChange(`${view.index}-${view.phase}`, () => {
    if (view.phase === 'question') return 'go';
    if (view.phase === 'reveal' && isPlayer && view.reveal)
      return (view.reveal.gained[myId] ?? 0) > 0 ? 'correct' : 'wrong';
    return null;
  });

  const answer = async (option: number) => {
    if (!isPlayer || view.phase !== 'question' || view.myAnswer !== null || pending !== null)
      return;
    setPending(option);
    try {
      await emitAck(EVENTS.GAME_ACTION, {
        action: { type: 'answer', option },
        actionId: actionId(),
      });
    } catch (e) {
      setPending(null);
      toast((e as Error).message, 'error');
    }
  };

  // ---------- contagem inicial ----------
  if (view.phase === 'countdown') {
    return (
      <div className="card grid place-items-center gap-3 p-10 text-center">
        <p className="text-ink-400">{view.total} perguntas · prepare os dedos</p>
        <p key={left} className="animate-pop font-display text-8xl font-extrabold text-pop-sky">
          {left || 'Já!'}
        </p>
      </div>
    );
  }

  const q = view.question;
  if (!q) return null;
  const chosen = view.myAnswer ?? pending;
  const reveal = view.reveal;
  const myGain = reveal ? (reveal.gained[myId] ?? 0) : 0;
  const ranking = [...view.participants].sort(
    (a, b) => (view.totals[b] ?? 0) - (view.totals[a] ?? 0),
  );

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Pergunta {view.index + 1} de {view.total} · {q.category}
          </p>
          <TimeBar left={view.phase === 'question' ? left : 0} limit={limit} />
        </div>
        {view.phase === 'question' && (
          <div
            className={`rounded-2xl px-4 py-2 font-display text-3xl font-extrabold tabular-nums ${left <= 5 ? 'animate-pulse bg-pop-rose text-night' : 'bg-ink-700 text-white'}`}
            role="timer"
            aria-label={`${left} segundos restantes`}
          >
            {left}s
          </div>
        )}
      </div>

      <h2
        key={view.index}
        className="animate-rise text-2xl font-extrabold leading-tight sm:text-3xl"
      >
        {q.text}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const s = OPTION_STYLE[i]!;
          const isCorrect = reveal?.correct === i;
          const isMine = chosen === i;
          const faded = reveal ? !isCorrect : chosen !== null && !isMine;
          const whoPicked = reveal
            ? Object.entries(reveal.answers)
                .filter(([, o]) => o === i)
                .map(([p]) => p)
            : [];
          return (
            <button
              key={i}
              type="button"
              disabled={!isPlayer || view.phase !== 'question' || chosen !== null}
              onClick={() => answer(i)}
              className={`relative flex min-h-[4.5rem] animate-rise items-center gap-3 rounded-2xl border-4 border-night px-4 py-3 text-left font-bold text-night shadow-chunky transition enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:cursor-default ${s.bg} ${faded ? 'opacity-40 saturate-50' : ''} ${isMine ? `ring-4 ring-white ring-offset-2 ring-offset-ink-800` : ''} ${reveal && isMine && !isCorrect ? 'shake' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
              aria-pressed={isMine}
            >
              <span className="text-2xl" aria-hidden>
                {s.glyph}
              </span>
              <span className="flex-1 text-lg leading-snug">{opt}</span>
              {reveal && isCorrect && (
                <span className="chip bg-ink-950 text-lime-400" aria-label="resposta certa">
                  ✓ certa
                </span>
              )}
              {whoPicked.length > 0 && (
                <span className="absolute -bottom-3 right-3 flex -space-x-2">
                  {whoPicked.slice(0, 6).map((p) => (
                    <Avatar key={p} avatar={avatar(p)} size={24} label={nick(p)} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view.phase === 'question' && (
        <p className="text-center text-sm text-ink-400">
          {!isPlayer
            ? 'Você está assistindo — joga na próxima!'
            : chosen !== null
              ? 'Resposta enviada! Esperando os outros…'
              : 'Quanto mais rápido, mais pontos.'}{' '}
          ({view.answeredPlayers.length}/{view.participants.length} responderam)
        </p>
      )}

      {reveal && (
        <div className="space-y-4">
          {isPlayer && (
            <p
              className={`animate-pop text-center font-display text-3xl font-extrabold ${myGain > 0 ? 'text-lime-400' : 'text-pop-rose'}`}
            >
              {myGain > 0
                ? `+${myGain} pontos${(view.streaks[myId] ?? 0) >= 3 ? ` · sequência de ${view.streaks[myId]}! 🔥` : ''}`
                : view.myAnswer === null
                  ? 'Tempo esgotado!'
                  : 'Errou!'}
            </p>
          )}
          {reveal.fact && (
            <p className="rounded-2xl bg-ink-900 p-3 text-sm text-ink-200">
              <strong className="text-white">Curiosidade:</strong> {reveal.fact}
            </p>
          )}
          <ol className="grid gap-2 sm:grid-cols-2">
            {ranking.map((p, i) => (
              <li
                key={p}
                className="flex animate-rise items-center gap-3 rounded-2xl bg-ink-900 px-3 py-2"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="w-5 text-center font-display font-extrabold text-ink-400">
                  {i + 1}
                </span>
                <Avatar avatar={avatar(p)} size={28} />
                <span className="min-w-0 flex-1 truncate font-bold text-white">
                  {nick(p)}
                  {p === myId && ' (você)'}
                </span>
                {(reveal.gained[p] ?? 0) > 0 && (
                  <span className="text-sm text-lime-400">+{reveal.gained[p]}</span>
                )}
                <span className="font-display text-xl font-extrabold text-white">
                  {view.totals[p] ?? 0}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Barra que esvazia até o fim do tempo. */
function TimeBar({ left, limit }: { left: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.max(0, (left / limit) * 100)) : 0;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700" aria-hidden>
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${pct <= 33 ? 'bg-pop-rose' : 'bg-pop-sky'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
