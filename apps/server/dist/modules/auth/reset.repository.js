export class PrismaResetRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(userId, tokenHash, expiresAt) {
        await this.db.passwordReset.create({ data: { userId, tokenHash, expiresAt } });
    }
    async consume(tokenHash, now) {
        const r = await this.db.passwordReset.findUnique({ where: { tokenHash } });
        if (!r || r.usedAt || r.expiresAt < now)
            return null;
        await this.db.passwordReset.updateMany({
            where: { userId: r.userId, usedAt: null },
            data: { usedAt: now },
        });
        return r.userId;
    }
    async recentCount(userId, since) {
        return this.db.passwordReset.count({ where: { userId, createdAt: { gte: since } } });
    }
}
export class MemoryResetRepository {
    rows = [];
    async create(userId, tokenHash, expiresAt) {
        this.rows.push({ userId, tokenHash, expiresAt, usedAt: null, createdAt: new Date() });
    }
    async consume(tokenHash, now) {
        const r = this.rows.find((x) => x.tokenHash === tokenHash);
        if (!r || r.usedAt || r.expiresAt < now)
            return null;
        for (const x of this.rows)
            if (x.userId === r.userId && !x.usedAt)
                x.usedAt = now;
        return r.userId;
    }
    async recentCount(userId, since) {
        return this.rows.filter((r) => r.userId === userId && r.createdAt >= since).length;
    }
}
