import type { PublicRoom, TruthDareView } from '@partyverse/shared';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';
import { Clock, useAct, usePlayers } from './shared';

export function TruthDareGame({
  view,
  room,
  myId,
}: {
  view: TruthDareView;
  room: PublicRoom;
  myId: string;
}) {
  const left = useCountdown(view.deadline);
  const act = useAct();
  const { nick, avatar } = usePlayers(room);
  const cur = view.currentId;
  const mine = cur === myId;
  const isPlayer = view.participants.includes(myId);
  useTickSound(left, view.phase === 'choose' || view.phase === 'judge', 5);
  useSoundOnChange(`${view.turn}-${view.phase}`, () =>
    view.phase === 'perform'
      ? 'reveal'
      : view.phase === 'result' && view.result
        ? view.result.ok
          ? 'correct'
          : 'wrong'
        : null,
  );
  if (!cur) return null;
  const isTruth = view.pick === 'truth';

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center gap-3">
        <Avatar avatar={avatar(cur)} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-400">
            Vez {view.turn} de {view.totalTurns}
          </p>
          <h2 className="truncate text-2xl font-extrabold">
            {mine ? 'Sua vez!' : `Vez de ${nick(cur)}`}
          </h2>
        </div>
        {view.phase !== 'result' && <Clock left={left} accent="text-pop-teal" />}
      </div>

      {view.phase === 'choose' &&
        (mine ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => act({ type: 'choose', pick: 'truth' })}
              className="rounded-3xl bg-pop-sky p-6 text-left text-[#10202e] shadow-chunky transition hover:-translate-y-1"
            >
              <span className="text-4xl">🗣️</span>
              <span className="mt-2 block font-display text-3xl font-extrabold">Verdade</span>
              <span className="text-sm font-bold">+100 se responder</span>
            </button>
            <button
              onClick={() => act({ type: 'choose', pick: 'dare' })}
              className="rounded-3xl bg-pop-rose p-6 text-left text-[#2a0d0a] shadow-chunky transition hover:-translate-y-1"
            >
              <span className="text-4xl">🔥</span>
              <span className="mt-2 block font-display text-3xl font-extrabold">Desafio</span>
              <span className="text-sm font-bold">+150 se cumprir</span>
            </button>
          </div>
        ) : (
          <p className="rounded-2xl bg-ink-900 p-6 text-center text-lg text-ink-200">
            {nick(cur)} está escolhendo: verdade ou desafio? 🤔
          </p>
        ))}

      {(view.phase === 'perform' || view.phase === 'judge' || view.phase === 'result') &&
        view.card && (
          <div
            className={`animate-pop rounded-3xl p-6 ${isTruth ? 'bg-pop-sky text-[#10202e]' : 'bg-pop-rose text-[#2a0d0a]'}`}
          >
            <p className="text-sm font-extrabold uppercase tracking-widest">
              {isTruth ? '🗣️ Verdade' : '🔥 Desafio'}
            </p>
            <p className="mt-2 font-display text-2xl font-extrabold leading-snug sm:text-3xl">
              {view.card}
            </p>
          </div>
        )}

      {view.phase === 'perform' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-200">
            {mine
              ? isTruth
                ? 'Responda em voz alta ou no chat.'
                : 'Faça o desafio na chamada ou conte no chat como foi!'
              : `Aguardando ${nick(cur)}… você já pode dizer se cumpriu.`}
          </p>
          {mine ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => act({ type: 'skip' })}>
                Passar 🐔
              </Button>
              <Button onClick={() => act({ type: 'done' })}>Pronto!</Button>
            </div>
          ) : (
            isPlayer && <JudgeButtons mine={view.myJudge} act={act} />
          )}
        </div>
      )}

      {view.phase === 'judge' &&
        (mine ? (
          <p className="text-center text-ink-200">
            A galera está julgando… ({view.judgedPlayers.length}/{view.participants.length - 1})
          </p>
        ) : isPlayer ? (
          <div className="space-y-2 text-center">
            <p className="font-bold">{nick(cur)} cumpriu?</p>
            <JudgeButtons mine={view.myJudge} act={act} center />
          </div>
        ) : null)}

      {view.phase === 'result' && view.result && (
        <p
          className={`animate-pop rounded-2xl p-4 text-center text-xl font-extrabold ${view.result.ok ? 'bg-lime-400/15 text-lime-400' : 'bg-ink-900 text-ink-200'}`}
        >
          {view.result.skipped
            ? `${nick(cur)} passou a vez 🐔`
            : view.result.ok
              ? `✅ Cumpriu! +${view.result.gained} (${view.result.yes}👍 ${view.result.no}👎)`
              : `❌ Não valeu (${view.result.yes}👍 ${view.result.no}👎)`}
        </p>
      )}
    </div>
  );
}

function JudgeButtons({
  mine,
  act,
  center,
}: {
  mine: boolean | null;
  act: (a: unknown) => unknown;
  center?: boolean;
}) {
  const base = 'rounded-2xl px-4 py-2 font-bold transition';
  return (
    <div className={`flex gap-2 ${center ? 'justify-center' : ''}`}>
      <button
        aria-pressed={mine === true}
        onClick={() => act({ type: 'judge', ok: true })}
        className={`${base} ${mine === true ? 'bg-lime-400 text-ink-950' : 'bg-ink-700 text-white hover:bg-ink-600'}`}
      >
        👍 Cumpriu
      </button>
      <button
        aria-pressed={mine === false}
        onClick={() => act({ type: 'judge', ok: false })}
        className={`${base} ${mine === false ? 'bg-pop-rose text-ink-950' : 'bg-ink-700 text-white hover:bg-ink-600'}`}
      >
        👎 Não valeu
      </button>
    </div>
  );
}
