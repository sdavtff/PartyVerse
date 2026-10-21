import type { PrismaClient } from '../../db/prisma.js';
import type { Challenge } from './generator.js';

export interface DailyRow {
  userId: string;
  nickname: string;
  avatar: string;
  score: number;
  data: unknown;
  createdAt: string;
}

export interface DailyRepository {
  get(userId: string, day: string, game: string): Promise<DailyRow | null>;
  /** Salva; devolve false se a pessoa já tinha jogado hoje. */
  save(userId: string, day: string, game: string, score: number, data: unknown): Promise<boolean>;
  listDay(day: string, game: string): Promise<DailyRow[]>;
  /** Cria ou atualiza (jogos com várias jogadas no dia, como o Termo). */
  upsert(userId: string, day: string, game: string, score: number, data: unknown): Promise<void>;
  /** Dias seguidos com desafio feito, terminando hoje ou ontem. */
  days(userId: string): Promise<string[]>;
}

export class PrismaDailyRepository implements DailyRepository {
  constructor(private db: PrismaClient) {}
  private row = (r: {
    userId: string;
    score: number;
    data: unknown;
    createdAt: Date;
    user: { nickname: string; avatar: string };
  }): DailyRow => ({
    userId: r.userId,
    nickname: r.user.nickname,
    avatar: r.user.avatar,
    score: r.score,
    data: r.data,
    createdAt: r.createdAt.toISOString(),
  });
  async get(userId: string, day: string, game: string) {
    const r = await this.db.dailyResult.findUnique({
      where: { userId_day_game: { userId, day, game } },
      include: { user: { select: { nickname: true, avatar: true } } },
    });
    return r ? this.row(r) : null;
  }
  async save(userId: string, day: string, game: string, score: number, data: unknown) {
    try {
      await this.db.dailyResult.create({
        data: { userId, day, game, score, data: data as object },
      });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return false;
      throw e;
    }
  }
  async upsert(userId: string, day: string, game: string, score: number, data: unknown) {
    await this.db.dailyResult.upsert({
      where: { userId_day_game: { userId, day, game } },
      create: { userId, day, game, score, data: data as object },
      update: { score, data: data as object },
    });
  }
  async listDay(day: string, game: string) {
    const rs = await this.db.dailyResult.findMany({
      where: { day, game, user: { banned: false } },
      include: { user: { select: { nickname: true, avatar: true } } },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      take: 5000,
    });
    return rs.map(this.row);
  }
  async days(userId: string) {
    const rs = await this.db.dailyResult.findMany({
      where: { userId },
      select: { day: true },
      distinct: ['day'],
      orderBy: { day: 'desc' },
      take: 400,
    });
    return rs.map((r) => r.day);
  }
}

export class MemoryDailyRepository implements DailyRepository {
  rows: (DailyRow & { day: string; game: string })[] = [];
  constructor(private users: (id: string) => { nickname: string; avatar: string } | undefined) {}
  async get(userId: string, day: string, game: string) {
    return this.rows.find((r) => r.userId === userId && r.day === day && r.game === game) ?? null;
  }
  async save(userId: string, day: string, game: string, score: number, data: unknown) {
    if (await this.get(userId, day, game)) return false;
    const u = this.users(userId) ?? { nickname: '?', avatar: 'blob-1' };
    this.rows.push({ userId, day, game, score, data, createdAt: new Date().toISOString(), ...u });
    return true;
  }
  async upsert(userId: string, day: string, game: string, score: number, data: unknown) {
    const r = await this.get(userId, day, game);
    if (r) {
      const row = this.rows.find((x) => x.userId === userId && x.day === day && x.game === game)!;
      row.score = score;
      row.data = data;
    } else await this.save(userId, day, game, score, data);
  }
  async listDay(day: string, game: string) {
    return this.rows
      .filter((r) => r.day === day && r.game === game)
      .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
  }
  async days(userId: string) {
    return [...new Set(this.rows.filter((r) => r.userId === userId).map((r) => r.day))]
      .sort()
      .reverse();
  }
}

// ---------- conteúdo de cada dia ----------

/** Guarda o desafio de cada dia, para que seja o mesmo para todos (e só gere uma vez). */
export interface ChallengeStore {
  get(day: string): Promise<Challenge | null>;
  /** Salva se ainda não existir; devolve o que ficou guardado. */
  saveIfMissing(day: string, c: Challenge): Promise<Challenge>;
  /** Textos das perguntas dos últimos dias (para a IA não repetir). */
  recentQuestions(before: string, days: number): Promise<string[]>;
}

const asChallenge = (source: string, data: unknown): Challenge => ({
  ...(data as Omit<Challenge, 'source'>),
  source: source === 'ia' ? 'ia' : 'banco',
});

export class PrismaChallengeStore implements ChallengeStore {
  constructor(private db: PrismaClient) {}
  async get(day: string) {
    const r = await this.db.dailyChallenge.findUnique({ where: { day } });
    return r ? asChallenge(r.source, r.data) : null;
  }
  async saveIfMissing(day: string, c: Challenge) {
    const { source, ...data } = c;
    await this.db.dailyChallenge.createMany({
      data: [{ day, source, data: data as object }],
      skipDuplicates: true,
    });
    return (await this.get(day)) ?? c;
  }
  async recentQuestions(before: string, days: number) {
    const rs = await this.db.dailyChallenge.findMany({
      where: { day: { lt: before } },
      orderBy: { day: 'desc' },
      take: days,
    });
    return rs.flatMap((r) => asChallenge(r.source, r.data).quiz.map((q) => q.text));
  }
}

export class MemoryChallengeStore implements ChallengeStore {
  rows = new Map<string, Challenge>();
  async get(day: string) {
    return this.rows.get(day) ?? null;
  }
  async saveIfMissing(day: string, c: Challenge) {
    if (!this.rows.has(day)) this.rows.set(day, c);
    return this.rows.get(day)!;
  }
  async recentQuestions(before: string, days: number) {
    return [...this.rows.entries()]
      .filter(([d]) => d < before)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, days)
      .flatMap(([, c]) => c.quiz.map((q) => q.text));
  }
}
