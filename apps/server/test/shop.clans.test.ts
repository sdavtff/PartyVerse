import { EVENTS, type PublicRoom } from '@partyverse/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { weekKey, weekStart } from '../src/modules/tournament/tournament.service.js';
import { emit, roomSettings, startTestServer } from './helpers.js';

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
  return { agent, id: r.body.user.id as string };
}

describe('loja e moedas', () => {
  it('compra, equipa, aparece na sala e não deixa usar o que não tem', async () => {
    const ana = await account('ana@x.com', 'Ana');
    let shop = (await ana.agent.get('/api/shop')).body;
    expect(shop.coins).toBe(0);
    expect((await ana.agent.post('/api/shop/buy').send({ itemId: 'f2' })).status).toBe(409);
    await t.progress!.giveCoins(ana.id, 500);
    const buy = await ana.agent.post('/api/shop/buy').send({ itemId: 'f2' });
    expect(buy.body.coins).toBe(250);
    expect(buy.body.achievements).toContain('first_purchase');
    expect((await ana.agent.post('/api/shop/buy').send({ itemId: 'f2' })).status).toBe(409);
    expect((await ana.agent.post('/api/shop/buy').send({ itemId: 'f9' })).status).toBe(404); // só prêmio
    expect((await ana.agent.post('/api/shop/equip').send({ name: 'n1' })).status).toBe(403);
    expect((await ana.agent.post('/api/shop/equip').send({ frame: 'n1' })).status).toBe(400);
    const eq = await ana.agent.post('/api/shop/equip').send({ frame: 'f2' });
    expect(eq.body.user.avatar).toMatch(/\.f2$/);
    // trocar o rosto mantém a moldura
    const upd = await ana.agent.patch('/api/me/profile').send({ avatar: 'c-000000' });
    expect(upd.body.user.avatar).toBe('c-000000.f2');
    // convidado não consegue se dar moldura
    const g = request.agent(t.app);
    const gr = await g.post('/api/auth/guest').send({ nickname: 'Visita', avatar: 'c-000000.f8' });
    expect(gr.body.user.avatar).toBe('c-000000');
    shop = (await ana.agent.get('/api/shop')).body;
    expect(shop.owned).toEqual(['f2']);
    expect(shop.equipped).toEqual({ frame: 'f2' });
  });

  it('partida dá moedas', async () => {
    const reward = await t.progress!.award({
      gameId: 'quiz',
      players: 4,
      participants: [{ userId: 'u_x', place: 1 }],
      highlights: {},
    });
    expect(reward.get('u_x')!.coinsGained).toBe(17);
  });
});

describe('torneio da semana', () => {
  it('semana começa na segunda (Brasília) e paga o pódio uma vez só', async () => {
    expect(weekKey(weekStart(Date.parse('2026-10-21T15:00:00Z')))).toBe('2026-10-19');
    expect(weekKey(weekStart(Date.parse('2026-10-19T02:00:00Z')))).toBe('2026-10-12'); // domingo 23h
    const ana = await account('ana@x.com', 'Ana');
    const lastWeek = new Date(weekStart().getTime() - 2 * 86400_000);
    await t.matches.save({
      gameId: 'quiz',
      roomCode: 'AAAAAA',
      rounds: 1,
      startedAt: lastWeek,
      endedAt: lastWeek,
      participants: [
        { userId: ana.id, nickname: 'Ana', score: 10, place: 1, isGuest: false },
        { userId: null, nickname: 'Visita', score: 5, place: 2, isGuest: true },
      ],
    });
    const paid = await t.tournament.payout();
    expect(paid).toHaveLength(1);
    expect(await t.tournament.payout()).toHaveLength(0);
    const shop = (await ana.agent.get('/api/shop')).body;
    expect(shop.coins).toBe(300);
    expect(shop.owned).toEqual(expect.arrayContaining(['f9', 't9']));
    const tour = (await request(t.app).get('/api/tournament')).body;
    expect(tour.lastWinners[0]).toMatchObject({ nickname: 'Ana', place: 1 });
  });
});

describe('clãs', () => {
  it('criar, entrar, ranking, expulsar e sair', async () => {
    const ana = await account('ana@x.com', 'Ana');
    const bia = await account('bia@x.com', 'Bia');
    expect(
      (await ana.agent.post('/api/clans').send({ name: 'Porra Loca', tag: 'PL', emoji: '🔥' }))
        .status,
    ).toBe(400);
    const c = await ana.agent
      .post('/api/clans')
      .send({ name: 'Os Brabos', tag: 'brb', emoji: '🔥' });
    expect(c.status).toBe(201);
    expect(c.body.tag).toBe('BRB');
    expect(
      (await bia.agent.post('/api/clans').send({ name: 'Outro', tag: 'BRB', emoji: '⭐' })).status,
    ).toBe(409);
    expect(
      (await ana.agent.post('/api/clans').send({ name: 'Outro', tag: 'XX', emoji: '⭐' })).status,
    ).toBe(409);
    await bia.agent.post('/api/clans/BRB/join');
    let clan = (await request(t.app).get('/api/clans/brb')).body;
    expect(clan.members.map((m: { nickname: string }) => m.nickname)).toEqual(['Ana', 'Bia']);
    const list = (await request(t.app).get('/api/clans')).body;
    expect(list.clans[0]).toMatchObject({ tag: 'BRB', size: 2 });
    expect((await request(t.app).get(`/api/users/${bia.id}`)).body.clan.tag).toBe('BRB');
    expect((await bia.agent.delete(`/api/clans/BRB/members/${ana.id}`)).status).toBe(403);
    await ana.agent.delete(`/api/clans/BRB/members/${bia.id}`);
    clan = (await request(t.app).get('/api/clans/BRB')).body;
    expect(clan.members).toHaveLength(1);
    await ana.agent.post('/api/clans/leave');
    expect((await request(t.app).get('/api/clans/BRB')).status).toBe(404);
  });
});

describe('cosméticos na sala', () => {
  it('o avatar com moldura chega aos outros jogadores', async () => {
    const p = await t.player('Ana', 'u_a', false);
    p.identity.avatar = 'c-000000.f2';
    const s = await t.player('Bia');
    const r = await emit<PublicRoom>(p.socket, EVENTS.ROOM_CREATE, { settings: roomSettings() });
    expect(r.ok).toBe(true);
    await emit(s.socket, EVENTS.ROOM_JOIN, { code: r.data!.code });
  });
});
