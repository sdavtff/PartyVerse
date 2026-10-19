import {
  avatarMinLevel,
  EVENTS,
  levelInfo,
  matchXp,
  xpForLevel,
  type MatchReward,
} from '@partyverse/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryMatchRepository } from '../src/modules/matches/match.repository.js';
import { MemoryProgressRepository } from '../src/modules/progress/progress.repository.js';
import { ProgressService } from '../src/modules/progress/progress.service.js';
import { seasonLabel, seasonStart } from '../src/http/app.js';
import { emit, next, roomSettings, startTestServer } from './helpers.js';

let srv: Awaited<ReturnType<typeof startTestServer>> | null = null;
afterEach(async () => {
  await srv?.close();
  srv = null;
});

describe('níveis e XP', () => {
  it('curva de níveis e XP por partida', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(350)).toMatchObject({ level: 3, base: 300, next: 600 });
    expect(matchXp(1, 4)).toBe(20 + 30 + 8);
    expect(matchXp(5, 50)).toBe(20 + 0 + 20);
  });

  it('itens de avatar travados por nível', () => {
    expect(avatarMinLevel('blob-1')).toBe(1);
    expect(avatarMinLevel('c-000000')).toBe(1);
    expect(avatarMinLevel('c-000008')).toBe(2); // acessório 8
    expect(avatarMinLevel('c-90000d')).toBe(12); // fundo 9 (6) e acessório 13 (12)
  });
});

describe('recompensas', () => {
  it('dá XP, sobe de nível e libera conquistas sem repetir', async () => {
    const matches = new MemoryMatchRepository();
    const repo = new MemoryProgressRepository(matches);
    const svc = new ProgressService(repo);
    repo.xp.set('u1', 90);
    await matches.save({
      gameId: 'quiz',
      roomCode: 'X',
      rounds: 1,
      startedAt: new Date(),
      endedAt: new Date(),
      participants: [{ userId: 'u1', nickname: 'A', score: 1, place: 1, isGuest: false }],
    });
    const r = (
      await svc.award({
        gameId: 'quiz',
        players: 10,
        participants: [{ userId: 'u1', place: 1 }],
        highlights: { u1: { maxStreak: 6 } },
      })
    ).get('u1')!;
    expect(r.leveledUp).toBe(true);
    expect(r.level).toBe(2);
    expect(r.achievements).toEqual(
      expect.arrayContaining(['first_match', 'first_win', 'big_room', 'quiz_streak_5']),
    );
    const again = (
      await svc.award({
        gameId: 'quiz',
        players: 2,
        participants: [{ userId: 'u1', place: 2 }],
        highlights: {},
      })
    ).get('u1')!;
    expect(again.achievements).toEqual([]);
    expect(await svc.unlock('u1', 'daily_done')).toBe(true);
    expect(await svc.unlock('u1', 'daily_done')).toBe(false);
  });

  it('jogador com conta recebe a recompensa no fim da partida', async () => {
    srv = await startTestServer();
    const ana = await srv.player('Ana', 'u_ana', false);
    const bia = await srv.player('Bia', 'u_bia', false);
    const created = await emit<{ code: string }>(ana.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings({ gameId: 'quiz' }),
    });
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
    await emit(ana.socket, EVENTS.ROOM_START);
    const reward = next<MatchReward>(ana.socket, EVENTS.REWARD);
    // Bia sai: a partida termina por falta de jogadores e o resultado é registrado
    await emit(bia.socket, EVENTS.ROOM_LEAVE);
    const r = await reward;
    expect(r.xpGained).toBeGreaterThan(0);
    expect(r.achievements).toContain('first_match');
  });
});

describe('perfil público, avatar e temporada', () => {
  it('perfil público mostra nível e conquistas; avatar travado é recusado', async () => {
    srv = await startTestServer();
    const reg = await request(srv.app)
      .post('/api/auth/register')
      .send({ email: 'p@x.com', password: 'senha12345', nickname: 'Pri' });
    const id = reg.body.user.id;
    await srv.progress!.unlock(id, 'first_friend');
    const pub = await request(srv.app).get(`/api/users/${id}`);
    expect(pub.body.user.nickname).toBe('Pri');
    expect(pub.body.progress.level).toBe(1);
    expect(pub.body.progress.achievements[0].code).toBe('first_friend');
    expect(JSON.stringify(pub.body)).not.toContain('p@x.com');
    const cookie = reg.headers['set-cookie'] as unknown as string[];
    const locked = await request(srv.app)
      .patch('/api/me/profile')
      .set('Cookie', cookie)
      .send({ avatar: 'c-00000c' });
    expect(locked.status).toBe(400);
    expect(locked.body.error.message).toMatch(/nível 9/);
    const guest = await request(srv.app)
      .post('/api/auth/guest')
      .send({ nickname: 'Gui', avatar: 'c-000008' });
    expect(guest.status).toBe(400);
  });

  it('temporada começa no dia 1 do mês (horário de Brasília)', () => {
    const d = new Date('2026-10-01T02:00:00Z'); // ainda 30/09 em Brasília
    expect(seasonStart(d).toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(seasonLabel(new Date('2026-10-19T12:00:00Z'))).toBe('Temporada de outubro 2026');
  });
});
