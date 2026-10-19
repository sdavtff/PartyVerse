import type { PrismaClient } from '../../db/prisma.js';

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
