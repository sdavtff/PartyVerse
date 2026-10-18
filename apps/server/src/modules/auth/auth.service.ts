import bcrypt from 'bcryptjs';
import { AppError } from '../../lib/errors.js';
import { guestId, pick } from '../../lib/ids.js';
import type { UserRepository, UserRecord } from '../users/users.repository.js';
import type { Identity } from './token.js';

export const AVATARS = ['blob', 'star', 'bolt', 'moon', 'leaf', 'drop'] as const;
export const randomAvatar = () => `${pick(AVATARS)}-${1 + Math.floor(Math.random() * 6)}`;

export const toIdentity = (u: UserRecord): Identity => ({
  id: u.id,
  nickname: u.nickname,
  avatar: u.avatar,
  isGuest: false,
});

export class AuthService {
  constructor(private users: UserRepository | null) {}

  private repo(): UserRepository {
    if (!this.users)
      throw new AppError(
        'INTERNAL',
        'Contas indisponíveis: banco de dados não configurado. Entre como convidado.',
        503,
      );
    return this.users;
  }

  guest(nickname: string): Identity {
    return { id: guestId(), nickname, avatar: randomAvatar(), isGuest: true };
  }

  async register(email: string, password: string, nickname: string): Promise<Identity> {
    const repo = this.repo();
    const normalized = email.toLowerCase();
    if (await repo.findByEmail(normalized))
      throw new AppError('VALIDATION', 'Este e-mail já está cadastrado', 409);
    const passwordHash = await bcrypt.hash(password, 12);
    return toIdentity(
      await repo.create({ email: normalized, passwordHash, nickname, avatar: randomAvatar() }),
    );
  }

  async login(email: string, password: string): Promise<Identity> {
    const u = await this.repo().findByEmail(email.toLowerCase());
    // comparação sempre executada para não vazar existência de conta por tempo de resposta
    const ok = await bcrypt.compare(
      password,
      u?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
    );
    if (!u || !ok) throw new AppError('UNAUTHORIZED', 'E-mail ou senha incorretos', 401);
    return toIdentity(u);
  }
}
