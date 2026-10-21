import { EVENTS, type ChatMessage, type PublicRoom, type StopView } from '@partyverse/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { maskProfanity, containsProfanity } from '../src/modules/moderation/profanity.js';
import { stopGame } from '../src/games/stop/stop.game.js';
import { impostorGame } from '../src/games/impostor/impostor.game.js';
import { fakeCtx } from './fakeCtx.js';
import { emit, next, roomSettings, startTestServer } from './helpers.js';

/** OpenRouter falsa em streaming: responde o JSON que `reply(pedido)` devolver. */
export function fakeOpenRouter(reply: (prompt: string) => unknown) {
  return (async (input: Request | string, init?: RequestInit) => {
    // o SDK chama fetch(new Request(...)); outros chamam fetch(url, init)
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? '{}');
    const body = JSON.parse(raw || '{}') as { messages: { content: string }[] };
    const prompt = body.messages.map((m) => m.content).join('\n');
    const text = JSON.stringify(reply(prompt));
    const chunk = (content: string) =>
      `data: ${JSON.stringify({ id: 'g', object: 'chat.completion.chunk', created: 1, model: 't', choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] })}\n\n`;
    return new Response(chunk(text) + 'data: [DONE]\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as unknown as typeof fetch;
}

let t: Awaited<ReturnType<typeof startTestServer>>;
afterEach(async () => {
  await t?.close();
});

describe('filtro de palavrões', () => {
  it('esconde palavrões sem pegar palavras inocentes', () => {
    expect(maskProfanity('que porra é essa')).toBe('que p**** é essa');
    expect(maskProfanity('meu computador e a escada')).toBe('meu computador e a escada');
    expect(maskProfanity('PORRRA')).toMatch(/^P\*+$/);
    expect(containsProfanity('Ana Clara')).toBe(false);
    expect(containsProfanity('PorraLoca')).toBe(true);
  });

  it('chat da sala filtra e apelido com palavrão é recusado', async () => {
    t = await startTestServer();
    const r = await request(t.app).post('/api/auth/guest').send({ nickname: 'Caralho' });
    expect(r.status).toBe(400);
    const ana = await t.player('Ana');
    const c = await emit<PublicRoom>(ana.socket, EVENTS.ROOM_CREATE, { settings: roomSettings() });
    expect(c.data!.settings.chatFilter).toBe(true);
    const got = next<ChatMessage>(ana.socket, EVENTS.CHAT_MESSAGE, (m) => m.kind === 'chat');
    await emit(ana.socket, EVENTS.CHAT_SEND, { text: 'que merda kkk' });
    expect((await got).text).toBe('que m**** kkk');
  });
});

describe('juiz IA da Adedonha', () => {
  it('marca respostas suspeitas como um voto a mais', async () => {
    const players = [
      { id: 'a', nickname: 'A' },
      { id: 'b', nickname: 'B' },
      { id: 'c', nickname: 'C' },
    ];
    const s = stopGame.createInitialState(players, {
      ...stopGame.defaultSettings(),
      categories: ['Animal', 'Cor'],
      aiJudge: true,
    });
    const { ctx, timers } = fakeCtx();
    const flagged: string[] = [];
    (ctx as { ai?: unknown }).ai = {
      judgeStop: async (
        _l: string,
        _c: string[],
        answers: Record<string, Record<string, string>>,
      ) => {
        flagged.push(...Object.keys(answers));
        return { b: ['Animal'] };
      },
    };
    stopGame.startRound(s, ctx);
    const L = s.letter;
    for (const p of ['a', 'b', 'c'])
      stopGame.processAction(
        s,
        p,
        stopGame.validateAction(s, p, {
          type: 'answers',
          answers: { Animal: `${L}x${p}`, Cor: `${L}y${p}` },
        }),
        ctx,
      );
    stopGame.processAction(s, 'a', stopGame.validateAction(s, 'a', { type: 'stop' }), ctx);
    timers.get('phase')!(); // fim da contagem do STOP -> revisão
    await new Promise((r) => setTimeout(r, 0));
    const v = stopGame.viewFor(s, 'a') as StopView;
    expect(v.phase).toBe('review');
    const b = v.review.find((r) => r.playerId === 'b')!;
    expect(b.aiFlags).toEqual(['Animal']);
    expect(b.rejections.Animal).toBe(1);
    // IA + 1 humano = maioria (3 eleitores: 2 humanos + IA)
    stopGame.processAction(
      s,
      'a',
      stopGame.validateAction(s, 'a', {
        type: 'vote',
        targetId: 'b',
        category: 'Animal',
        valid: false,
      }),
      ctx,
    );
    timers.get('phase')!();
    const after = stopGame.viewFor(s, 'a') as StopView;
    expect(after.review.find((r) => r.playerId === 'b')!.statuses!.Animal).toBe('rejected');
  });
});

describe('Impostor com locais do tema', () => {
  it('usa os locais personalizados quando há 4 ou mais', () => {
    const custom = ['Nave', 'Base lunar', 'Estação', 'Cratera'].map((name) => ({
      name,
      roles: ['Astronauta', 'Robô', 'Cientista'],
    }));
    const players = ['a', 'b', 'c'].map((id) => ({ id, nickname: id }));
    const s = impostorGame.createInitialState(players, {
      ...impostorGame.defaultSettings(),
      customLocations: custom,
    });
    const { ctx } = fakeCtx();
    impostorGame.startRound(s, ctx);
    expect(custom.map((c) => c.name)).toContain(s.location);
  });
});

describe('IA no lobby, narrador e denúncias', () => {
  it('anfitrião gera um quiz por tema e o narrador comenta o fim', async () => {
    const quiz = {
      perguntas: Array.from({ length: 8 }, (_, i) => ({
        pergunta: `Pergunta ${i} sobre dinossauros?`,
        certa: `Certa ${i}`,
        erradas: [`X${i}`, `Y${i}`, `Z${i}`],
      })),
    };
    t = await startTestServer(
      { OPENROUTER_API_KEY: 'k' },
      {
        aiFetch: fakeOpenRouter((p) =>
          p.includes('narrador') ? { texto: 'Que partida! Ana levou a melhor.' } : quiz,
        ),
      },
    );
    expect((await request(t.app).get('/api/health')).body.ai).toBe(true);
    const host = request.agent(t.app);
    const g = await host.post('/api/auth/guest').send({ nickname: 'Ana' });
    const anaId = g.body.user.id as string;
    const ana = await t.player('Ana', anaId);
    const r = await emit<PublicRoom>(ana.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings({ gameId: 'quiz' }),
    });
    const code = r.data!.code;
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    // só o anfitrião
    const other = request.agent(t.app);
    await other.post('/api/auth/guest').send({ nickname: 'Bia' });
    expect(
      (await other.post(`/api/rooms/${code}/ai`).send({ kind: 'quiz', theme: 'dinossauros' }))
        .status,
    ).toBe(403);
    // tipo errado para o jogo
    expect(
      (await host.post(`/api/rooms/${code}/ai`).send({ kind: 'locations', theme: 'espaço' }))
        .status,
    ).toBe(400);
    const ok = await host
      .post(`/api/rooms/${code}/ai`)
      .send({ kind: 'quiz', theme: 'dinossauros' });
    expect(ok.status).toBe(200);
    expect(ok.body.count).toBe(8);
    const room = t.rooms.find(code)!;
    expect(room.gameSettings.category).toBe('personalizado');
    // ninguém recebe as perguntas pelo estado da sala
    expect(room.toPublic().gameSettings.customQuestionsCount).toBe(8);
    expect(JSON.stringify(room.toPublic())).not.toContain('Certa 0');

    // fim de partida: o narrador fala no chat
    const narr = next<ChatMessage>(
      bia.socket,
      EVENTS.CHAT_MESSAGE,
      (m) => m.nickname.includes('Narrador'),
      4000,
    );
    await (t.rooms as unknown as { narrate: (r: unknown, res: unknown) => Promise<void> }).narrate(
      room,
      {
        gameId: 'quiz',
        endedAt: Date.now(),
        ranking: [
          { playerId: anaId, nickname: 'Ana', avatar: 'blob-1', score: 900, place: 1 },
          { playerId: bia.identity.id, nickname: 'Bia', avatar: 'blob-1', score: 500, place: 2 },
        ],
      },
    );
    expect((await narr).text).toContain('Ana');
  });

  it('denúncia guarda as mensagens e aparece no painel', async () => {
    t = await startTestServer({ ADMIN_EMAILS: 'chefe@x.com' });
    const chefe = request.agent(t.app);
    await chefe
      .post('/api/auth/register')
      .send({ email: 'chefe@x.com', password: 'senhaforte1', nickname: 'Chefe' });
    const ana = request.agent(t.app);
    const a = await ana.post('/api/auth/guest').send({ nickname: 'Ana' });
    const anaSock = await t.player('Ana', a.body.user.id);
    const r = await emit<PublicRoom>(anaSock.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings(),
    });
    const troll = await t.player('Troll');
    await emit(troll.socket, EVENTS.ROOM_JOIN, { code: r.data!.code });
    await emit(troll.socket, EVENTS.CHAT_SEND, { text: 'vocês são péssimos' });
    const rep = await ana.post('/api/reports').send({
      targetId: troll.identity.id,
      roomCode: r.data!.code,
      reason: 'ofensa',
      details: 'xingando todo mundo',
    });
    expect(rep.status).toBe(201);
    expect(
      (
        await ana
          .post('/api/reports')
          .send({ targetId: troll.identity.id, roomCode: r.data!.code, reason: 'ofensa' })
      ).status,
    ).toBe(409);
    const list = (await chefe.get('/api/admin/reports')).body;
    expect(list[0]).toMatchObject({ targetName: 'Troll', reason: 'ofensa', targetIsGuest: true });
    expect(list[0].evidence[0].text).toBe('vocês são péssimos');
    expect((await chefe.get('/api/admin/stats')).body.reportsOpen).toBe(1);
    await chefe.post(`/api/admin/reports/${list[0].id}`).send({ status: 'closed' });
    expect((await chefe.get('/api/admin/reports')).body).toHaveLength(0);
  });
});
