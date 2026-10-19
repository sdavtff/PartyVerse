const toRecord = (u) => ({
    ...u,
    preferences: (u.preferences ?? {}),
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
}
