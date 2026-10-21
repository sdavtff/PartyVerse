import type { PrismaClient } from '../../db/prisma.js';

export interface ReportInput {
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  targetIsGuest: boolean;
  roomCode: string | null;
  reason: string;
  details: string;
  evidence: { text: string; at: number }[];
}
export interface ReportRow extends ReportInput {
  id: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface ReportsRepository {
  create(r: ReportInput): Promise<ReportRow>;
  list(status: 'open' | 'closed' | 'all', limit: number): Promise<ReportRow[]>;
  setStatus(id: string, status: 'open' | 'closed'): Promise<void>;
  /** denúncias abertas recentes do mesmo autor contra o mesmo alvo (evita repetição) */
  recentDuplicate(reporterId: string, targetId: string, since: Date): Promise<boolean>;
  openCount(): Promise<number>;
}

type Db = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  targetIsGuest: boolean;
  roomCode: string | null;
  reason: string;
  details: string;
  evidence: unknown;
  status: string;
  createdAt: Date;
};
const toRow = (r: Db): ReportRow => ({
  ...r,
  evidence: (r.evidence ?? []) as ReportRow['evidence'],
  status: r.status === 'closed' ? 'closed' : 'open',
  createdAt: r.createdAt.toISOString(),
});

export class PrismaReportsRepository implements ReportsRepository {
  constructor(private db: PrismaClient) {}
  async create(r: ReportInput) {
    return toRow(await this.db.report.create({ data: { ...r, evidence: r.evidence } }));
  }
  async list(status: 'open' | 'closed' | 'all', limit: number) {
    const rs = await this.db.report.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rs.map(toRow);
  }
  async setStatus(id: string, status: 'open' | 'closed') {
    await this.db.report.update({ where: { id }, data: { status } });
  }
  async recentDuplicate(reporterId: string, targetId: string, since: Date) {
    return (
      (await this.db.report.count({
        where: { reporterId, targetId, createdAt: { gte: since } },
      })) > 0
    );
  }
  async openCount() {
    return this.db.report.count({ where: { status: 'open' } });
  }
}

export class MemoryReportsRepository implements ReportsRepository {
  rows: ReportRow[] = [];
  async create(r: ReportInput) {
    const row: ReportRow = {
      ...r,
      id: `r${this.rows.length + 1}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.rows.unshift(row);
    return row;
  }
  async list(status: 'open' | 'closed' | 'all', limit: number) {
    return this.rows.filter((r) => status === 'all' || r.status === status).slice(0, limit);
  }
  async setStatus(id: string, status: 'open' | 'closed') {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.status = status;
  }
  async recentDuplicate(reporterId: string, targetId: string, since: Date) {
    return this.rows.some(
      (r) =>
        r.reporterId === reporterId && r.targetId === targetId && new Date(r.createdAt) >= since,
    );
  }
  async openCount() {
    return this.rows.filter((r) => r.status === 'open').length;
  }
}
