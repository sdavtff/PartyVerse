import type { PrismaClient } from '../../db/prisma.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  googleId: string | null;
  nickname: string;
  avatar: string;
  preferences: Record<string, unknown>;
  banned?: boolean;
  createdAt?: string;
}

export interface UserStatsRecord {
  matchesPlayed: number;
  wins: number;
  totalScore: number;
  bestScore: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserRecord | null>;
  create(data: {
    email: string;
    passwordHash: string;
    nickname: string;
    avatar: string;
    googleId?: string;
  }): Promise<UserRecord>;
  linkGoogle(id: string, googleId: string): Promise<UserRecord>;
  update(
    id: string,
    data: Partial<Pick<UserRecord, 'nickname' | 'avatar' | 'preferences'>>,
  ): Promise<UserRecord>;
  stats(id: string): Promise<UserStatsRecord>;
  setPassword(id: string, passwordHash: string): Promise<void>;
  setBanned(id: string, banned: boolean): Promise<void>;
  bannedIds(): Promise<string[]>;
  /** Busca para o painel de administração (apelido ou e-mail). */
  adminSearch(q: string, limit: number): Promise<UserRecord[]>;
  counts(since: Date): Promise<{ total: number; recent: number }>;
}

const toRecord = (u: {
  id: string;
  email: string;
  passwordHash: string;
  googleId: string | null;
  nickname: string;
  avatar: string;
  preferences: unknown;
  banned?: boolean;
  createdAt?: Date;
}): UserRecord => ({
  id: u.id,
  email: u.email,
  passwordHash: u.passwordHash,
  googleId: u.googleId,
  nickname: u.nickname,
  avatar: u.avatar,
  preferences: (u.preferences ?? {}) as Record<string, unknown>,
  banned: u.banned ?? false,
  createdAt: u.createdAt?.toISOString(),
});

export class PrismaUserRepository implements UserRepository {
  constructor(private db: PrismaClient) {}
  async findByEmail(email: string) {
    const u = await this.db.user.findUnique({ where: { email } });
    return u ? toRecord(u) : null;
  }
  async findById(id: string) {
    const u = await this.db.user.findUnique({ where: { id } });
    return u ? toRecord(u) : null;
  }
  async findByGoogleId(googleId: string) {
    const u = await this.db.user.findUnique({ where: { googleId } });
    return u ? toRecord(u) : null;
  }
  async create(data: {
    email: string;
    passwordHash: string;
    nickname: string;
    avatar: string;
    googleId?: string;
  }) {
    return toRecord(await this.db.user.create({ data: { ...data, stats: { create: {} } } }));
  }
  async linkGoogle(id: string, googleId: string) {
    return toRecord(await this.db.user.update({ where: { id }, data: { googleId } }));
  }
  async update(id: string, data: Partial<Pick<UserRecord, 'nickname' | 'avatar' | 'preferences'>>) {
    return toRecord(
      await this.db.user.update({
        where: { id },
        data: { ...data, preferences: data.preferences as object | undefined },
      }),
    );
  }
  async stats(id: string) {
    const s = await this.db.userStats.findUnique({ where: { userId: id } });
    return s ?? { matchesPlayed: 0, wins: 0, totalScore: 0, bestScore: 0 };
  }
  async setPassword(id: string, passwordHash: string) {
    await this.db.user.update({ where: { id }, data: { passwordHash } });
  }
  async setBanned(id: string, banned: boolean) {
    await this.db.user.update({ where: { id }, data: { banned } });
  }
  async bannedIds() {
    return (await this.db.user.findMany({ where: { banned: true }, select: { id: true } })).map(
      (u) => u.id,
    );
  }
  async adminSearch(q: string, limit: number) {
    const rs = await this.db.user.findMany({
      where: q
        ? {
            OR: [
              { nickname: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rs.map(toRecord);
  }
  async counts(since: Date) {
    const [total, recent] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { createdAt: { gte: since } } }),
    ]);
    return { total, recent };
  }
}

/** Implementação em memória: usada em testes e quando não há DATABASE_URL. */
export class MemoryUserRepository implements UserRepository {
  users = new Map<string, UserRecord>();
  statsMap = new Map<string, UserStatsRecord>();
  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByGoogleId(googleId: string) {
    return [...this.users.values()].find((u) => u.googleId === googleId) ?? null;
  }
  async create(data: {
    email: string;
    passwordHash: string;
    nickname: string;
    avatar: string;
    googleId?: string;
  }) {
    const u: UserRecord = {
      id: 'u_' + (this.users.size + 1),
      preferences: {},
      ...data,
      googleId: data.googleId ?? null,
      banned: false,
      createdAt: new Date().toISOString(),
    };
    this.users.set(u.id, u);
    return u;
  }
  async linkGoogle(id: string, googleId: string) {
    const u = { ...this.users.get(id)!, googleId };
    this.users.set(id, u);
    return u;
  }
  async update(id: string, data: Partial<Pick<UserRecord, 'nickname' | 'avatar' | 'preferences'>>) {
    const u = { ...this.users.get(id)!, ...data };
    this.users.set(id, u);
    return u;
  }
  async stats(id: string) {
    return this.statsMap.get(id) ?? { matchesPlayed: 0, wins: 0, totalScore: 0, bestScore: 0 };
  }
  async setPassword(id: string, passwordHash: string) {
    this.users.set(id, { ...this.users.get(id)!, passwordHash });
  }
  async setBanned(id: string, banned: boolean) {
    this.users.set(id, { ...this.users.get(id)!, banned });
  }
  async bannedIds() {
    return [...this.users.values()].filter((u) => u.banned).map((u) => u.id);
  }
  async adminSearch(q: string, limit: number) {
    const n = q.toLowerCase();
    return [...this.users.values()]
      .filter((u) => !n || u.nickname.toLowerCase().includes(n) || u.email.includes(n))
      .reverse()
      .slice(0, limit);
  }
  async counts(since: Date) {
    const all = [...this.users.values()];
    return {
      total: all.length,
      recent: all.filter((u) => (u.createdAt ? new Date(u.createdAt) >= since : true)).length,
    };
  }
}
