import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { nicknameFrom, type GoogleProfile } from './google.js';
import { dbStatus, withTimeout } from '../../db/status.js';
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

export const notBanned = (u: UserRecord) => {
  if (u.banned) throw new AppError('FORBIDDEN', 'Esta conta foi suspensa.', 403);
  return u;
};

export class AuthService {
  constructor(private users: UserRepository | null) {}

  private repo(): UserRepository {
    if (!this.users)
      throw new AppError(
        'INTERNAL',
        'Contas indisponíveis: banco de dados não configurado. Entre como convidado.',
        503,
      );
    if (dbStatus.state === 'error')
      throw new AppError(
        'INTERNAL',
        'Contas fora do ar no momento (sem conexão com o banco de dados). Jogue como convidado e tente mais tarde.',
        503,
      );
    return this.users;
  }

  /** Nenhuma operação de conta fica "carregando" para sempre. */
  private guard<T>(p: Promise<T>): Promise<T> {
    return withTimeout(
      p,
      12_000,
      () =>
        new AppError(
          'INTERNAL',
          'O banco de dados demorou para responder. Tente de novo em instantes ou jogue como convidado.',
          503,
        ),
    );
  }

  guest(nickname: string, avatar?: string): Identity {
    return { id: guestId(), nickname, avatar: avatar ?? randomAvatar(), isGuest: true };
  }

  register(email: string, password: string, nickname: string, avatar?: string) {
    return this.guard(this.doRegister(email, password, nickname, avatar));
  }

  login(email: string, password: string) {
    return this.guard(this.doLogin(email, password));
  }

  private async doRegister(
    email: string,
    password: string,
    nickname: string,
    avatar?: string,
  ): Promise<Identity> {
    const repo = this.repo();
    const normalized = email.toLowerCase();
    if (await repo.findByEmail(normalized))
      throw new AppError('VALIDATION', 'Este e-mail já está cadastrado', 409);
    const passwordHash = await bcrypt.hash(password, 12);
    return toIdentity(
      await repo.create({
        email: normalized,
        passwordHash,
        nickname,
        avatar: avatar ?? randomAvatar(),
      }),
    );
  }

  /** Entra (ou cria a conta) com o perfil do Google. Liga a uma conta existente do mesmo e-mail. */
  google(profile: GoogleProfile, avatar?: string) {
    return this.guard(this.doGoogle(profile, avatar));
  }

  private async doGoogle(profile: GoogleProfile, avatar?: string): Promise<Identity> {
    const repo = this.repo();
    const byGoogle = await repo.findByGoogleId(profile.sub);
    if (byGoogle) return toIdentity(notBanned(byGoogle));
    if (!profile.emailVerified)
      throw new AppError('UNAUTHORIZED', 'Seu e-mail do Google não está verificado', 401);
    const byEmail = await repo.findByEmail(profile.email);
    if (byEmail) return toIdentity(await repo.linkGoogle(notBanned(byEmail).id, profile.sub));
    // conta só-Google: senha aleatória que ninguém conhece (dá para entrar sempre pelo Google)
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), 10);
    return toIdentity(
      await repo.create({
        email: profile.email,
        passwordHash,
        nickname: nicknameFrom(profile.name, profile.email),
        avatar: avatar ?? randomAvatar(),
        googleId: profile.sub,
      }),
    );
  }

  private async doLogin(email: string, password: string): Promise<Identity> {
    const u = await this.repo().findByEmail(email.toLowerCase());
    // comparação sempre executada para não vazar existência de conta por tempo de resposta
    const ok = await bcrypt.compare(
      password,
      u?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
    );
    if (!u || !ok) throw new AppError('UNAUTHORIZED', 'E-mail ou senha incorretos', 401);
    return toIdentity(notBanned(u));
  }
}
