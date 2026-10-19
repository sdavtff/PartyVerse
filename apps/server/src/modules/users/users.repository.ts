import type { PrismaClient } from '../../db/prisma.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  googleId: string | null;
  nickname: string;
  avatar: string;
  preferences: Record<string, unknown>;
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
}

const toRecord = (u: {
  id: string;
  email: string;
  passwordHash: string;
  googleId: string | null;
  nickname: string;
  avatar: string;
  preferences: unknown;
}): UserRecord => ({
  ...u,
  preferences: (u.preferences ?? {}) as Record<string, unknown>,
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
}
