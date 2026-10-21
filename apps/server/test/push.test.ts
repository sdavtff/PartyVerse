import { EVENTS, type PublicRoom } from '@partyverse/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryPushRepository, PushService } from '../src/modules/push/push.service.js';
import { emit, roomSettings, startTestServer } from './helpers.js';

let t: Awaited<ReturnType<typeof startTestServer>>;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(async () => {
  await t.close();
});

const sub = (n: number) => ({
  endpoint: `https://push.example.com/send/${n}`,
  keys: { p256dh: 'BPk'.padEnd(87, 'x'), auth: 'auth-secret-1' },
});

async function account(email: string, nickname: string) {
  const agent = request.agent(t.app);
  const r = await agent
    .post('/api/auth/register')
    .send({ email, password: 'senhaforte1', nickname });
  expect(r.status).toBe(201);
  return { agent, id: r.body.user.id as string, token: r.body.token as string | undefined };
}

describe('notificações push', () => {
  it('chave pública estável, inscrição só para contas, teste e cancelamento', async () => {
    const k1 = (await request(t.app).get('/api/push/key')).body.publicKey;
    const k2 = (await request(t.app).get('/api/push/key')).body.publicKey;
    expect(k1).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(k2).toBe(k1);

    const guest = request.agent(t.app);
    await guest.post('/api/auth/guest').send({ nickname: 'Visita' });
    expect((await guest.post('/api/push/subscribe').send(sub(0))).status).toBe(401);

    const ana = await account('ana@x.com', 'Ana');
    expect((await ana.agent.post('/api/push/subscribe').send({ endpoint: 'x' })).status).toBe(400);
    expect((await ana.agent.post('/api/push/subscribe').send(sub(1))).status).toBe(200);
    expect((await ana.agent.post('/api/push/test')).body.sent).toBe(1);
    expect(t.pushed.at(-1)!.payload.title).toMatch('Notificações ligadas');
    await ana.agent.delete('/api/push/subscribe').send({ endpoint: sub(1).endpoint });
    expect((await ana.agent.post('/api/push/test')).body.sent).toBe(0);
  });

  it('pedido de amizade e convite chegam por push a quem está fora do site', async () => {
    const ana = await account('ana@x.com', 'Ana');
    const bia = await account('bia@x.com', 'Bia');
    await bia.agent.post('/api/push/subscribe').send(sub(2));
    await ana.agent.post(`/api/friends/${bia.id}`);
    expect(t.pushed.at(-1)!.payload).toMatchObject({ title: 'Pedido de amizade', url: '/amigos' });
    await bia.agent.post(`/api/friends/${ana.id}`);

    // Ana entra numa sala (socket com a identidade da conta) e convida a Bia, que está fora
    const me = (await ana.agent.get('/api/auth/me')).body.user;
    const host = await t.player(me.nickname, me.id, false);
    const room = await emit<PublicRoom>(host.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings({ name: 'Noite do quiz' }),
    });
    const inv = await ana.agent.post(`/api/friends/${bia.id}/invite`);
    expect(inv.body).toEqual({ ok: true, via: 'push' });
    expect(t.pushed.at(-1)!.payload).toMatchObject({
      title: 'Ana chamou você para jogar',
      url: `/sala/${room.data!.code}`,
    });
    // sem inscrição e offline: erro claro
    await bia.agent.delete('/api/push/subscribe').send({ endpoint: sub(2).endpoint });
    expect((await ana.agent.post(`/api/friends/${bia.id}/invite`)).status).toBe(409);
  });
});

describe('lembrete do desafio', () => {
  it('uma vez por dia, só depois do meio-dia, só para quem não jogou; remove inscrições mortas', async () => {
    const repo = new MemoryPushRepository();
    const sent: string[] = [];
    const svc = new PushService(repo, {
      subject: 'mailto:x@y.z',
      sender: async (s) => {
        if (s.endpoint.endsWith('/dead'))
          throw Object.assign(new Error('gone'), { statusCode: 410 });
        sent.push(s.endpoint);
      },
    });
    await svc.subscribe('u1', { endpoint: 'https://p/u1', keys: sub(0).keys });
    await svc.subscribe('u2', { endpoint: 'https://p/u2', keys: sub(0).keys });
    await svc.subscribe('u3', { endpoint: 'https://p/dead', keys: sub(0).keys });
    repo.played.add('u2:2026-10-22');
    expect(await svc.dailyReminder('2026-10-22', 9)).toBe(0);
    expect(await svc.dailyReminder('2026-10-22', 12)).toBe(1);
    expect(sent).toEqual(['https://p/u1']);
    expect(await svc.dailyReminder('2026-10-22', 15)).toBe(0); // já foi hoje
    expect(repo.subs.has('https://p/dead')).toBe(false);
  });
});
