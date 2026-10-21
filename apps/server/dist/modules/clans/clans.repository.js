const toRow = (c) => ({
    id: c.id,
    name: c.name,
    tag: c.tag,
    emoji: c.emoji,
    description: c.description,
    ownerId: c.ownerId,
    createdAt: c.createdAt.toISOString(),
    members: c.members
        .map((m) => ({
        userId: m.userId,
        nickname: m.user.nickname,
        avatar: m.user.avatar,
        role: (m.role === 'owner' ? 'owner' : 'member'),
        joinedAt: m.joinedAt.toISOString(),
    }))
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
});
const INCLUDE = {
    members: { include: { user: { select: { nickname: true, avatar: true } } } },
};
export class PrismaClansRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(c) {
        const clan = await this.db.clan.create({
            data: { ...c, members: { create: { userId: c.ownerId, role: 'owner' } } },
            include: INCLUDE,
        });
        return toRow(clan);
    }
    async byTag(tag) {
        const c = await this.db.clan.findUnique({ where: { tag }, include: INCLUDE });
        return c ? toRow(c) : null;
    }
    async ofUser(userId) {
        const m = await this.db.clanMember.findUnique({
            where: { userId },
            include: { clan: { include: INCLUDE } },
        });
        return m ? toRow(m.clan) : null;
    }
    async list(limit) {
        return (await this.db.clan.findMany({ include: INCLUDE, take: limit, orderBy: { createdAt: 'asc' } })).map(toRow);
    }
    async addMember(clanId, userId, role = 'member') {
        await this.db.clanMember.create({ data: { clanId, userId, role } });
    }
    async removeMember(clanId, userId) {
        await this.db.clanMember.deleteMany({ where: { clanId, userId } });
    }
    async setOwner(clanId, userId) {
        await this.db.$transaction([
            this.db.clanMember.updateMany({ where: { clanId }, data: { role: 'member' } }),
            this.db.clanMember.updateMany({ where: { clanId, userId }, data: { role: 'owner' } }),
            this.db.clan.update({ where: { id: clanId }, data: { ownerId: userId } }),
        ]);
    }
    async remove(clanId) {
        await this.db.clan.delete({ where: { id: clanId } });
    }
}
export class MemoryClansRepository {
    user;
    clans = [];
    members = [];
    constructor(user) {
        this.user = user;
    }
    full(c) {
        return {
            ...c,
            members: this.members
                .filter((m) => m.clanId === c.id)
                .map((m) => ({
                ...m,
                nickname: this.user(m.userId)?.nickname ?? '?',
                avatar: this.user(m.userId)?.avatar ?? 'blob-1',
            })),
        };
    }
    async create(c) {
        if (this.clans.some((x) => x.tag === c.tag))
            throw Object.assign(new Error('dup'), { code: 'P2002' });
        const row = { ...c, id: `c${this.clans.length + 1}`, createdAt: new Date().toISOString() };
        this.clans.push(row);
        this.members.push({
            clanId: row.id,
            userId: c.ownerId,
            role: 'owner',
            joinedAt: new Date().toISOString(),
        });
        return this.full(row);
    }
    async byTag(tag) {
        const c = this.clans.find((x) => x.tag === tag);
        return c ? this.full(c) : null;
    }
    async ofUser(userId) {
        const m = this.members.find((x) => x.userId === userId);
        const c = m && this.clans.find((x) => x.id === m.clanId);
        return c ? this.full(c) : null;
    }
    async list(limit) {
        return this.clans.slice(0, limit).map((c) => this.full(c));
    }
    async addMember(clanId, userId, role = 'member') {
        if (this.members.some((m) => m.userId === userId))
            throw Object.assign(new Error('dup'), { code: 'P2002' });
        this.members.push({ clanId, userId, role, joinedAt: new Date().toISOString() });
    }
    async removeMember(clanId, userId) {
        this.members = this.members.filter((m) => !(m.clanId === clanId && m.userId === userId));
    }
    async setOwner(clanId, userId) {
        for (const m of this.members)
            if (m.clanId === clanId)
                m.role = m.userId === userId ? 'owner' : 'member';
        const c = this.clans.find((x) => x.id === clanId);
        if (c)
            c.ownerId = userId;
    }
    async remove(clanId) {
        this.clans = this.clans.filter((c) => c.id !== clanId);
        this.members = this.members.filter((m) => m.clanId !== clanId);
    }
}
