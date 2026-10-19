import type { MatchReward } from '@partyverse/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { RewardCard } from '../components/RewardCard';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { sfx } from '../lib/sound';
import { usePageTitle } from '../lib/usePageTitle';

interface Question {
  text: string;
  options: string[];
}
interface QuizDone {
  score: number;
  answers: (number | null)[];
  solution: number[];
  questions: Question[];
}
interface StopDone {
  answers: Record<string, string>;
  score: number;
  points: Record<string, number>;
  players: number;
}
interface Status {
  day: string;
  streak: number;
  quiz: { size: number; seconds: number; done: QuizDone | null };
  stop: { letter: string; categories: string[]; seconds: number; done: StopDone | null };
}
interface RankRow {
  userId: string;
  nickname: string;
  avatar: string;
  score: number;
  place: number;
}

const OPTION_BG = ['bg-pop-sky', 'bg-pop-pink', 'bg-pop-amber', 'bg-lime-400'];
const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

export function DailyPage() {
  usePageTitle('Desafio do dia');
  const { user } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<'home' | 'quiz' | 'stop'>('home');
  const [reward, setReward] = useState<MatchReward | null>(null);
  const [rankTab, setRankTab] = useState<'quiz' | 'stop'>('quiz');
  const [rank, setRank] = useState<RankRow[] | null>(null);
  const isAccount = Boolean(user && !user.isGuest);

  const load = useCallback(() => {
    api<Status>('/daily')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  useEffect(() => {
    setRank(null);
    api<RankRow[]>(`/daily/ranking?game=${rankTab}`)
      .then(setRank)
      .catch(() => setRank([]));
  }, [rankTab, status]);

  const finished = (r: MatchReward | null, game: 'quiz' | 'stop') => {
    setReward(r);
    setMode('home');
    setRankTab(game);
    load();
  };

  if (mode === 'quiz' && status)
    return <DailyQuiz seconds={status.quiz.seconds} onDone={(r) => finished(r, 'quiz')} />;
  if (mode === 'stop' && status)
    return (
      <DailyStop
        letter={status.stop.letter}
        categories={status.stop.categories}
        seconds={status.stop.seconds}
        onDone={(r) => finished(r, 'stop')}
      />
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm font-bold uppercase tracking-widest text-lime-400">
        {status ? fmtDay(status.day) : 'Desafio do dia'}
      </p>
      <h1 className="mt-1 text-4xl font-extrabold sm:text-5xl">Desafio do dia</h1>
      <p className="mt-2 max-w-2xl text-ink-200">
        Todo dia, um Quiz e uma Adedonha novos — iguais para todo mundo. Uma tentativa só, ranking
        do dia e XP para a sua conta. Renova à meia-noite (horário de Brasília).
      </p>
      {status && status.streak > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-pop-amber/15 px-4 py-1.5 font-bold text-pop-amber">
          🔥 {status.streak} {status.streak === 1 ? 'dia seguido' : 'dias seguidos'}
        </p>
      )}
      {!isAccount && (
        <p className="mt-4 rounded-2xl bg-ink-800 p-4 text-ink-200">
          Para jogar o desafio e aparecer no ranking do dia,{' '}
          <Link to="/entrar" className="font-bold text-lime-400 hover:underline">
            entre ou crie sua conta grátis
          </Link>
          .
        </p>
      )}
      {reward && (
        <div className="mt-6 max-w-md">
          <RewardCard reward={reward} />
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="card flex flex-col p-6">
          <p className="text-4xl" aria-hidden>
            ⚡
          </p>
          <h2 className="mt-2 text-2xl font-extrabold">Quiz do dia</h2>
          <p className="mt-1 flex-1 text-ink-200">
            {status?.quiz.size ?? 10} perguntas, {status?.quiz.seconds ?? 15}s cada. 100 pontos por
            acerto.
          </p>
          {status?.quiz.done ? (
            <QuizReview done={status.quiz.done} />
          ) : (
            <Button
              className="mt-5"
              size="lg"
              disabled={!isAccount || !status}
              onClick={() => setMode('quiz')}
            >
              Começar o Quiz
            </Button>
          )}
        </section>
        <section className="card flex flex-col p-6">
          <p className="text-4xl" aria-hidden>
            🅰️
          </p>
          <h2 className="mt-2 text-2xl font-extrabold">Adedonha do dia</h2>
          <p className="mt-1 flex-1 text-ink-200">
            Letra secreta e {status?.stop.categories.length ?? 6} categorias em{' '}
            {status?.stop.seconds ?? 90}s. Resposta que só você deu vale 10; quanto mais gente
            repetir, menos vale.
          </p>
          {status?.stop.done ? (
            <div className="mt-4 space-y-2">
              <p className="font-bold">
                Letra <span className="text-lime-400">{status.stop.letter}</span> · você fez{' '}
                <span className="text-lime-400">{status.stop.done.score}</span> pontos (entre{' '}
                {status.stop.done.players} {status.stop.done.players === 1 ? 'pessoa' : 'pessoas'})
              </p>
              <ul className="grid grid-cols-2 gap-1.5 text-sm">
                {status.stop.categories.map((c) => (
                  <li key={c} className="rounded-xl bg-ink-900 px-3 py-1.5">
                    <span className="text-xs text-ink-400">{c}</span>
                    <span className="flex justify-between gap-2 font-bold">
                      <span className="truncate">{status.stop.done!.answers[c] || '—'}</span>
                      <span className="text-lime-400">{status.stop.done!.points[c] ?? 0}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-400">
                A pontuação muda ao longo do dia conforme mais gente joga.
              </p>
            </div>
          ) : (
            <Button
              className="mt-5"
              size="lg"
              disabled={!isAccount || !status}
              onClick={() => setMode('stop')}
            >
              Começar a Adedonha
            </Button>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold">Ranking de hoje</h2>
          <div className="inline-grid grid-cols-2 gap-1 rounded-2xl bg-ink-950 p-1" role="tablist">
            {(
              [
                ['quiz', 'Quiz'],
                ['stop', 'Adedonha'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={rankTab === id}
                onClick={() => setRankTab(id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${rankTab === id ? 'bg-lime-400 text-ink-950' : 'text-ink-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {rank === null ? (
          <p className="mt-4 text-ink-400">Carregando…</p>
        ) : rank.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-ink-800 p-5 text-ink-200">
            Ninguém jogou ainda hoje. Seja o primeiro!
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {rank.map((r) => (
              <li
                key={r.userId}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${r.userId === user?.id ? 'bg-lime-400/10 ring-2 ring-lime-400/50' : 'bg-ink-800'}`}
              >
                <span className="w-8 font-display text-xl font-extrabold text-ink-400">
                  {['🥇', '🥈', '🥉'][r.place - 1] ?? r.place}
                </span>
                <Avatar avatar={r.avatar} size={36} />
                <Link
                  to={`/jogador/${r.userId}`}
                  className="flex-1 truncate font-bold hover:underline"
                >
                  {r.nickname}
                </Link>
                <span className="font-display text-lg font-extrabold text-lime-400">{r.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function QuizReview({ done }: { done: QuizDone }) {
  const [open, setOpen] = useState(false);
  const correct = done.answers.filter((a, i) => a === done.solution[i]).length;
  return (
    <div className="mt-4">
      <p className="font-bold">
        Você acertou <span className="text-lime-400">{correct}</span> de {done.solution.length} ·{' '}
        <span className="text-lime-400">{done.score}</span> pontos
      </p>
      <button
        className="mt-2 text-sm font-bold text-pop-sky hover:underline"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Esconder respostas' : 'Ver respostas'}
      </button>
      {open && (
        <ol className="mt-3 space-y-2 text-sm">
          {done.questions.map((q, i) => {
            const ok = done.answers[i] === done.solution[i];
            return (
              <li key={i} className="rounded-xl bg-ink-900 p-3">
                <p className="font-bold">
                  {ok ? '✅' : '❌'} {q.text}
                </p>
                <p className="mt-1 text-ink-200">
                  Certa: <b className="text-lime-400">{q.options[done.solution[i]!]}</b>
                  {!ok && (
                    <>
                      {' '}
                      · sua:{' '}
                      {done.answers[i] == null ? 'sem resposta' : q.options[done.answers[i]!]}
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function useTimer(seconds: number, key: unknown, onEnd: () => void) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    setLeft(seconds);
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        end.current();
      }
    }, 200);
    return () => clearInterval(t);
  }, [seconds, key]);
  return left;
}

function DailyQuiz({
  seconds,
  onDone,
}: {
  seconds: number;
  onDone: (r: MatchReward | null) => void;
}) {
  const toast = useToast();
  const [qs, setQs] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const sending = useRef(false);

  useEffect(() => {
    api<Question[]>('/daily/quiz')
      .then(setQs)
      .catch((e) => toast((e as Error).message, 'error'));
  }, [toast]);

  const submit = async (all: (number | null)[]) => {
    if (sending.current) return;
    sending.current = true;
    try {
      const r = await api<{ reward: MatchReward | null }>('/daily/quiz', {
        method: 'POST',
        json: { answers: all },
      });
      sfx('win');
      onDone(r.reward);
    } catch (e) {
      toast((e as Error).message, 'error');
      onDone(null);
    }
  };
  const answer = (opt: number | null) => {
    if (!qs || answers.length > i) return;
    sfx(opt === null ? 'wrong' : 'click');
    const next = [...answers, opt];
    setAnswers(next);
    if (next.length >= qs.length) void submit(next);
    else setTimeout(() => setI((x) => x + 1), 250);
  };
  const left = useTimer(seconds, qs ? i : 'loading', () => qs && answer(null));

  if (!qs) return <p className="p-16 text-center text-ink-400">Carregando perguntas…</p>;
  const q = qs[i]!;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="card space-y-5 p-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-400">
              Quiz do dia · pergunta {i + 1} de {qs.length}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold">{q.text}</h1>
          </div>
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-ink-700 font-display text-xl font-extrabold ${left <= 5 ? 'animate-pulse text-pop-rose' : 'text-pop-sky'}`}
          >
            {left}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-900">
          <div
            className="h-full bg-pop-sky transition-all"
            style={{ width: `${(i / qs.length) * 100}%` }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {q.options.map((o, k) => (
            <button
              key={k}
              disabled={answers.length > i}
              onClick={() => answer(k)}
              className={`rounded-2xl p-4 text-left text-lg font-bold text-ink-950 shadow-chunky transition hover:-translate-y-0.5 disabled:opacity-60 ${OPTION_BG[k]}`}
            >
              {o}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-ink-400">
          As respostas certas aparecem no fim. Uma tentativa por dia!
        </p>
      </div>
    </div>
  );
}

function DailyStop({
  letter,
  categories,
  seconds,
  onDone,
}: {
  letter: string;
  categories: string[];
  seconds: number;
  onDone: (r: MatchReward | null) => void;
}) {
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const sending = useRef(false);
  const ref = useRef(answers);
  ref.current = answers;
  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      const r = await api<{ reward: MatchReward | null }>('/daily/stop', {
        method: 'POST',
        json: { answers: ref.current },
      });
      sfx('stop');
      onDone(r.reward);
    } catch (e) {
      toast((e as Error).message, 'error');
      onDone(null);
    }
  };
  const left = useTimer(seconds, 'stop', () => void submit());
  const bad = (v: string) =>
    v.trim() !== '' &&
    v
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')[0]
      ?.toUpperCase() !== letter;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <form
        className="card space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-4">
          <span className="grid h-20 w-20 shrink-0 animate-pop place-items-center rounded-3xl bg-lime-400 font-display text-5xl font-extrabold text-ink-950 shadow-chunky">
            {letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-400">Adedonha do dia</p>
            <h1 className="text-2xl font-extrabold">Tudo com a letra {letter}!</h1>
          </div>
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-ink-700 font-display text-xl font-extrabold ${left <= 10 ? 'animate-pulse text-pop-rose' : 'text-lime-400'}`}
          >
            {left}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c, i) => (
            <label key={c} className="block">
              <span className="label">{c}</span>
              <input
                className={`input py-2 ${bad(answers[c] ?? '') ? 'border-pop-rose' : ''}`}
                maxLength={40}
                autoFocus={i === 0}
                autoComplete="off"
                value={answers[c] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [c]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-400">
            Quando o tempo acabar, enviamos o que estiver escrito.
          </p>
          <Button type="submit" size="lg">
            STOP!
          </Button>
        </div>
      </form>
    </div>
  );
}
