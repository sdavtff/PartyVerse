import { STOP_LETTERS } from '../../games/stop/stop.game.js';
import { startsWithLetter } from '../../games/stop/stop.scoring.js';
import { QUIZ_QUESTIONS } from '../../games/quiz/quiz.questions.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { normalize } from '../../lib/text.js';
import type { ChallengeStore, DailyRepository, DailyRow } from './daily.repository.js';
import {
  DAILY_QUIZ_SIZE,
  generateChallenge,
  seeded,
  seededShuffle,
  type AiOptions,
  type Challenge,
} from './generator.js';

export { DAILY_QUIZ_SIZE, seeded };
export const DAILY_QUIZ_SECONDS = 15;
export const DAILY_STOP_SECONDS = 90;

/** Dia do desafio no horário de Brasília (UTC-3), ex.: "2026-10-19". */
export function dayKey(at = Date.now()) {
  return new Date(at - 3 * 3600_000).toISOString().slice(0, 10);
}

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);

// ---------- formato antigo (resultados de antes da mudança continuam corretos) ----------

const LEGACY_STOP_POOL = [
  'Nome',
  'Animal',
  'Cidade',
  'Comida',
  'Objeto',
  'Profissão',
  'Cor',
  'Fruta',
  'Marca',
  'Filme/Série',
  'País',
  'Parte do corpo',
  'Esporte',
  'Instrumento',
];

export function legacyQuiz(day: string) {
  const rnd = seeded(`quiz:${day}`);
  return seededShuffle(QUIZ_QUESTIONS, rnd)
    .slice(0, DAILY_QUIZ_SIZE)
    .map((q) => {
      const options = seededShuffle([q.a, ...q.w], rnd);
      return { text: q.q, options, correct: options.indexOf(q.a) };
    });
}

export function legacyStop(day: string) {
  const rnd = seeded(`stop:${day}`);
  return {
    letter: STOP_LETTERS[Math.floor(rnd() * STOP_LETTERS.length)]!,
    categories: seededShuffle(LEGACY_STOP_POOL, rnd).slice(0, 6),
  };
}

// ---------- pontuação ----------

type StopData = { answers: Record<string, string>; letter?: string; categories?: string[] };
type QuizData = {
  answers: (number | null)[];
  questions?: { text: string; options: string[] }[];
  solution?: number[];
};

/**
 * Pontua a Adedonha do dia pela raridade: resposta que só você deu vale 10;
 * repetida vale menos quanto mais gente deu a mesma (mínimo 2). Inválida = 0.
 * Cada resultado guarda a letra e as categorias com que foi jogado.
 */
