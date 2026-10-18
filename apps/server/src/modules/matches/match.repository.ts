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

export interface MatchRepository {
  save(match: MatchInput): Promise<void>;
  historyFor(userId: string, limit: number): Promise<MatchHistoryItem[]>;
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
