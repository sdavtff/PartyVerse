import {
  EVENTS,
  type PublicRoom,
  type StopView,
  type MatchResult,
  type ChatMessage,
} from '@partyverse/shared';
import { io as ioc } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emit, next, roomSettings, sleep, startTestServer } from './helpers.js';

let t: Awaited<ReturnType<typeof startTestServer>>;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(async () => {
  await t.close();
});

async function createRoom(o = {}) {
  const host = await t.player('Ana');
  const r = await emit<PublicRoom>(host.socket, EVENTS.ROOM_CREATE, { settings: roomSettings(o) });
  expect(r.ok).toBe(true);
  return { host, code: r.data!.code };
}

describe('autenticação de sockets', () => {
  it('recusa conexão sem token ou com token adulterado', async () => {
    for (const auth of [{}, { token: 'abc.def.ghi' }]) {
      const s = ioc(t.url, {
        auth,
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      const err = await new Promise<Error>((res) => s.once('connect_error', res));
      expect(err.message).toBe('UNAUTHORIZED');
      s.disconnect();
    }
  });
});

describe('salas', () => {
  it('cria sala com código curto e permite entrar por código', async () => {
    const { code } = await createRoom();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const bia = await t.player('Bia');
    const r = await emit<PublicRoom>(bia.socket, EVENTS.ROOM_JOIN, { code: code.toLowerCase() });
    expect(r.ok).toBe(true);
    expect(r.data!.players.map((p) => p.nickname)).toEqual(['Ana', 'Bia']);
    expect(r.data!.players[0]!.isHost).toBe(true);
  });

  it('rejeita código inválido e sala inexistente', async () => {
    const p = await t.player();
    expect((await emit(p.socket, EVENTS.ROOM_JOIN, { code: '<script>' })).error!.code).toBe(
      'VALIDATION',
    );
    expect((await emit(p.socket, EVENTS.ROOM_JOIN, { code: 'ZZZZZZ' })).error!.code).toBe(
      'NOT_FOUND',
    );
  });

  it('sala cheia: quem chega entra como espectador e não joga', async () => {
    const { host, code } = await createRoom({ maxPlayers: 2 });
    await emit((await t.player('B')).socket, EVENTS.ROOM_JOIN, { code });
    const c = await t.player('C');
    const r = await emit<PublicRoom>(c.socket, EVENTS.ROOM_JOIN, { code });
    expect(r.ok).toBe(true);
    const me = r.data!.players.find((p) => p.nickname === 'C')!;
    expect(me.spectator).toBe(true);
    // não consegue sair do modo espectador enquanto a sala está cheia
    expect((await emit(c.socket, EVENTS.ROOM_SPECTATE, { on: false })).error!.code).toBe(
      'ROOM_FULL',
    );
    // o anfitrião pode virar espectador; aí C pode jogar
    expect((await emit(host.socket, EVENTS.ROOM_SPECTATE, { on: true })).ok).toBe(true);
    expect((await emit(c.socket, EVENTS.ROOM_SPECTATE, { on: false })).ok).toBe(true);
  });

  it('reações chegam para todos da sala', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    const got = next<{ emoji: string; playerId: string }>(host.socket, EVENTS.REACTION);
    expect((await emit(bia.socket, EVENTS.REACTION, { emoji: '🔥' })).ok).toBe(true);
    expect((await got).emoji).toBe('🔥');
    expect((await emit(bia.socket, EVENTS.REACTION, { emoji: '💩' })).error!.code).toBe(
      'VALIDATION',
    );
  });

  it('entrada duplicada (segunda aba) não duplica o jogador', async () => {
    const { host, code } = await createRoom();
    const s2 = ioc(t.url, {
      auth: { token: host.token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    await new Promise<void>((r) => s2.once('connect', () => r()));
    const notice = next(host.socket, EVENTS.NOTICE);
    const r = await emit<PublicRoom>(s2, EVENTS.ROOM_JOIN, { code });
    expect(r.data!.players).toHaveLength(1);
    await notice;
    s2.disconnect();
  });

  it('isola chat entre salas', async () => {
    const a = await createRoom();
    const b = await t.player('Outro');
    await emit(b.socket, EVENTS.ROOM_CREATE, { settings: roomSettings() });
    let leaked = false;
    b.socket.on(EVENTS.CHAT_MESSAGE, (m: ChatMessage) => {
      if (m.text === 'segredo da sala A') leaked = true;
    });
    const got = next<ChatMessage>(a.host.socket, EVENTS.CHAT_MESSAGE, (m) => m.kind === 'chat');
    await emit(a.host.socket, EVENTS.CHAT_SEND, { text: 'segredo da sala A' });
    expect((await got).text).toBe('segredo da sala A');
    await sleep(100);
    expect(leaked).toBe(false);
  });

  it('não permite agir em sala na qual não entrou', async () => {
    await createRoom();
    const intruso = await t.player('Intruso');
    expect((await emit(intruso.socket, EVENTS.CHAT_SEND, { text: 'oi' })).error!.code).toBe(
      'FORBIDDEN',
    );
    expect((await emit(intruso.socket, EVENTS.ROOM_START)).error!.code).toBe('FORBIDDEN');
  });

  it('só o anfitrião configura, inicia e expulsa; expulso não volta', async () => {
    const { code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    expect((await emit(bia.socket, EVENTS.ROOM_START)).error!.code).toBe('FORBIDDEN');
    expect(
      (await emit(bia.socket, EVENTS.ROOM_UPDATE_SETTINGS, { room: { name: 'hack' } })).error!.code,
    ).toBe('FORBIDDEN');
    const { host } = { host: await t.player('Ana') }; // mesmo id da anfitriã (nova conexão)
    await emit(host.socket, EVENTS.ROOM_JOIN, { code });
    const kicked = next(bia.socket, EVENTS.ROOM_KICKED);
    expect((await emit(host.socket, EVENTS.ROOM_KICK, { playerId: bia.identity.id })).ok).toBe(
      true,
    );
    await kicked;
    expect((await emit(bia.socket, EVENTS.ROOM_JOIN, { code })).error!.code).toBe('FORBIDDEN');
  });

  it('quando o anfitrião sai, a liderança passa ao mais antigo online', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    const caio = await t.player('Caio');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    await emit(caio.socket, EVENTS.ROOM_JOIN, { code });
    const st = next<PublicRoom>(caio.socket, EVENTS.ROOM_STATE, (r) => r.players.length === 2);
    await emit(host.socket, EVENTS.ROOM_LEAVE);
    expect((await st).hostId).toBe(bia.identity.id);
  });

  it('desconexão mantém o lugar (reconectando) e a reconexão recupera o estado', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    const reconnecting = next<PublicRoom>(host.socket, EVENTS.ROOM_STATE, (r) =>
      r.players.some((p) => p.status === 'reconnecting'),
    );
    bia.socket.disconnect();
    await reconnecting;
    const again = await t.player('Bia');
    const r = await emit<PublicRoom>(again.socket, EVENTS.ROOM_JOIN, { code });
    expect(r.data!.players.find((p) => p.nickname === 'Bia')!.status).toBe('online');
    expect(r.data!.players).toHaveLength(2);
  });

  it('jogador que não volta dentro do prazo é removido', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    const gone = next<PublicRoom>(
      host.socket,
      EVENTS.ROOM_STATE,
      (r) => r.players.length === 1,
      2000,
    );
    bia.socket.disconnect();
    await gone;
  });

  it('aplica rate limit no chat', async () => {
    const { host } = await createRoom();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        emit(host.socket, EVENTS.CHAT_SEND, { text: `msg ${i}` }),
      ),
    );
    expect(results.some((r) => r.error?.code === 'RATE_LIMITED')).toBe(true);
  });

  it('sala vazia é removida', async () => {
    const { host, code } = await createRoom();
    await emit(host.socket, EVENTS.ROOM_LEAVE);
    expect(t.rooms.find(code)).toBeUndefined();
  });
});

