export class PrismaDailyRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    row = (r) => ({
        userId: r.userId,
        nickname: r.user.nickname,
        avatar: r.user.avatar,
        score: r.score,
        data: r.data,
        createdAt: r.createdAt.toISOString(),
    });
    async get(userId, day, game) {
        const r = await this.db.dailyResult.findUnique({
            where: { userId_day_game: { userId, day, game } },
            include: { user: { select: { nickname: true, avatar: true } } },
        });
        return r ? this.row(r) : null;
    }
    async save(userId, day, game, score, data) {
        try {
            await this.db.dailyResult.create({
                data: { userId, day, game, score, data: data },
            });
            return true;
        }
        catch (e) {
            if (e.code === 'P2002')
                return false;
            throw e;
        }
    }
    async listDay(day, game) {
        const rs = await this.db.dailyResult.findMany({
            where: { day, game, user: { banned: false } },
            include: { user: { select: { nickname: true, avatar: true } } },
            orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
            take: 5000,
        });
        return rs.map(this.row);
    }
    async days(userId) {
        const rs = await this.db.dailyResult.findMany({
            where: { userId },
            select: { day: true },
            distinct: ['day'],
            orderBy: { day: 'desc' },
            take: 400,
        });
        return rs.map((r) => r.day);
    }
}
export class MemoryDailyRepository {
    users;
    rows = [];
    constructor(users) {
        this.users = users;
    }
    async get(userId, day, game) {
        return this.rows.find((r) => r.userId === userId && r.day === day && r.game === game) ?? null;
    }
    async save(userId, day, game, score, data) {
        if (await this.get(userId, day, game))
            return false;
        const u = this.users(userId) ?? { nickname: '?', avatar: 'blob-1' };
        this.rows.push({ userId, day, game, score, data, createdAt: new Date().toISOString(), ...u });
        return true;
    }
    async listDay(day, game) {
        return this.rows
            .filter((r) => r.day === day && r.game === game)
            .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
    }
    async days(userId) {
        return [...new Set(this.rows.filter((r) => r.userId === userId).map((r) => r.day))]
            .sort()
            .reverse();
    }
}