export function scoreStopDay(
  rows: { userId: string; data: unknown }[],
  fallback: { letter: string; categories: string[] },
) {
  const setup = (d: StopData) => ({
    letter: d.letter ?? fallback.letter,
    categories: d.categories ?? fallback.categories,
  });
  const valid = (a: string | undefined, letter: string) =>
    !!a && normalize(a).length >= 2 && startsWithLetter(a, letter);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = r.data as StopData;
    const { letter, categories } = setup(d);
    for (const c of categories)
      if (valid(d.answers?.[c], letter)) {
        const k = `${c}|${normalize(d.answers[c]!)}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
  }
  const out = new Map<string, { score: number; points: Record<string, number> }>();
  for (const r of rows) {
    const d = r.data as StopData;
    const { letter, categories } = setup(d);
    const points: Record<string, number> = {};
    let score = 0;
    for (const c of categories) {
      const a = d.answers?.[c];
      if (!valid(a, letter)) points[c] = 0;
      else {
        const n = counts.get(`${c}|${normalize(a!)}`) ?? 1;
        points[c] = n === 1 ? 10 : Math.max(2, Math.round(10 / n));
      }
      score += points[c]!;
    }
    out.set(r.userId, { score, points });
  }
  return out;
}

export interface RankRow {
  userId: string;
  nickname: string;
  avatar: string;
  score: number;
  place: number;
}

export class DailyService {
  private cache = new Map<string, Challenge>();
  private pending = new Map<string, Promise<Challenge>>();
  /** dias gerados mas ainda não guardados no banco (ex.: banco ainda conectando) */
  private unsaved = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private repo: DailyRepository,
    private store: ChallengeStore,
    private ai: AiOptions,
  ) {}

  /** Gera hoje e amanhã com antecedência (ninguém espera a IA) e repete a cada 30 min. */
  startWarmup() {
    const run = () => {
      const today = dayKey();
      void this.challenge(today)
        .then(() => this.challenge(nextDay(today)))
        .catch(() => undefined);
    };
    run();
    this.timer = setInterval(run, 30 * 60_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** O desafio de um dia: do cache, do banco de dados ou gerado agora (uma vez só). */
  async challenge(day = dayKey()): Promise<Challenge> {
    const hit = this.cache.get(day);
    if (hit) {
      const triedAt = this.unsaved.get(day);
      if (triedAt === undefined || Date.now() - triedAt < 60_000) return hit;
      // tenta guardar de novo; se outra cópia já estava salva, ela vale para todos
      this.unsaved.set(day, Date.now());
      try {
        const stored = await this.store.saveIfMissing(day, hit);
        this.unsaved.delete(day);
        this.cache.set(day, stored);
        return stored;
      } catch {
        return hit;
      }
    }
    let p = this.pending.get(day);
    if (!p) {
      p = this.load(day).finally(() => this.pending.delete(day));
      this.pending.set(day, p);
    }
    const c = await p;
    // dia futuro feito pelo banco reserva não fica fixo: a IA ainda pode gerar até ele começar
    if (c.source === 'banco' && day > dayKey()) return c;
    this.cache.set(day, c);
    if (this.cache.size > 5) this.cache.delete(this.cache.keys().next().value!);
    return c;
  }

  private async load(day: string): Promise<Challenge> {
    const stored = await this.store.get(day).catch(() => null);
    if (stored) return stored;
    const avoid = await this.store.recentQuestions(day, 14).catch(() => []);
    const fresh = await generateChallenge(day, this.ai, avoid);
    if (fresh.source === 'banco' && day > dayKey()) return fresh;
    try {
      // se outra instância salvou antes, vale a que já estava salva
      return await this.store.saveIfMissing(day, fresh);
    } catch (err) {
      logger.warn({ err: String(err) }, 'não deu para guardar o desafio do dia (tento de novo)');
      this.unsaved.set(day, Date.now());
      return fresh;
    }
  }

  async status(userId: string | null, day = dayKey()) {
    const c = await this.challenge(day);
    const [quizDone, stopDone, streak] = userId
      ? await Promise.all([
          this.repo.get(userId, day, 'quiz'),
          this.repo.get(userId, day, 'stop'),
          this.streak(userId, day),
        ])
      : [null, null, 0];
    return {
      day,
      streak,
      source: c.source,
      quiz: {
        size: c.quiz.length,
        seconds: DAILY_QUIZ_SECONDS,
        done: quizDone ? this.quizResult(day, quizDone) : null,
      },
      stop: {
        ...c.stop,
        seconds: DAILY_STOP_SECONDS,
        done: stopDone ? await this.stopResult(day, userId!) : null,
      },
    };
  }

  /** Perguntas sem a resposta certa. */
  async quizQuestions(day = dayKey()) {
    const c = await this.challenge(day);
    return c.quiz.map(({ text, options, topic }) => ({ text, options, topic }));
  }

  private quizResult(day: string, row: DailyRow) {
    const d = row.data as QuizData;
    const legacy = d.questions ? null : legacyQuiz(day);
    const questions = d.questions ?? legacy!.map(({ text, options }) => ({ text, options }));
    const solution = d.solution ?? legacy!.map((q) => q.correct);
    return { score: row.score, answers: d.answers ?? [], solution, questions };
  }

  async submitQuiz(userId: string, answers: (number | null)[], day = dayKey()) {
    const c = await this.challenge(day);
    if (answers.length !== c.quiz.length) throw new AppError('VALIDATION', 'Respostas incompletas');
    const correct = answers.filter((a, i) => a === c.quiz[i]!.correct).length;
    const data: QuizData = {
      answers,
      questions: c.quiz.map(({ text, options }) => ({ text, options })),
      solution: c.quiz.map((q) => q.correct),
    };
    const saved = await this.repo.save(userId, day, 'quiz', correct * 100, data);
    if (!saved)
      throw new AppError('INVALID_STATE', 'Você já fez o Quiz do dia. Volte amanhã!', 409);
    return this.quizResult(day, (await this.repo.get(userId, day, 'quiz'))!);
  }

  async submitStop(userId: string, answers: Record<string, string>, day = dayKey()) {
    const { letter, categories } = (await this.challenge(day)).stop;
    const clean: Record<string, string> = {};
    for (const c of categories) clean[c] = (answers[c] ?? '').trim().slice(0, 40);
    const data: StopData = { answers: clean, letter, categories };
    const saved = await this.repo.save(userId, day, 'stop', 0, data);
    if (!saved)
      throw new AppError('INVALID_STATE', 'Você já fez a Adedonha do dia. Volte amanhã!', 409);
    return this.stopResult(day, userId);
  }

  private async stopResult(day: string, userId: string) {
    const rows = await this.repo.listDay(day, 'stop');
    const scored = scoreStopDay(rows, legacyStop(day));
    const mine = rows.find((r) => r.userId === userId);
    const d = mine?.data as StopData | undefined;
    return {
      answers: d?.answers ?? {},
      letter: d?.letter ?? legacyStop(day).letter,
      categories: d?.categories ?? legacyStop(day).categories,
      ...(scored.get(userId) ?? { score: 0, points: {} }),
      players: rows.length,
    };
  }

  async ranking(game: 'quiz' | 'stop', day = dayKey(), limit = 20): Promise<RankRow[]> {
    const rows = await this.repo.listDay(day, game);
    let list = rows.map((r) => ({ ...r }));
    if (game === 'stop') {
      const scored = scoreStopDay(rows, legacyStop(day));
      list = list
        .map((r) => ({ ...r, score: scored.get(r.userId)?.score ?? 0 }))
        .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
    }
    let place = 0;
    let last = -1;
    return list.slice(0, limit).map((r, i) => {
      if (r.score !== last) place = i + 1;
      last = r.score;
      return { userId: r.userId, nickname: r.nickname, avatar: r.avatar, score: r.score, place };
    });
  }

  async counts(day = dayKey()) {
    const [quiz, stop, c] = await Promise.all([
      this.repo.listDay(day, 'quiz'),
      this.repo.listDay(day, 'stop'),
      this.challenge(day).catch(() => null),
    ]);
    return { day, quiz: quiz.length, stop: stop.length, source: c?.source ?? null };
  }

  /** Sequência de dias seguidos com algum desafio feito. */
  async streak(userId: string, today = dayKey()) {
    const days = new Set(await this.repo.days(userId));
    let n = 0;
    let d = new Date(`${today}T12:00:00Z`);
    if (!days.has(today)) d = new Date(d.getTime() - 86400_000);
    while (days.has(d.toISOString().slice(0, 10))) {
      n++;
      d = new Date(d.getTime() - 86400_000);
    }
    return n;
  }
}
