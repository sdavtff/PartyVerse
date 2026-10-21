import { WEEKLY_PRIZES } from '@partyverse/shared';
import type { PrismaClient } from '../../db/prisma.js';
import { logger } from '../../lib/logger.js';
import type { MatchRepository } from '../matches/match.repository.js';
import type { ProgressService } from '../progress/progress.service.js';

const DAY = 86400_000;
/** Segunda-feira 00:00 (horário de Brasília) da semana de `at`. */
export function weekStart(at = Date.now()) {
  const brt = new Date(at - 3 * 3600_000);
  const dow = (brt.getUTCDay() + 6) % 7; // 0 = segunda
  const monday = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) - dow * DAY;
  return new Date(monday + 3 * 3600_000);
}
export const weekKey = (start: Date) =>
  new Date(start.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

export interface AwardRow {
  week: string;
  userId: string;
  place: number;
  coins: number;
}
export interface AwardStore {
  forWeek(week: string): Promise<AwardRow[]>;
  /** grava se a posição ainda não foi premiada; devolve false se já existia */
  add(a: AwardRow): Promise<boolean>;
}

export class PrismaAwardStore implements AwardStore {
  constructor(private db: PrismaClient) {}
  async forWeek(week: string) {
    return this.db.weeklyAward.findMany({ where: { week }, orderBy: { place: 'asc' } });
  }
  async add(a: AwardRow) {
    try {
      await this.db.weeklyAward.create({ data: a });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return false;
      throw e;
    }
  }
}
export class MemoryAwardStore implements AwardStore {
  rows: AwardRow[] = [];
  async forWeek(week: string) {
    return this.rows.filter((r) => r.week === week).sort((a, b) => a.place - b.place);
  }
  async add(a: AwardRow) {
    if (this.rows.some((r) => r.week === a.week && r.place === a.place)) return false;
    this.rows.push(a);
    return true;
  }
}

/** Torneio da semana: ranking de vitórias de segunda a domingo; os 3 primeiros ganham prêmio. */
export class TournamentService {
  private timer: NodeJS.Timeout | null = null;
  constructor(
    private matches: MatchRepository,
    private awards: AwardStore,
    private progress?: ProgressService,
  ) {}

  async standings(limit = 20, now = Date.now()) {
    const start = weekStart(now);
    const rows = (await this.matches.leaderboard(null, limit, start)).filter((r) => r.matches > 0);
    const prev = new Date(start.getTime() - 7 * DAY);
    const winners = await this.awards.forWeek(weekKey(prev)).catch(() => []);
    return {
      week: weekKey(start),
      endsAt: new Date(start.getTime() + 7 * DAY).toISOString(),
      prizes: WEEKLY_PRIZES,
      rows,
      lastWinners: winners,
    };
  }

  /** Paga os prêmios da semana anterior (uma vez só, mesmo com várias instâncias). */
  async payout(now = Date.now()) {
    const end = weekStart(now);
    const start = new Date(end.getTime() - 7 * DAY);
    const week = weekKey(start);
    if ((await this.awards.forWeek(week)).length >= WEEKLY_PRIZES.length) return [];
    const top = (await this.matches.leaderboard(null, WEEKLY_PRIZES.length, start, end)).filter(
      (r) => r.wins > 0,
    );
    const paid: AwardRow[] = [];
    for (const [i, row] of top.entries()) {
      const prize = WEEKLY_PRIZES[i]!;
      const a = { week, userId: row.userId, place: prize.place, coins: prize.coins };
      if (!(await this.awards.add(a))) continue;
      paid.push(a);
      await this.progress?.giveCoins(row.userId, prize.coins);
      if (prize.items.length) await this.progress?.giveItems(row.userId, prize.items);
      await this.progress?.unlock(row.userId, 'weekly_podium');
    }
    if (paid.length) logger.info({ week, paid: paid.length }, 'torneio da semana: prêmios pagos');
    return paid;
  }

  start() {
    const run = () => void this.payout().catch(() => undefined);
    run();
    this.timer = setInterval(run, 30 * 60_000);
    this.timer.unref?.();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
