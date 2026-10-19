import type { PrismaClient } from '../../db/prisma.js';

/** Tokens de "esqueci minha senha" (só o hash fica guardado). */
export interface ResetRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Usa o token: devolve o dono se válido (não usado e não vencido) e invalida os demais. */
  consume(tokenHash: string, now: Date): Promise<string | null>;
  recentCount(userId: string, since: Date): Promise<number>;
}

export class PrismaResetRepository implements ResetRepository {
  constructor(private db: PrismaClient) {}
  async create(userId: string, tokenHash: string, expiresAt: Date) {
    await this.db.passwordReset.create({ data: { userId, tokenHash, expiresAt } });
  }
  async consume(tokenHash: string, now: Date) {
    const r = await this.db.passwordReset.findUnique({ where: { tokenHash } });
    if (!r || r.usedAt || r.expiresAt < now) return null;
    await this.db.passwordReset.updateMany({
      where: { userId: r.userId, usedAt: null },
      data: { usedAt: now },
    });
    return r.userId;
  }
  async recentCount(userId: string, since: Date) {
    return this.db.passwordReset.count({ where: { userId, createdAt: { gte: since } } });
  }
}

export class MemoryResetRepository implements ResetRepository {
  rows: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }[] = [];
  async create(userId: string, tokenHash: string, expiresAt: Date) {
    this.rows.push({ userId, tokenHash, expiresAt, usedAt: null, createdAt: new Date() });
  }
  async consume(tokenHash: string, now: Date) {
    const r = this.rows.find((x) => x.tokenHash === tokenHash);
    if (!r || r.usedAt || r.expiresAt < now) return null;
    for (const x of this.rows) if (x.userId === r.userId && !x.usedAt) x.usedAt = now;
    return r.userId;
  }
  async recentCount(userId: string, since: Date) {
    return this.rows.filter((r) => r.userId === userId && r.createdAt >= since).length;
  }
}
