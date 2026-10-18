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
    expect((await request(t.app).get('/api/health')).body).toEqual({ ok: true });
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