describe('STOP multiplayer', () => {
  it('partida completa por sockets, sem vazar respostas, com resultado salvo', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    await emit(host.socket, EVENTS.ROOM_UPDATE_SETTINGS, {
      game: { rounds: 1, categories: ['Nome', 'Animal'], stopCountdownSeconds: 0 },
    });
    const anaView = next<StopView>(host.socket, EVENTS.GAME_STATE, (v) => v?.phase === 'answering');
    const biaView = next<StopView>(bia.socket, EVENTS.GAME_STATE, (v) => v?.phase === 'answering');
    expect((await emit(host.socket, EVENTS.ROOM_START)).ok).toBe(true);
    const { letter } = await anaView;
    await biaView;

    const secret = `${letter}lfabetoSecreto`;
    let leaked = false;
    bia.socket.on(EVENTS.GAME_STATE, (v: StopView) => {
      if (v?.phase === 'answering' && JSON.stringify(v).includes(secret)) leaked = true;
    });
    await emit(host.socket, EVENTS.GAME_ACTION, {
      action: { type: 'answers', answers: { Nome: secret, Animal: `${letter}nta` } },
    });
    await emit(bia.socket, EVENTS.GAME_ACTION, {
      action: { type: 'answers', answers: { Nome: `${letter}na`, Animal: '' } },
    });

    // STOP repetido (mesmo actionId) não tem efeito duplicado
    const review = next<StopView>(bia.socket, EVENTS.GAME_STATE, (v) => v?.phase === 'review');
    const r1 = await emit(host.socket, EVENTS.GAME_ACTION, {
      action: { type: 'stop' },
      actionId: 'stop-1',
    });
    const r2 = await emit(host.socket, EVENTS.GAME_ACTION, {
      action: { type: 'stop' },
      actionId: 'stop-1',
    });
    expect(r1.ok && r2.ok).toBe(true);
    const rv = await review;
    expect(leaked).toBe(false);
    expect(rv.review.find((x) => x.playerId === host.identity.id)!.answers.Nome).toBe(secret);

    // cliente não pode inventar pontuação
    expect(
      (await emit(bia.socket, EVENTS.GAME_ACTION, { action: { type: 'score', value: 1000 } })).ok,
    ).toBe(false);

    const result = next<MatchResult>(host.socket, EVENTS.GAME_RESULT);
    await emit(host.socket, EVENTS.GAME_ACTION, { action: { type: 'ready' } });
    await emit(bia.socket, EVENTS.GAME_ACTION, { action: { type: 'ready' } });
    await emit(host.socket, EVENTS.GAME_ACTION, { action: { type: 'ready' } });
    await emit(bia.socket, EVENTS.GAME_ACTION, { action: { type: 'ready' } });
    const res = await result;
    expect(res.ranking[0]).toMatchObject({ nickname: 'Ana', score: 20, place: 1 });
    expect(res.ranking[1]).toMatchObject({ nickname: 'Bia', score: 10, place: 2 });
    await sleep(50);
    expect(t.matches.saved).toHaveLength(1);

    // jogar novamente
    expect((await emit(host.socket, EVENTS.ROOM_START)).ok).toBe(true);
  });

  it('reconexão durante a partida recupera as próprias respostas', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    const started = next<StopView>(bia.socket, EVENTS.GAME_STATE, (v) => v?.phase === 'answering');
    await emit(host.socket, EVENTS.ROOM_START);
    const { letter } = await started;
    await emit(bia.socket, EVENTS.GAME_ACTION, {
      action: { type: 'answers', answers: { Nome: `${letter}ia` } },
    });
    bia.socket.disconnect();
    await sleep(50);
    const back = await t.player('Bia');
    const view = next<StopView>(back.socket, EVENTS.GAME_STATE);
    await emit(back.socket, EVENTS.ROOM_JOIN, { code });
    expect((await view).myAnswers.Nome).toBe(`${letter}ia`);
  });

  it('partida termina se sobrar só um jogador', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    await emit(host.socket, EVENTS.ROOM_START);
    const result = next<MatchResult>(host.socket, EVENTS.GAME_RESULT, () => true, 2000);
    await emit(bia.socket, EVENTS.ROOM_LEAVE);
    expect((await result).ranking.length).toBe(2);
  });
});

describe('transporte HTTP long-polling', () => {
  it('conecta por polling sem conflito com o Express', async () => {
    const p = await t.player('Poll');
    const s = ioc(t.url, {
      auth: { token: p.token },
      transports: ['polling'],
      forceNew: true,
      reconnection: false,
    });
    await new Promise<void>((r) => s.once('connect', () => r()));
    const r = await emit<PublicRoom>(s, EVENTS.ROOM_CREATE, { settings: roomSettings() });
    expect(r.ok).toBe(true);
    s.disconnect();
  });
});
