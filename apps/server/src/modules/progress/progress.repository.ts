import type { PrismaClient } from '../../db/prisma.js';
import type { MemoryMatchRepository } from '../matches/match.repository.js';

export interface ProgressRepository {
  getXp(userId: string): Promise<number>;
  addXp(userId: string, amount: number): Promise<number>;
  achievements(userId: string): Promise<{ code: string; unlockedAt: string }[]>;
  /** Insere as que ainda não existem; devolve só as novas. */
  addAchievements(userId: string, codes: string[]): Promise<string[]>;
  stats(userId: string): Promise<{ matchesPlayed: number; wins: number }>;
  distinctGames(userId: string): Promise<number>;
}

export class PrismaProgressRepository implements ProgressRepository {
  constructor(private db: PrismaClient) {}
  async getXp(userId: string) {
    return (
      (await this.db.user.findUnique({ where: { id: userId }, select: { xp: true } }))?.xp ?? 0
    );
  }
  async addXp(userId: string, amount: number) {
    const u = await this.db.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
      select: { xp: true },
    });
    return u.xp;
  }
  async achievements(userId: string) {
    const rows = await this.db.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'asc' },
    });
    return rows.map((r) => ({ code: r.code, unlockedAt: r.unlockedAt.toISOString() }));
  }
  async addAchievements(userId: string, codes: string[]) {
    if (!codes.length) return [];
    const have = new Set((await this.achievements(userId)).map((a) => a.code));
    const fresh = codes.filter((c) => !have.has(c));
    if (fresh.length)
      await this.db.userAchievement.createMany({
        data: fresh.map((code) => ({ userId, code })),
        skipDuplicates: true,
      });
    return fresh;
  }
  async stats(userId: string) {
    const s = await this.db.userStats.findUnique({ where: { userId } });
    return { matchesPlayed: s?.matchesPlayed ?? 0, wins: s?.wins ?? 0 };
  }
  async distinctGames(userId: string) {
    const rows = await this.db.match.findMany({
      where: { participants: { some: { userId } } },
      distinct: ['gameId'],
      select: { gameId: true },
    });
    return rows.length;
  }
}

/** Em memória (testes e servidor sem banco). */
export class MemoryProgressRepository implements ProgressRepository {
  xp = new Map<string, number>();
  ach = new Map<string, { code: string; unlockedAt: string }[]>();
  constructor(private matches?: MemoryMatchRepository) {}
  async getXp(userId: string) {
    return this.xp.get(userId) ?? 0;
  }
  async addXp(userId: string, amount: number) {
    const v = (this.xp.get(userId) ?? 0) + amount;
    this.xp.set(userId, v);
    return v;
  }
  async achievements(userId: string) {
    return this.ach.get(userId) ?? [];
  }
  async addAchievements(userId: string, codes: string[]) {
    const list = this.ach.get(userId) ?? [];
    const fresh = codes.filter((c) => !list.some((a) => a.code === c));
    for (const code of fresh) list.push({ code, unlockedAt: new Date().toISOString() });
    this.ach.set(userId, list);
    return fresh;
  }
  async stats(userId: string) {
    const mine = (this.matches?.saved ?? []).flatMap((m) =>
      m.participants.filter((p) => p.userId === userId),
    );
    return { matchesPlayed: mine.length, wins: mine.filter((p) => p.place === 1).length };
  }
  async distinctGames(userId: string) {
    return new Set(
      (this.matches?.saved ?? [])
        .filter((m) => m.participants.some((p) => p.userId === userId))
        .map((m) => m.gameId),
    ).size;
  }
}
