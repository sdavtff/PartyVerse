export class PrismaProgressRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getXp(userId) {
        return ((await this.db.user.findUnique({ where: { id: userId }, select: { xp: true } }))?.xp ?? 0);
    }
    async addXp(userId, amount) {
        const u = await this.db.user.update({
            where: { id: userId },
            data: { xp: { increment: amount } },
            select: { xp: true },
        });
        return u.xp;
    }
    async achievements(userId) {
        const rows = await this.db.userAchievement.findMany({
            where: { userId },
            orderBy: { unlockedAt: 'asc' },
        });
        return rows.map((r) => ({ code: r.code, unlockedAt: r.unlockedAt.toISOString() }));
    }
    async addAchievements(userId, codes) {
        if (!codes.length)
            return [];
        const have = new Set((await this.achievements(userId)).map((a) => a.code));
        const fresh = codes.filter((c) => !have.has(c));
        if (fresh.length)
            await this.db.userAchievement.createMany({
                data: fresh.map((code) => ({ userId, code })),
                skipDuplicates: true,
            });
        return fresh;
    }
    async stats(userId) {
        const s = await this.db.userStats.findUnique({ where: { userId } });
        return { matchesPlayed: s?.matchesPlayed ?? 0, wins: s?.wins ?? 0 };
    }
    async distinctGames(userId) {
        const rows = await this.db.match.findMany({
            where: { participants: { some: { userId } } },
            distinct: ['gameId'],
            select: { gameId: true },
        });
        return rows.length;
    }
}
/** Em memória (testes e servidor sem banco). */
export class MemoryProgressRepository {
    matches;
    xp = new Map();
    ach = new Map();
    constructor(matches) {
        this.matches = matches;
    }
    async getXp(userId) {
        return this.xp.get(userId) ?? 0;
    }
    async addXp(userId, amount) {
        const v = (this.xp.get(userId) ?? 0) + amount;
        this.xp.set(userId, v);
        return v;
    }
    async achievements(userId) {
        return this.ach.get(userId) ?? [];
    }
    async addAchievements(userId, codes) {
        const list = this.ach.get(userId) ?? [];
        const fresh = codes.filter((c) => !list.some((a) => a.code === c));
        for (const code of fresh)
            list.push({ code, unlockedAt: new Date().toISOString() });
        this.ach.set(userId, list);
        return fresh;
    }
    async stats(userId) {
        const mine = (this.matches?.saved ?? []).flatMap((m) => m.participants.filter((p) => p.userId === userId));
        return { matchesPlayed: mine.length, wins: mine.filter((p) => p.place === 1).length };
    }
    async distinctGames(userId) {
        return new Set((this.matches?.saved ?? [])
            .filter((m) => m.participants.some((p) => p.userId === userId))
            .map((m) => m.gameId)).size;
    }
}
