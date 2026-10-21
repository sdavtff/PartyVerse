import {
  EVENTS,
  type MatchResult,
  type PublicRoom,
  type QuizView,
  type TicTacToeView,
} from '@partyverse/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { botCell } from '../src/games/classic/tictactoe.game.js';
import { emit, next, roomSettings, startTestServer } from './helpers.js';

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

describe('bots', () => {
  it('jogo da velha: ganha quando pode e bloqueia o adversário (na maioria das vezes)', () => {
    let wins = 0;
    let blocks = 0;
    for (let i = 0; i < 200; i++) {
      // O pode ganhar na casa 2; X ameaça na casa 8
      if (
        botCell(
          ['O', 'O', null, null, 'X', null, null, 'X', null].map((v) => v as 'X' | 'O' | null),
          'O',
        ) === 2
      )
        wins++;
      if (botCell(['X', null, null, null, 'X', null, 'O', null, null], 'O') === 8) blocks++;
    }
    expect(wins).toBeGreaterThan(150);
    expect(blocks).toBeGreaterThan(150);
  });

  it('só o anfitrião coloca bot, e só em jogos que aceitam', async () => {
    const { host, code } = await createRoom({ gameId: 'stop' });
    expect((await emit(host.socket, EVENTS.ROOM_ADD_BOT)).error!.message).toMatch('não tem bots');
    await emit(host.socket, EVENTS.ROOM_UPDATE_SETTINGS, { room: { gameId: 'tictactoe' } });
    const bia = await t.player('Bia');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    expect((await emit(bia.socket, EVENTS.ROOM_ADD_BOT)).error!.code).toBe('FORBIDDEN');
    const state = next<PublicRoom>(host.socket, EVENTS.ROOM_STATE, (r) =>
      r.players.some((p) => p.isBot),
    );
    expect((await emit(host.socket, EVENTS.ROOM_ADD_BOT)).ok).toBe(true);
    const bot = (await state).players.find((p) => p.isBot)!;
    expect(bot.nickname).toMatch(/^Robô/);
    expect(bot.avatar).toMatch(/^bot-\d$/);
    // trocar para um jogo sem bots tira os bots
    const cleared = next<PublicRoom>(host.socket, EVENTS.ROOM_STATE, (r) =>
      r.players.every((p) => !p.isBot),
    );
    await emit(host.socket, EVENTS.ROOM_UPDATE_SETTINGS, { room: { gameId: 'draw' } });
    await cleared;
  });

  it('partida inteira de jogo da velha contra o bot', { timeout: 30_000 }, async () => {
    const { host } = await createRoom({ gameId: 'tictactoe' });
    await emit(host.socket, EVENTS.ROOM_UPDATE_SETTINGS, { game: { games: 1, turnSeconds: 10 } });
    await emit(host.socket, EVENTS.ROOM_ADD_BOT);
    host.socket.on(EVENTS.GAME_STATE, (v: TicTacToeView | null) => {
      if (!v || v.phase !== 'playing' || (v.turn === 'X' ? v.x : v.o) !== host.identity.id) return;
      const free = v.board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
      void emit(host.socket, EVENTS.GAME_ACTION, { action: { type: 'mark', cell: free[0] } });
    });
    const result = next<MatchResult>(host.socket, EVENTS.GAME_RESULT, () => true, 25_000);
    expect((await emit(host.socket, EVENTS.ROOM_START)).ok).toBe(true);
    const r = await result;
    expect(r.ranking).toHaveLength(2);
    expect(r.ranking.some((x) => x.nickname.startsWith('Robô'))).toBe(true);
  });

  it('quiz: o bot responde sozinho; sala só com bots fecha', { timeout: 20_000 }, async () => {
    const { host, code } = await createRoom({ gameId: 'quiz' });
    await emit(host.socket, EVENTS.ROOM_UPDATE_SETTINGS, {
      game: { questions: 5, secondsPerQuestion: 8 },
    });
    await emit(host.socket, EVENTS.ROOM_ADD_BOT);
    await emit(host.socket, EVENTS.ROOM_ADD_BOT);
    const answered = next<QuizView>(
      host.socket,
      EVENTS.GAME_STATE,
      (v) =>
        v?.phase === 'question' &&
        v.answeredPlayers.filter((p) => p.startsWith('bot-')).length === 2,
      15_000,
    );
    await emit(host.socket, EVENTS.ROOM_START);
    await answered;
    await emit(host.socket, EVENTS.ROOM_LEAVE);
    expect(t.rooms.find(code)).toBeUndefined();
  });
});

describe('chat de voz', () => {
  it('entrar, silenciar, repassar sinalização e sair ao desconectar', async () => {
    const { host, code } = await createRoom();
    const bia = await t.player('Bia');
    const caio = await t.player('Caio');
    await emit(bia.socket, EVENTS.ROOM_JOIN, { code });
    await emit(caio.socket, EVENTS.ROOM_JOIN, { code });

    expect((await emit(host.socket, EVENTS.VOICE_JOIN)).data).toEqual({ peers: [] });
    const j = await emit<{ peers: string[] }>(bia.socket, EVENTS.VOICE_JOIN);
    expect(j.data!.peers).toEqual([host.identity.id]);

    // Bia (quem chegou) manda a oferta; Ana recebe com o remetente
    const got = next<{ from: string; data: { type: string } }>(host.socket, EVENTS.VOICE_SIGNAL);
    const sent = await emit(bia.socket, EVENTS.VOICE_SIGNAL, {
      to: host.identity.id,
      data: { type: 'offer', sdp: 'v=0 fake' },
    });
    expect(sent.ok).toBe(true);
    expect(await got).toEqual({ from: bia.identity.id, data: { type: 'offer', sdp: 'v=0 fake' } });

    // quem não está na voz não recebe nem envia
    const bad = await emit(caio.socket, EVENTS.VOICE_SIGNAL, {
      to: host.identity.id,
      data: { type: 'ice', candidate: { candidate: 'x' } },
    });
    expect(bad.ok).toBe(false);

    const muted = next<PublicRoom>(host.socket, EVENTS.ROOM_STATE, (r) =>
      r.players.some((p) => p.voice === 'muted'),
    );
    await emit(bia.socket, EVENTS.VOICE_MUTE, { muted: true });
    expect((await muted).players.find((p) => p.nickname === 'Bia')!.voice).toBe('muted');

    const left = next<PublicRoom>(host.socket, EVENTS.ROOM_STATE, (r) =>
      r.players.every((p) => p.nickname !== 'Bia' || p.voice == null),
    );
    bia.socket.disconnect();
    await left;
  });
});
