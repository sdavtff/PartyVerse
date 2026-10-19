import type { PrismaClient } from '../../db/prisma.js';

export type FriendStatus = 'friend' | 'incoming' | 'outgoing';
export interface FriendRow {
  user: { id: string; nickname: string; avatar: string };
  status: FriendStatus;
  since: string;
}
export interface UserSummary {
  id: string;
  nickname: string;
  avatar: string;
}

export interface FriendsRepository {
  list(userId: string): Promise<FriendRow[]>;
  relation(a: string, b: string): Promise<FriendStatus | null>;
  /** Cria o pedido; se o outro já tinha pedido, vira amizade. Retorna o novo estado. */
  request(from: string, to: string): Promise<FriendStatus>;
  accept(userId: string, from: string): Promise<boolean>;
  remove(a: string, b: string): Promise<void>;
  search(q: string, exclude: string, limit: number): Promise<UserSummary[]>;
}

const summary = (u: { id: string; nickname: string; avatar: string }) => ({
  id: u.id,
  nickname: u.nickname,
  avatar: u.avatar,
});

export class PrismaFriendsRepository implements FriendsRepository {
  constructor(private db: PrismaClient) {}

  async list(userId: string) {
    const rows = await this.db.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: true, addressee: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows
      .filter((r) => !(r.requesterId === userId ? r.addressee : r.requester).banned)
      .map((r) => {
        const mine = r.requesterId === userId;
        const other = mine ? r.addressee : r.requester;
        const status: FriendStatus =
          r.status === 'accepted' ? 'friend' : mine ? 'outgoing' : 'incoming';
        return { user: summary(other), status, since: r.createdAt.toISOString() };
      });
  }

  async relation(a: string, b: string) {
    const r = await this.db.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
    if (!r) return null;
    if (r.status === 'accepted') return 'friend';
    return r.requesterId === a ? 'outgoing' : 'incoming';
  }

  async request(from: string, to: string): Promise<FriendStatus> {
    const current = await this.relation(from, to);
    if (current === 'friend' || current === 'outgoing') return current;
    if (current === 'incoming') {
      await this.accept(from, to);
      return 'friend';
    }
    await this.db.friendship.create({ data: { requesterId: from, addresseeId: to } });
    return 'outgoing';
  }

  async accept(userId: string, from: string) {
    const r = await this.db.friendship.updateMany({
      where: { requesterId: from, addresseeId: userId, status: 'pending' },
      data: { status: 'accepted' },
    });
    return r.count > 0;
  }

  async remove(a: string, b: string) {
    await this.db.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  async search(q: string, exclude: string, limit: number) {
    const rows = await this.db.user.findMany({
      where: {
        nickname: { contains: q, mode: 'insensitive' },
        id: { not: exclude },
        banned: false,
      },
      take: limit,
      orderBy: { xp: 'desc' },
    });
    return rows.map(summary);
  }
}

/** Em memória (testes). */
export class MemoryFriendsRepository implements FriendsRepository {
  rows: { requesterId: string; addresseeId: string; status: string; createdAt: string }[] = [];
  constructor(private users: () => UserSummary[]) {}
  private find(a: string, b: string) {
    return this.rows.find(
      (r) =>
        (r.requesterId === a && r.addresseeId === b) ||
        (r.requesterId === b && r.addresseeId === a),
    );
  }
  async list(userId: string) {
    const all = this.users();
    return this.rows
      .filter((r) => r.requesterId === userId || r.addresseeId === userId)
      .map((r) => {
        const mine = r.requesterId === userId;
        const otherId = mine ? r.addresseeId : r.requesterId;
        const other = all.find((u) => u.id === otherId) ?? {
          id: otherId,
          nickname: '?',
          avatar: 'blob-1',
        };
        const status: FriendStatus =
          r.status === 'accepted' ? 'friend' : mine ? 'outgoing' : 'incoming';
        return { user: other, status, since: r.createdAt };
      });
  }
  async relation(a: string, b: string) {
    const r = this.find(a, b);
    if (!r) return null;
    if (r.status === 'accepted') return 'friend';
    return r.requesterId === a ? 'outgoing' : 'incoming';
  }
  async request(from: string, to: string): Promise<FriendStatus> {
    const current = await this.relation(from, to);
    if (current === 'friend' || current === 'outgoing') return current;
    if (current === 'incoming') {
      await this.accept(from, to);
      return 'friend';
    }
    this.rows.push({
      requesterId: from,
      addresseeId: to,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    return 'outgoing';
  }
  async accept(userId: string, from: string) {
    const r = this.rows.find(
      (x) => x.requesterId === from && x.addresseeId === userId && x.status === 'pending',
    );
    if (r) r.status = 'accepted';
    return Boolean(r);
  }
  async remove(a: string, b: string) {
    this.rows = this.rows.filter((r) => r !== this.find(a, b));
  }
  async search(q: string, exclude: string, limit: number) {
    const n = q.toLowerCase();
    return this.users()
      .filter((u) => u.id !== exclude && u.nickname.toLowerCase().includes(n))
      .slice(0, limit);
  }
}
