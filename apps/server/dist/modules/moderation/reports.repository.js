const toRow = (r) => ({
    ...r,
    evidence: (r.evidence ?? []),
    status: r.status === 'closed' ? 'closed' : 'open',
    createdAt: r.createdAt.toISOString(),
});
export class PrismaReportsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(r) {
        return toRow(await this.db.report.create({ data: { ...r, evidence: r.evidence } }));
    }
    async list(status, limit) {
        const rs = await this.db.report.findMany({
            where: status === 'all' ? {} : { status },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return rs.map(toRow);
    }
    async setStatus(id, status) {
        await this.db.report.update({ where: { id }, data: { status } });
    }
    async recentDuplicate(reporterId, targetId, since) {
        return ((await this.db.report.count({
            where: { reporterId, targetId, createdAt: { gte: since } },
        })) > 0);
    }
    async openCount() {
        return this.db.report.count({ where: { status: 'open' } });
    }
}
export class MemoryReportsRepository {
    rows = [];
    async create(r) {
        const row = {
            ...r,
            id: `r${this.rows.length + 1}`,
            status: 'open',
            createdAt: new Date().toISOString(),
        };
        this.rows.unshift(row);
        return row;
    }
    async list(status, limit) {
        return this.rows.filter((r) => status === 'all' || r.status === status).slice(0, limit);
    }
    async setStatus(id, status) {
        const r = this.rows.find((x) => x.id === id);
        if (r)
            r.status = status;
    }
    async recentDuplicate(reporterId, targetId, since) {
        return this.rows.some((r) => r.reporterId === reporterId && r.targetId === targetId && new Date(r.createdAt) >= since);
    }
    async openCount() {
        return this.rows.filter((r) => r.status === 'open').length;
    }
}
