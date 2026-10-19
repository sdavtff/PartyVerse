import { EVENTS, type PublicRoom } from '@partyverse/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emit, next, roomSettings, startTestServer } from './helpers.js';

let t: Awaited<ReturnType<typeof startTestServer>>;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(async () => {
  await t.close();
});

async function account(email: string, nickname: string) {
  const agent = request.agent(t.app);
  const r = await agent
    .post('/api/auth/register')
    .send({ email, password: 'senhaforte1', nickname });
  expect(r.status).toBe(201);
  return { agent, id: r.body.user.id as string };
}

describe('amigos', () => {
  it('pedido, aceite, conquista, busca e remoção', async () => {
    const ana = await account('ana@x.com', 'Ana');
    const bia = await account('bia@x.com', 'Bia');

    const found = await ana.agent.get('/api/users?q=bi');
    expect(found.body.map((u: { nickname: string }) => u.nickname)).toContain('Bia');

    expect((await ana.agent.post(`/api/friends/${bia.id}`)).body.status).toBe('outgoing');
    expect((await bia.agent.get(`/api/friends/relation/${ana.id}`)).body.status).toBe('incoming');
    // aceitar = pedir de volta
    expect((await bia.agent.post(`/api/friends/${ana.id}`)).body.status).toBe('friend');

    const list = (await ana.agent.get('/api/friends')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: 'friend', online: false, room: null });
    const prof = (await ana.agent.get('/api/me/profile')).body;
    expect(prof.progress.achievements.map((a: { code: string }) => a.code)).toContain(
      'first_friend',
    );

    await ana.agent.delete(`/api/friends/${bia.id}`);
    expect((await bia.agent.get('/api/friends')).body).toHaveLength(0);
  });

  it('não deixa convidado nem a si mesmo', async () => {
    const ana = await account('ana@x.com', 'Ana');
    expect((await ana.agent.post(`/api/friends/${ana.id}`)).status).toBe(400);
    const guest = request.agent(t.app);
    await guest.post('/api/auth/guest').send({ nickname: 'Visita' });
    expect((await guest.post(`/api/friends/${ana.id}`)).status).toBe(401);
  });

  it('convite para sala chega ao amigo online', async () => {
    const ana = await account('ana@x.com', 'Ana');
    const bia = await account('bia@x.com', 'Bia');
    await ana.agent.post(`/api/friends/${bia.id}`);
    await bia.agent.post(`/api/friends/${ana.id}`);

    const anaSock = await t.player('Ana', ana.id, false);
    const biaSock = await t.player('Bia', bia.id, false);
    // sem sala ainda
    expect((await ana.agent.post(`/api/friends/${bia.id}/invite`)).status).toBe(409);
    const r = await emit<PublicRoom>(anaSock.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings(),
    });
    const got = next<{ kind: string; room: { code: string } }>(biaSock.socket, EVENTS.INVITE);
    expect((await ana.agent.post(`/api/friends/${bia.id}/invite`)).status).toBe(200);
    const inv = await got;
    expect(inv.kind).toBe('room');
    expect(inv.room.code).toBe(r.data!.code);

    const list = (await bia.agent.get('/api/friends')).body;
    expect(list[0].online).toBe(true);
    expect(list[0].room.code).toBe(r.data!.code);
  });
});
