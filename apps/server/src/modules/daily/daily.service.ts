import { STOP_LETTERS } from '../../games/stop/stop.game.js';
import { startsWithLetter } from '../../games/stop/stop.scoring.js';
import { QUIZ_QUESTIONS } from '../../games/quiz/quiz.questions.js';
import { AppError } from '../../lib/errors.js';
import { chatJson } from '../../lib/openrouter.js';
import { normalize } from '../../lib/text.js';
import type { DailyRepository, DailyRow } from './daily.repository.js';

export const DAILY_QUIZ_SIZE = 10;
export const DAILY_QUIZ_SECONDS = 15;
export const DAILY_STOP_SECONDS = 90;
const STOP_POOL = [
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
const STOP_CATEGORIES = 6;

type AiQuizQ = { text: string; options: string[]; correct: number };
type AiStop = { letter: string; categories: string[] };

const quizCache = new Map<string, AiQuizQ[]>();
const stopCache = new Map<string, AiStop>();

let aiCfg: { apiKey?: string; model: string } = {
  model: 'minimax/minimax-m3.1-flash:free',
};

/** Chamar uma vez no boot com as variáveis de ambiente. */
export function configureDailyAi(cfg: { apiKey?: string; model?: string }) {
  aiCfg = {
    apiKey: cfg.apiKey,
    model: cfg.model || 'minimax/minimax-m3.1-flash:free',
  };
}

/** Dia do desafio no horário de Brasília (UTC-3), ex.: "2026-10-19". */
export function dayKey(at = Date.now()) {
  return new Date(at - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Gerador pseudoaleatório com semente: todo mundo recebe o mesmo desafio no mesmo dia. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(xs: readonly T[], rnd: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function generateQuizAi(day: string): Promise<AiQuizQ[] | null> {
  const system = `Você gera perguntas de quiz em português do Brasil para um jogo casual multiplayer.
Responda APENAS JSON válido no formato:
{"questions":[{"text":"...","options":["A","B","C","D"],"correct":0}]}
Regras:
- Exatamente ${DAILY_QUIZ_SIZE} perguntas
- correct = índice (0-3) da opção certa
- Temas variados: Brasil, cultura pop, ciência, futebol, história, curiosidades, anime, games, música
- Nível fácil/médio, sem controvérsia política ou conteúdo adulto
- Opções curtas (máximo ~40 caracteres)
- Perguntas diferentes a cada dia; seja criativo`;

  const user = `Gere o Quiz do dia ${day}. Dez perguntas inéditas e divertidas.`;

  const data = await chatJson<{ questions: AiQuizQ[] }>(aiCfg, system, user);
  if (!data?.questions?.length || data.questions.length < DAILY_QUIZ_SIZE) return null;

  return data.questions.slice(0, DAILY_QUIZ_SIZE).map((q) => {
    const options = (q.options ?? []).map((o) => String(o).slice(0, 60)).slice(0, 4);
    while (options.length < 4) options.push('—');
    const correct = Math.min(3, Math.max(0, Number(q.correct) || 0));
    return { text: String(q.text).slice(0, 200), options, correct };
  });
}

async function generateStopAi(day: string): Promise<AiStop | null> {
  const system = `Você define a Adedonha (STOP) do dia em português do Brasil.
Responda APENAS JSON válido:
{"letter":"A","categories":["Nome","Animal","Cidade","Comida","Objeto","Profissão"]}
Regras:
- letter: UMA letra maiúscula de A a Z, EXCETO K, Q, W, X, Y, Z
- categories: exatamente 6 categorias curtas e divertidas (máximo 20 caracteres cada)
- Prefira categorias criativas quando fizer sentido (ex: "App", "Meme", "Time de futebol", "Personagem de série")
- Adequado para todas as idades`;

  const user = `Adedonha do dia ${day}. Seja criativo.`;

  const data = await chatJson<AiStop>(aiCfg, system, user);
  if (!data?.letter || !Array.isArray(data.categories) || data.categories.length < 6) return null;

  const letter = String(data.letter).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
  if (!letter || 'KQWX YZ'.includes(letter)) return null;

  return {
    letter,
    categories: data.categories.slice(0, 6).map((c) => String(c).slice(0, 24)),
  };
}

/** Quiz do dia: IA se disponível, senão banco fixo com semente. */
export async function dailyQuiz(day: string): Promise<AiQuizQ[]> {
  const hit = quizCache.get(day);
  if (hit) return hit;

  const ai = await generateQuizAi(day);
  if (ai) {
    quizCache.set(day, ai);
    return ai;
  }

  // fallback (comportamento antigo)
  const rnd = seeded(`quiz:${day}`);
  const fallback = seededShuffle(QUIZ_QUESTIONS, rnd)
    .slice(0, DAILY_QUIZ_SIZE)
    .map((q) => {
      const options = seededShuffle([q.a, ...q.w], rnd);
      return { text: q.q, options, correct: options.indexOf(q.a) };
    });
  quizCache.set(day, fallback);
  return fallback;
}

export async function dailyStop(day: string): Promise<AiStop> {
  const hit = stopCache.get(day);
  if (hit) return hit;

  const ai = await generateStopAi(day);
  if (ai) {
    stopCache.set(day, ai);
    return ai;
  }

  const rnd = seeded(`stop:${day}`);
  const fallback = {
    letter: STOP_LETTERS[Math.floor(rnd() * STOP_LETTERS.length)]!,
    categories: seededShuffle(STOP_POOL, rnd).slice(0, STOP_CATEGORIES),
  };
  stopCache.set(day, fallback);
  return fallback;
}

type StopData = { answers: Record<string, string> };

/**
 * Pontua a Adedonha do dia pela raridade: resposta que só você deu vale 10;
 * repetida vale menos quanto mais gente deu a mesma (mínimo 2). Inválida = 0.
 */
export function scoreStopDay(
  rows: { userId: string; data: unknown }[],
  letter: string,
  categories: string[],
) {
  const counts = new Map<string, number>();
  const valid = (a: string | undefined) =>
    !!a && normalize(a).length >= 2 && startsWithLetter(a, letter);
  for (const r of rows) {
    const ans = (r.data as StopData).answers ?? {};
    for (const c of categories)
      if (valid(ans[c])) {
        const k = `${c}|${normalize(ans[c]!)}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
  }
  const out = new Map<string, { score: number; points: Record<string, number> }>();
  for (const r of rows) {
    const ans = (r.data as StopData).answers ?? {};
    const points: Record<string, number> = {};
    let score = 0;
    for (const c of categories) {
      const a = ans[c];
      if (!valid(a)) points[c] = 0;
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
  constructor(private repo: DailyRepository) {}

  async status(userId: string | null, day = dayKey()) {
    const stop = await dailyStop(day);
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
      quiz: {
        size: DAILY_QUIZ_SIZE,
        seconds: DAILY_QUIZ_SECONDS,
        done: quizDone ? await this.quizResult(day, quizDone) : null,
      },
      stop: {
        ...stop,
        seconds: DAILY_STOP_SECONDS,
        done: stopDone ? await this.stopResult(day, userId!) : null,
      },
    };
  }

  /** Perguntas sem a resposta certa. */
  async quizQuestions(day = dayKey()) {
    const qs = await dailyQuiz(day);
    return qs.map(({ text, options }) => ({ text, options }));
  }

  private async quizResult(day: string, row: DailyRow) {
    const qs = await dailyQuiz(day);
    const answers = (row.data as { answers: (number | null)[] }).answers ?? [];
    return {
      score: row.score,
      answers,
      solution: qs.map((q) => q.correct),
      questions: qs.map(({ text, options }) => ({ text, options })),
    };
  }

  async submitQuiz(userId: string, answers: (number | null)[], day = dayKey()) {
    const qs = await dailyQuiz(day);
    if (answers.length !== qs.length) throw new AppError('VALIDATION', 'Respostas incompletas');
    const correct = answers.filter((a, i) => a === qs[i]!.correct).length;
    const saved = await this.repo.save(userId, day, 'quiz', correct * 100, { answers });
    if (!saved)
      throw new AppError('INVALID_STATE', 'Você já fez o Quiz do dia. Volte amanhã!', 409);
    return this.quizResult(day, (await this.repo.get(userId, day, 'quiz'))!);
  }

  async submitStop(userId: string, answers: Record<string, string>, day = dayKey()) {
    const { categories } = await dailyStop(day);
    const clean: Record<string, string> = {};
    for (const c of categories) clean[c] = (answers[c] ?? '').trim().slice(0, 40);
    const saved = await this.repo.save(userId, day, 'stop', 0, { answers: clean });
    if (!saved)
      throw new AppError('INVALID_STATE', 'Você já fez a Adedonha do dia. Volte amanhã!', 409);
    return this.stopResult(day, userId);
  }

  private async stopResult(day: string, userId: string) {
    const { letter, categories } = await dailyStop(day);
    const rows = await this.repo.listDay(day, 'stop');
    const scored = scoreStopDay(rows, letter, categories);
    const mine = rows.find((r) => r.userId === userId);
    return {
      answers: (mine?.data as StopData | undefined)?.answers ?? {},
      ...(scored.get(userId) ?? { score: 0, points: {} }),
      players: rows.length,
    };
  }

  async ranking(game: 'quiz' | 'stop', day = dayKey(), limit = 20): Promise<RankRow[]> {
    const rows = await this.repo.listDay(day, game);
    let list = rows.map((r) => ({ ...r }));
    if (game === 'stop') {
      const { letter, categories } = await dailyStop(day);
      const scored = scoreStopDay(rows, letter, categories);
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
    const [quiz, stop] = await Promise.all([
      this.repo.listDay(day, 'quiz'),
      this.repo.listDay(day, 'stop'),
    ]);
    return { day, quiz: quiz.length, stop: stop.length };
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
