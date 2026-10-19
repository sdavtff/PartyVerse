const toRecord = (u) => ({
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    googleId: u.googleId,
    nickname: u.nickname,
    avatar: u.avatar,
    preferences: (u.preferences ?? {}),
    banned: u.banned ?? false,
    createdAt: u.createdAt?.toISOString(),
});
export class PrismaUserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findByEmail(email) {
        const u = await this.db.user.findUnique({ where: { email } });
        return u ? toRecord(u) : null;
    }
    async findById(id) {
        const u = await this.db.user.findUnique({ where: { id } });
        return u ? toRecord(u) : null;
    }
    async findByGoogleId(googleId) {
        const u = await this.db.user.findUnique({ where: { googleId } });
        return u ? toRecord(u) : null;
    }
    async create(data) {
        return toRecord(await this.db.user.create({ data: { ...data, stats: { create: {} } } }));
    }
    async linkGoogle(id, googleId) {
        return toRecord(await this.db.user.update({ where: { id }, data: { googleId } }));
    }
    async update(id, data) {
        return toRecord(await this.db.user.update({
            where: { id },
            data: { ...data, preferences: data.preferences },
        }));
    }
    async stats(id) {
        const s = await this.db.userStats.findUnique({ where: { userId: id } });
        return s ?? { matchesPlayed: 0, wins: 0, totalScore: 0, bestScore: 0 };
    }
    async setPassword(id, passwordHash) {
        await this.db.user.update({ where: { id }, data: { passwordHash } });
    }
    async setBanned(id, banned) {
        await this.db.user.update({ where: { id }, data: { banned } });
    }
    async bannedIds() {
        return (await this.db.user.findMany({ where: { banned: true }, select: { id: true } })).map((u) => u.id);
    }
    async adminSearch(q, limit) {
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
    async counts(since) {
        const [total, recent] = await Promise.all([
            this.db.user.count(),
            this.db.user.count({ where: { createdAt: { gte: since } } }),
        ]);
        return { total, recent };
    }
}
/** Implementação em memória: usada em testes e quando não há DATABASE_URL. */
export class MemoryUserRepository {
    users = new Map();
    statsMap = new Map();
    async findByEmail(email) {
        return [...this.users.values()].find((u) => u.email === email) ?? null;
    }
    async findById(id) {
        return this.users.get(id) ?? null;
    }
    async findByGoogleId(googleId) {
        return [...this.users.values()].find((u) => u.googleId === googleId) ?? null;
    }
    async create(data) {
        const u = {
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
    async linkGoogle(id, googleId) {
        const u = { ...this.users.get(id), googleId };
        this.users.set(id, u);
        return u;
    }
    async update(id, data) {
        const u = { ...this.users.get(id), ...data };
        this.users.set(id, u);
        return u;
    }
    async stats(id) {
        return this.statsMap.get(id) ?? { matchesPlayed: 0, wins: 0, totalScore: 0, bestScore: 0 };
    }
    async setPassword(id, passwordHash) {
        this.users.set(id, { ...this.users.get(id), passwordHash });
    }
    async setBanned(id, banned) {
        this.users.set(id, { ...this.users.get(id), banned });
    }
    async bannedIds() {
        return [...this.users.values()].filter((u) => u.banned).map((u) => u.id);
    }
    async adminSearch(q, limit) {
        const n = q.toLowerCase();
        return [...this.users.values()]
            .filter((u) => !n || u.nickname.toLowerCase().includes(n) || u.email.includes(n))
            .reverse()
            .slice(0, limit);
    }
    async counts(since) {
        const all = [...this.users.values()];
        return {
            total: all.length,
            recent: all.filter((u) => (u.createdAt ? new Date(u.createdAt) >= since : true)).length,
        };
    }
}
