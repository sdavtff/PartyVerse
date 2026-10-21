import { z } from 'zod';
import { STOP_LETTERS } from '../../games/stop/stop.game.js';
import { logger } from '../../lib/logger.js';
import { chatJson } from '../../lib/openrouter.js';
import { normalize } from '../../lib/text.js';
import { DAILY_QUESTIONS, DAILY_STOP_CATEGORIES } from './daily.bank.js';

export const DAILY_QUIZ_SIZE = 10;
export const DAILY_STOP_SIZE = 6;

export interface ChallengeQuestion {
  text: string;
  options: string[];
  correct: number;
  topic: string;
}
export interface Challenge {
  source: 'ia' | 'banco';
  quiz: ChallengeQuestion[];
  stop: { letter: string; categories: string[] };
}

/** Gerador pseudoaleatório com semente: o mesmo dia dá sempre o mesmo resultado. */
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

export function seededShuffle<T>(xs: readonly T[], rnd: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Número do dia desde 2026-01-01 (para o rodízio do banco reserva). */
export const dayIndex = (day: string) =>
  Math.floor((Date.parse(`${day}T12:00:00Z`) - Date.parse('2026-01-01T12:00:00Z')) / 86400_000);

/**
 * Pega `size` itens de um rodízio: a lista é embaralhada a cada volta completa e os dias
 * vão consumindo em sequência. Nada se repete até a lista inteira ter saído.
 */
export function rotation<T>(list: readonly T[], day: string, size: number, salt: string): T[] {
  if (!list.length) return [];
  const start = Math.max(0, dayIndex(day)) * size;
  const out: T[] = [];
  // na virada de uma volta para a outra, pula o que já saiu neste mesmo dia
  for (let k = start; out.length < Math.min(size, list.length); k++) {
    const cycle = Math.floor(k / list.length);
    const item = seededShuffle(list, seeded(`${salt}:${cycle}`))[k % list.length]!;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function letterFor(day: string) {
  const rnd = seeded(`letter:${day}`);
  return STOP_LETTERS[Math.floor(rnd() * STOP_LETTERS.length)]!;
}

/** Desafio sem IA: banco exclusivo do desafio, em rodízio. */
export function bankChallenge(day: string): Challenge {
  const rnd = seeded(`opts:${day}`);
  return {
    source: 'banco',
    quiz: rotation(DAILY_QUESTIONS, day, DAILY_QUIZ_SIZE, 'quiz').map((q) => {
      const options = seededShuffle([q.a, ...q.w], rnd);
      return { text: q.q, options, correct: options.indexOf(q.a), topic: q.topic };
    }),
    stop: {
      letter: letterFor(day),
      categories: rotation(DAILY_STOP_CATEGORIES, day, DAILY_STOP_SIZE, 'stop'),
    },
  };
}

// ---------- IA ----------

const aiSchema = z.object({
  perguntas: z
    .array(
      z.object({
        tema: z.string().min(2).max(40),
        pergunta: z.string().min(8).max(200),
        certa: z.string().min(1).max(70),
        erradas: z.array(z.string().min(1).max(70)).length(3),
      }),
    )
    .min(DAILY_QUIZ_SIZE),
  categorias: z.array(z.string().min(2).max(30)).min(DAILY_STOP_SIZE),
});

const THEMES = [
  'curiosidades sobre animais',
  'ciência do dia a dia',
  'geografia do Brasil',
  'história do Brasil',
  'geografia do mundo',
  'história mundial',
  'corpo humano e saúde',
  'tecnologia e internet',
  'culinária brasileira e do mundo',
  'cinema, séries e desenhos',
  'música brasileira',
  'esportes',
  'língua portuguesa e literatura',
  'espaço e astronomia',
  'natureza e plantas',
  'matemática rápida',
  'invenções e inventores',
  'arte e museus',
  'folclore e cultura brasileira',
  'games',
];

export function buildPrompt(day: string, letter: string, avoid: string[]) {
  const themes = seededShuffle(THEMES, seeded(`themes:${day}`)).slice(0, 5);
  return [
    `Crie o "Desafio do dia" de ${day} para um site brasileiro de jogos em grupo (público de todas as idades).`,
    '',
    `1) ${DAILY_QUIZ_SIZE} perguntas de quiz, de múltipla escolha, em português do Brasil, misturando estes temas: ${themes.join(', ')}.`,
    'Regras das perguntas:',
    '- Fatos verdadeiros, estáveis e verificáveis (nada que mude com o tempo, nada de "atual", "hoje", recordes recentes, cargos ou preços).',
    '- Uma única resposta certa, sem ambiguidade; 3 alternativas erradas plausíveis, do mesmo tipo da certa e diferentes entre si.',
    '- Variedade de dificuldade (fáceis, médias e algumas difíceis). Respostas curtas (até 6 palavras).',
    '- Nada ofensivo, político, religioso ou impróprio para crianças.',
    avoid.length
      ? `- Não repita estas perguntas de dias anteriores: ${avoid.slice(0, 60).join(' | ')}`
      : '',
    '',
    `2) ${DAILY_STOP_SIZE + 2} categorias criativas de Adedonha (STOP) para a letra "${letter}": cada categoria deve ter várias respostas possíveis começando com "${letter}" em português. Misture categorias clássicas e diferentes (ex.: "Coisa que tem na praia", "Profissão", "Doce"). Até 3 palavras cada.`,
    '',
    'Responda SOMENTE com JSON válido, sem texto extra, neste formato:',
    '{"perguntas":[{"tema":"...","pergunta":"...","certa":"...","erradas":["...","...","..."]}],"categorias":["..."]}',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** Confere e organiza a resposta da IA. Lança erro se não der para aproveitar. */
export function parseAi(raw: unknown, day: string, letter: string): Challenge {
  const data = aiSchema.parse(raw);
  const rnd = seeded(`ai-opts:${day}`);
  const seen = new Set<string>();
  const quiz: ChallengeQuestion[] = [];
  for (const p of data.perguntas) {
    const all = [p.certa, ...p.erradas].map((x) => x.trim());
    if (new Set(all.map(normalize)).size !== 4) continue; // alternativas repetidas
    const key = normalize(p.pergunta);
    if (seen.has(key)) continue;
    seen.add(key);
    const options = seededShuffle(all, rnd);
    quiz.push({
      text: p.pergunta.trim(),
      options,
      correct: options.indexOf(p.certa.trim()),
      topic: p.tema.trim(),
    });
    if (quiz.length === DAILY_QUIZ_SIZE) break;
  }
  if (quiz.length < DAILY_QUIZ_SIZE) throw new Error('perguntas válidas insuficientes');
  const categories = [
    ...new Set(data.categorias.map((c) => c.trim()).filter((c) => c.length >= 2)),
  ].slice(0, DAILY_STOP_SIZE);
  if (categories.length < DAILY_STOP_SIZE) throw new Error('categorias insuficientes');
  return { source: 'ia', quiz, stop: { letter, categories } };
}

export interface AiOptions {
  apiKey?: string;
  model: string;
  /** para testes */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  referer?: string;
  baseUrl?: string;
}

const SYSTEM =
  'Você cria o conteúdo diário de um site brasileiro de jogos em grupo, para todas as idades. ' +
  'Escreve em português do Brasil, confere os fatos com cuidado e responde APENAS com JSON válido.';

/** Gera o desafio com IA (OpenRouter); sem chave ou se algo falhar, usa o banco reserva. */
export async function generateChallenge(
  day: string,
  ai: AiOptions,
  avoid: string[] = [],
): Promise<Challenge> {
  if (!ai.apiKey) return bankChallenge(day);
  const letter = letterFor(day);
  const prompt = buildPrompt(day, letter, avoid);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await chatJson<unknown>(
      {
        apiKey: ai.apiKey,
        model: ai.model,
        fetchFn: ai.fetchFn,
        referer: ai.referer,
        baseUrl: ai.baseUrl,
      },
      SYSTEM,
      prompt,
      ai.timeoutMs ?? 60_000,
    );
    if (!raw) continue;
    try {
      const challenge = parseAi(raw, day, letter);
      logger.info({ day, model: ai.model }, 'desafio do dia gerado por IA');
      return challenge;
    } catch (err) {
      logger.warn({ day, attempt, err: String(err) }, 'resposta da IA não aproveitável');
    }
  }
  logger.warn({ day }, 'desafio do dia: IA indisponível, usando o banco reserva');
  return bankChallenge(day);
}
