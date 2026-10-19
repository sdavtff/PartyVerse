import type { PrismaClient } from '../../db/prisma.js';

export interface MatchParticipantInput {
  userId: string | null;
  nickname: string;
  score: number;
  place: number;
  isGuest: boolean;
}

export interface MatchInput {
  gameId: string;
  roomCode: string;
  rounds: number;
  startedAt: Date;
  endedAt: Date;
  participants: MatchParticipantInput[];
}

export interface MatchHistoryItem {
  matchId: string;
  gameId: string;
  endedAt: string;
  score: number;
  place: number;
  players: number;
}

export interface LeaderboardRow {
  userId: string;
  nickname: string;
  avatar: string;
  matches: number;
  wins: number;
  score: number;
}

export interface MatchRepository {
  save(match: MatchInput): Promise<void>;
  historyFor(userId: string, limit: number): Promise<MatchHistoryItem[]>;
  /** Ranking de contas registradas (vitórias, depois pontos), opcionalmente de um jogo. */
  leaderboard(gameId: string | null, limit: number, since?: Date): Promise<LeaderboardRow[]>;
}

export class PrismaMatchRepository implements MatchRepository {
  constructor(private db: PrismaClient) {}

  async save(m: MatchInput) {
    const registered = m.participants.filter((p) => p.userId);
    await this.db.$transaction(async (tx) => {
      await tx.match.create({
        data: {
          gameId: m.gameId,
          roomCode: m.roomCode,
          rounds: m.rounds,
          startedAt: m.startedAt,
          endedAt: m.endedAt,
          participants: { create: m.participants },
        },
      });
      for (const p of registered) {
        const s = await tx.userStats.upsert({
          where: { userId: p.userId! },
          create: {
            userId: p.userId!,
            matchesPlayed: 1,
            wins: p.place === 1 ? 1 : 0,
            totalScore: p.score,
            bestScore: p.score,
          },
          update: {
            matchesPlayed: { increment: 1 },
            wins: { increment: p.place === 1 ? 1 : 0 },
            totalScore: { increment: p.score },
          },
        });
        if (p.score > s.bestScore)
          await tx.userStats.update({ where: { userId: p.userId! }, data: { bestScore: p.score } });
      }
    });
  }

  async leaderboard(gameId: string | null, limit: number, since?: Date): Promise<LeaderboardRow[]> {
    const from = since ?? new Date(0);
    const rows = await this.db.$queryRaw<LeaderboardRow[]>`
      SELECT p."userId" AS "userId", u.nickname, u.avatar,
             COUNT(*)::int AS matches,
             SUM(CASE WHEN p.place = 1 THEN 1 ELSE 0 END)::int AS wins,
             COALESCE(SUM(p.score), 0)::int AS score
      FROM "MatchParticipant" p
      JOIN "Match" m ON m.id = p."matchId"
      JOIN "User" u ON u.id = p."userId"
      WHERE p."userId" IS NOT NULL AND (${gameId}::text IS NULL OR m."gameId" = ${gameId})
        AND m."endedAt" >= ${from}
        AND u.banned = false
      GROUP BY p."userId", u.nickname, u.avatar
      ORDER BY wins DESC, score DESC
      LIMIT ${limit}`;
    return rows;
  }

  async historyFor(userId: string, limit: number) {
    const rows = await this.db.matchParticipant.findMany({
      where: { userId },
      orderBy: { match: { endedAt: 'desc' } },
      take: limit,
      include: { match: { include: { _count: { select: { participants: true } } } } },
    });
    return rows.map((r) => ({
      matchId: r.matchId,
      gameId: r.match.gameId,
      endedAt: r.match.endedAt.toISOString(),
      score: r.score,
      place: r.place,
      players: r.match._count.participants,
    }));
  }
}

export class MemoryMatchRepository implements MatchRepository {
  async leaderboard(gameId: string | null, limit: number, since?: Date) {
    const rows = new Map<string, LeaderboardRow>();
    for (const m of this.saved) {
      if (gameId && m.gameId !== gameId) continue;
      if (since && m.endedAt < since) continue;
      for (const p of m.participants) {
        if (!p.userId) continue;
        const r = rows.get(p.userId) ?? {
          userId: p.userId,
          nickname: p.nickname,
          avatar: 'blob-1',
          matches: 0,
          wins: 0,
          score: 0,
        };
        r.matches += 1;
        r.wins += p.place === 1 ? 1 : 0;
        r.score += p.score;
        rows.set(p.userId, r);
      }
    }
    return [...rows.values()].sort((a, b) => b.wins - a.wins || b.score - a.score).slice(0, limit);
  }

  saved: MatchInput[] = [];
  async save(m: MatchInput) {
    this.saved.push(m);
  }
  async historyFor(userId: string, limit: number) {
    return this.saved
      .filter((m) => m.participants.some((p) => p.userId === userId))
      .reverse()
      .slice(0, limit)
      .map((m, i) => {
        const me = m.participants.find((p) => p.userId === userId)!;
        return {
          matchId: String(i),
          gameId: m.gameId,
          endedAt: m.endedAt.toISOString(),
          score: me.score,
          place: me.place,
          players: m.participants.length,
        };
      });
  }
}
