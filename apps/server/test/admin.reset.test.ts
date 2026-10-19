import { EVENTS, type PublicRoom } from '@partyverse/shared';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { emit, roomSettings, startTestServer } from './helpers.js';

let t: Awaited<ReturnType<typeof startTestServer>>;
afterEach(async () => {
  await t.close();
});

async function account(email: string, nickname: string) {
  const agent = request.agent(t.app);
  const r = await agent
    .post('/api/auth/register')
    .send({ email, password: 'senhaforte1', nickname });
  return { agent, id: r.body.user.id as string };
}

describe('recuperar senha', () => {
  it('envia link, troca a senha uma única vez e não revela e-mails', async () => {
    t = await startTestServer();
    await account('ana@x.com', 'Ana');
    const r = await request(t.app).post('/api/auth/forgot').send({ email: 'ANA@x.com' });
    expect(r.status).toBe(200);
    expect(
      (await request(t.app).post('/api/auth/forgot').send({ email: 'nao@x.com' })).status,
    ).toBe(200);
    expect(t.mailer.sent).toHaveLength(1);
    const token = /token=([\w-]+)/.exec(t.mailer.sent[0]!.text)![1]!;
    const reset = await request(t.app)
      .post('/api/auth/reset')
      .send({ token, password: 'novaSenha99' });
    expect(reset.status).toBe(200);
    expect(reset.headers['set-cookie']![0]).toMatch(/pv_token=/);
    expect(
      (await request(t.app).post('/api/auth/reset').send({ token, password: 'outraSenha99' }))
        .status,
    ).toBe(400);
    expect(
      (
        await request(t.app)
          .post('/api/auth/login')
          .send({ email: 'ana@x.com', password: 'novaSenha99' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(t.app)
          .post('/api/auth/login')
          .send({ email: 'ana@x.com', password: 'senhaforte1' })
      ).status,
    ).toBe(401);
  });
});

describe('painel de administração', () => {
  it('só admin acessa; suspender bloqueia login, API e conexão', async () => {
    t = await startTestServer({ ADMIN_EMAILS: 'chefe@x.com' });
    const chefe = await account('chefe@x.com', 'Chefe');
    const bia = await account('bia@x.com', 'Bia');
    expect((await bia.agent.get('/api/admin/stats')).status).toBe(403);
    expect((await chefe.agent.get('/api/auth/me')).body.admin).toBe(true);
    expect((await bia.agent.get('/api/auth/me')).body.admin).toBe(false);
    const stats = (await chefe.agent.get('/api/admin/stats')).body;
    expect(stats.users.total).toBe(2);

    // Bia numa sala
    const sock = await t.player('Bia', bia.id, false);
    const r = await emit<PublicRoom>(sock.socket, EVENTS.ROOM_CREATE, { settings: roomSettings() });
    expect((await chefe.agent.get('/api/admin/rooms')).body[0].code).toBe(r.data!.code);

    const found = (await chefe.agent.get('/api/admin/users?q=bia')).body;
    expect(found[0].email).toBe('bia@x.com');
    expect(
      (await chefe.agent.post(`/api/admin/users/${chefe.id}/ban`).send({ banned: true })).status,
    ).toBe(400);
    expect(
      (await chefe.agent.post(`/api/admin/users/${bia.id}/ban`).send({ banned: true })).status,
    ).toBe(200);
    expect((await bia.agent.get('/api/auth/me')).status).toBe(403);
    expect(
      (
        await request(t.app)
          .post('/api/auth/login')
          .send({ email: 'bia@x.com', password: 'senhaforte1' })
      ).status,
    ).toBe(403);
    const s = ioc(t.url, {
      auth: { token: sock.token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    const err = await new Promise<Error>((res) => s.once('connect_error', res));
    expect(err.message).toBe('BANNED');
    s.disconnect();

    // fechar sala
    const r2 = await emit<PublicRoom>((await t.player('Caio')).socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings(),
    });
    expect((await chefe.agent.delete(`/api/admin/rooms/${r2.data!.code}`)).status).toBe(200);
    expect(t.rooms.find(r2.data!.code)).toBeUndefined();

    await chefe.agent.post(`/api/admin/users/${bia.id}/ban`).send({ banned: false });
    expect((await bia.agent.get('/api/auth/me')).status).toBe(200);
  });
});
