import { EVENTS, type GuessView, type ImpostorView, type QuizView } from '@partyverse/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { emit, next, roomSettings, startTestServer } from './helpers.js';

let srv: Awaited<ReturnType<typeof startTestServer>>;
afterEach(async () => srv?.close());

describe('novos jogos via sockets', () => {
  it('Impostor: cada um recebe só a própria carta', async () => {
    srv = await startTestServer();
    const ps = await Promise.all(['Ana', 'Bia', 'Caio', 'Duda'].map((n) => srv.player(n)));
    const created = await emit<{ code: string }>(ps[0]!.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings({ gameId: 'impostor' }),
    });
    expect(created.ok).toBe(true);
    for (const p of ps.slice(1)) {
      const r = await emit(p.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
      expect(r.ok).toBe(true);
    }
    const views = ps.map((p) =>
      next<ImpostorView & { serverNow: number }>(p.socket, EVENTS.GAME_STATE, (v) => !!v?.me),
    );
    expect((await emit(ps[0]!.socket, EVENTS.ROOM_START)).ok).toBe(true);
    const got = await Promise.all(views);
    const impostors = got.filter((v) => v.me!.isImpostor);
    expect(impostors).toHaveLength(1);
    const location = got.find((v) => !v.me!.isImpostor)!.me as { location: string };
    expect(JSON.stringify(impostors[0]!.me)).not.toContain(location.location);
    expect(typeof got[0]!.serverNow).toBe('number');
  });

  it('Quiz: começa com contagem e mínimo de 2 jogadores', async () => {
    srv = await startTestServer();
    const [a, b] = await Promise.all([srv.player('Ana'), srv.player('Bia')]);
    const created = await emit<{ code: string }>(a.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings({ gameId: 'quiz' }),
    });
    const alone = await emit(a.socket, EVENTS.ROOM_START);
    expect(alone.ok).toBe(false);
    await emit(b.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
    const view = next<QuizView>(b.socket, EVENTS.GAME_STATE, (v) => v?.phase === 'countdown');
    expect((await emit(a.socket, EVENTS.ROOM_START)).ok).toBe(true);
    const v = await view;
    expect(v.total).toBe(10);
    expect(v.question).toBeNull();
  });

  it('anfitrião troca o jogo no lobby e as regras voltam ao padrão do novo jogo', async () => {
    srv = await startTestServer();
    const a = await srv.player('Ana');
    await emit(a.socket, EVENTS.ROOM_CREATE, { settings: roomSettings() });
    const state = next<{ settings: { gameId: string }; gameSettings: Record<string, unknown> }>(
      a.socket,
      EVENTS.ROOM_STATE,
      (r) => r.settings.gameId === 'quiz',
    );
    const r = await emit(a.socket, EVENTS.ROOM_UPDATE_SETTINGS, { room: { gameId: 'quiz' } });
    expect(r.ok).toBe(true);
    expect((await state).gameSettings).toMatchObject({ questions: 10, category: 'misto' });
    const bad = await emit(a.socket, EVENTS.ROOM_UPDATE_SETTINGS, { room: { gameId: 'xadrez' } });
    expect(bad.ok).toBe(false);
  });
});

describe('sala: senha, figurinhas e palpites', () => {
  it('sala com senha pede a senha; reconexão não pede de novo', async () => {
    srv = await startTestServer();
    const [a, b] = await Promise.all([srv.player('Ana'), srv.player('Bia')]);
    const created = await emit<{ code: string; password: string | null }>(
      a.socket,
      EVENTS.ROOM_CREATE,
      { settings: roomSettings(), password: 'abc12' },
    );
    expect(created.data!.password).toBe('abc12');
    const noPass = await emit(b.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
    expect(noPass.error?.code).toBe('PASSWORD_REQUIRED');
    const wrong = await emit(b.socket, EVENTS.ROOM_JOIN, {
      code: created.data!.code,
      password: 'x',
    });
    expect(wrong.error?.message).toMatch(/incorreta/);
    const ok = await emit(b.socket, EVENTS.ROOM_JOIN, {
      code: created.data!.code,
      password: 'abc12',
    });
    expect(ok.ok).toBe(true);
    const again = await emit(b.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
    expect(again.ok).toBe(true);
    // a lista pública não mostra a senha
    const list = srv.rooms.listPublic();
    expect(JSON.stringify(list)).not.toContain('abc12');
    expect(list[0]!.hasPassword).toBe(true);
  });

  it('figurinha chega como mensagem do tipo sticker; figurinha inválida é recusada', async () => {
    srv = await startTestServer();
    const [a, b] = await Promise.all([srv.player('Ana'), srv.player('Bia')]);
    const created = await emit<{ code: string }>(a.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings(),
    });
    await emit(b.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
    const got = next<{ kind: string; sticker: string }>(
      b.socket,
      EVENTS.CHAT_MESSAGE,
      (m) => m.kind === 'sticker',
    );
    expect((await emit(a.socket, EVENTS.CHAT_SEND, { sticker: 'festa' })).ok).toBe(true);
    expect((await got).sticker).toBe('festa');
    expect((await emit(a.socket, EVENTS.CHAT_SEND, { sticker: 'hack' })).ok).toBe(false);
  });

  it('Rabisco: palpite certo vira "acertou!" e a palavra não vaza no chat', async () => {
    srv = await startTestServer();
    const ps = await Promise.all(['Ana', 'Bia', 'Caio'].map((n) => srv.player(n)));
    const created = await emit<{ code: string }>(ps[0]!.socket, EVENTS.ROOM_CREATE, {
      settings: roomSettings({ gameId: 'draw' }),
    });
    for (const p of ps.slice(1))
      await emit(p.socket, EVENTS.ROOM_JOIN, { code: created.data!.code });
    const views = ps.map((p) =>
      next<GuessView>(p.socket, EVENTS.GAME_STATE, (v) => v?.phase === 'choosing'),
    );
    await emit(ps[0]!.socket, EVENTS.ROOM_START);
    const got = await Promise.all(views);
    const drawerIdx = got.findIndex((v) => v.choices);
    const drawer = ps[drawerIdx]!;
    const word = got[drawerIdx]!.choices![0]!;
    const playing = next<GuessView>(drawer.socket, EVENTS.GAME_STATE, (v) => v.phase === 'playing');
    await emit(drawer.socket, EVENTS.GAME_ACTION, { action: { type: 'choose', index: 0 } });
    await playing;
    const guesser = ps.find((p) => p !== drawer)!;
    const third = ps.find((p) => p !== drawer && p !== guesser)!;
    const leaked: string[] = [];
    third.socket.on(EVENTS.CHAT_MESSAGE, (m: { text: string }) => leaked.push(m.text));
    const correct = next<{ kind: string; text: string }>(
      third.socket,
      EVENTS.CHAT_MESSAGE,
      (m) => m.kind === 'guess-correct',
    );
    await emit(guesser.socket, EVENTS.CHAT_SEND, { text: word });
    expect((await correct).text).toMatch(/acertou/);
    await new Promise((r) => setTimeout(r, 100));
    expect(leaked.join(' ').toLowerCase()).not.toContain(word.toLowerCase());
  });
});
