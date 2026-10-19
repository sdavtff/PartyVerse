import bcrypt from 'bcryptjs';
import { AppError } from '../../lib/errors.js';
import { guestId, pick } from '../../lib/ids.js';
export const AVATARS = ['blob', 'star', 'bolt', 'moon', 'leaf', 'drop'];
export const randomAvatar = () => `${pick(AVATARS)}-${1 + Math.floor(Math.random() * 6)}`;
export const toIdentity = (u) => ({
    id: u.id,
    nickname: u.nickname,
    avatar: u.avatar,
    isGuest: false,
});
export class AuthService {
    users;
    constructor(users) {
        this.users = users;
    }
    repo() {
        if (!this.users)
            throw new AppError('INTERNAL', 'Contas indisponíveis: banco de dados não configurado. Entre como convidado.', 503);
        return this.users;
    }
    guest(nickname, avatar) {
        return { id: guestId(), nickname, avatar: avatar ?? randomAvatar(), isGuest: true };
    }
    async register(email, password, nickname) {
        const repo = this.repo();
        const normalized = email.toLowerCase();
        if (await repo.findByEmail(normalized))
            throw new AppError('VALIDATION', 'Este e-mail já está cadastrado', 409);
        const passwordHash = await bcrypt.hash(password, 12);
        return toIdentity(await repo.create({ email: normalized, passwordHash, nickname, avatar: randomAvatar() }));
    }
    async login(email, password) {
        const u = await this.repo().findByEmail(email.toLowerCase());
        // comparação sempre executada para não vazar existência de conta por tempo de resposta
        const ok = await bcrypt.compare(password, u?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
        if (!u || !ok)
            throw new AppError('UNAUTHORIZED', 'E-mail ou senha incorretos', 401);
        return toIdentity(u);
    }
}
