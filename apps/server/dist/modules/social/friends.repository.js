const summary = (u) => ({
    id: u.id,
    nickname: u.nickname,
    avatar: u.avatar,
});
export class PrismaFriendsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(userId) {
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
            const status = r.status === 'accepted' ? 'friend' : mine ? 'outgoing' : 'incoming';
            return { user: summary(other), status, since: r.createdAt.toISOString() };
        });
    }
    async relation(a, b) {
        const r = await this.db.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: a, addresseeId: b },
                    { requesterId: b, addresseeId: a },
                ],
            },
        });
        if (!r)
            return null;
        if (r.status === 'accepted')
            return 'friend';
        return r.requesterId === a ? 'outgoing' : 'incoming';
    }
    async request(from, to) {
        const current = await this.relation(from, to);
        if (current === 'friend' || current === 'outgoing')
            return current;
        if (current === 'incoming') {
            await this.accept(from, to);
            return 'friend';
        }
        await this.db.friendship.create({ data: { requesterId: from, addresseeId: to } });
        return 'outgoing';
    }
    async accept(userId, from) {
        const r = await this.db.friendship.updateMany({
            where: { requesterId: from, addresseeId: userId, status: 'pending' },
            data: { status: 'accepted' },
        });
        return r.count > 0;
    }
    async remove(a, b) {
        await this.db.friendship.deleteMany({
            where: {
                OR: [
                    { requesterId: a, addresseeId: b },
                    { requesterId: b, addresseeId: a },
                ],
            },
        });
    }
    async search(q, exclude, limit) {
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
export class MemoryFriendsRepository {
    users;
    rows = [];
    constructor(users) {
        this.users = users;
    }
    find(a, b) {
        return this.rows.find((r) => (r.requesterId === a && r.addresseeId === b) ||
            (r.requesterId === b && r.addresseeId === a));
    }
    async list(userId) {
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
            const status = r.status === 'accepted' ? 'friend' : mine ? 'outgoing' : 'incoming';
            return { user: other, status, since: r.createdAt };
        });
    }
    async relation(a, b) {
        const r = this.find(a, b);
        if (!r)
            return null;
        if (r.status === 'accepted')
            return 'friend';
        return r.requesterId === a ? 'outgoing' : 'incoming';
    }
    async request(from, to) {
        const current = await this.relation(from, to);
        if (current === 'friend' || current === 'outgoing')
            return current;
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
    async accept(userId, from) {
        const r = this.rows.find((x) => x.requesterId === from && x.addresseeId === userId && x.status === 'pending');
        if (r)
            r.status = 'accepted';
        return Boolean(r);
    }
    async remove(a, b) {
        this.rows = this.rows.filter((r) => r !== this.find(a, b));
    }
    async search(q, exclude, limit) {
        const n = q.toLowerCase();
        return this.users()
            .filter((u) => u.id !== exclude && u.nickname.toLowerCase().includes(n))
            .slice(0, limit);
    }
}
