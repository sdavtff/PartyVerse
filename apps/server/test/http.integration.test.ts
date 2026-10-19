import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer } from './helpers.js';

let t: Awaited<ReturnType<typeof startTestServer>>;
beforeAll(async () => {
  t = await startTestServer();
});
afterAll(async () => {
  await t.close();
});

describe('HTTP', () => {
  it('catálogo e saúde', async () => {
    expect((await request(t.app).get('/api/health')).body).toMatchObject({ ok: true });
    const games = (await request(t.app).get('/api/games')).body;
    expect(games.find((g: { id: string }) => g.id === 'stop').available).toBe(true);
  });

  it('convidado recebe cookie httpOnly', async () => {
    const r = await request(t.app).post('/api/auth/guest').send({ nickname: 'Visitante' });
    expect(r.status).toBe(200);
    expect(r.headers['set-cookie']![0]).toMatch(/pv_token=.*HttpOnly/);
    expect(r.body.user.isGuest).toBe(true);
  });

  it('valida apelido', async () => {
    const r = await request(t.app).post('/api/auth/guest').send({ nickname: '<b>x</b>' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION');
  });

  it('cadastro, login, perfil e sem vazar hash de senha', async () => {
    const agent = request.agent(t.app);
    const reg = await agent
      .post('/api/auth/register')
      .send({ email: 'X@Y.com', password: 'senhaforte1', nickname: 'Xis' });
    expect(reg.status).toBe(201);
    expect(JSON.stringify(reg.body)).not.toMatch(/passwordHash|senhaforte/);
    expect(
      (
        await agent
          .post('/api/auth/register')
          .send({ email: 'x@y.com', password: 'senhaforte1', nickname: 'Xis' })
      ).status,
    ).toBe(409);
    expect(
      (await request(t.app).post('/api/auth/login').send({ email: 'x@y.com', password: 'errada' }))
        .status,
    ).toBe(401);
    const login = await request(t.app)
      .post('/api/auth/login')
      .send({ email: 'x@y.com', password: 'senhaforte1' });
    expect(login.status).toBe(200);
    const prof = await agent.get('/api/me/profile');
    expect(prof.body.stats.matchesPlayed).toBe(0);
    const upd = await agent
      .patch('/api/me/profile')
      .send({ nickname: 'Novo', preferences: { sound: false } });
    expect(upd.body.user.nickname).toBe('Novo');
    expect(upd.body.preferences.sound).toBe(false);
  });

  it('rotas protegidas exigem login', async () => {
    expect((await request(t.app).get('/api/me/profile')).status).toBe(401);
  });

  it('sala inexistente retorna 404', async () => {
    expect((await request(t.app).get('/api/rooms/ABCDEF')).status).toBe(404);
  });
});

describe('ranking', () => {
  it('soma vitórias e pontos de contas e filtra por jogo', async () => {
    const srv = await startTestServer();
    await srv.matches.save({
      gameId: 'stop',
      roomCode: 'AAAAAA',
      rounds: 1,
      startedAt: new Date(),
      endedAt: new Date(),
      participants: [
        { userId: 'u1', nickname: 'Ana', score: 30, place: 1, isGuest: false },
        { userId: 'u2', nickname: 'Bia', score: 10, place: 2, isGuest: false },
        { userId: null, nickname: 'Convidado', score: 99, place: 3, isGuest: true },
      ],
    });
    await srv.matches.save({
      gameId: 'quiz',
      roomCode: 'BBBBBB',
      rounds: 1,
      startedAt: new Date(),
      endedAt: new Date(),
      participants: [{ userId: 'u2', nickname: 'Bia', score: 900, place: 1, isGuest: false }],
    });
    const all = await request(srv.app).get('/api/leaderboard');
    expect(all.body.rows.map((r: { nickname: string }) => r.nickname)).toEqual(['Bia', 'Ana']);
    const stop = await request(srv.app).get('/api/leaderboard?game=stop');
    expect(stop.body.rows[0]).toMatchObject({ nickname: 'Ana', wins: 1, score: 30 });
    expect(JSON.stringify(stop.body)).not.toContain('Convidado');
    await srv.close();
  });
});
