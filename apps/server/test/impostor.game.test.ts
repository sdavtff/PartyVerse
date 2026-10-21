import { describe, expect, it, vi } from 'vitest';
import type { ImpostorView } from '@partyverse/shared';
import { accusedFrom, impostorGame, IMPOSTOR_POINTS } from '../src/games/impostor/impostor.game.js';
import type { GameContext } from '../src/games/GameModule.js';

function setup(n = 4, rounds = 2) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const state = impostorGame.createInitialState(players, {
    ...impostorGame.defaultSettings(),
    rounds,
  });
  const timers = new Map<string, () => void>();
  const offline = new Set<string>();
  const ctx: GameContext = {
    now: () => 1000,
    setTimer: (k, _ms, fn) => void timers.set(k, fn),
    clearTimer: (k) => void timers.delete(k),
    sync: vi.fn(),
    notice: vi.fn(),
    announce: vi.fn(),
    whisper: vi.fn(),
    chatTo: vi.fn(),
    emit: vi.fn(),
    nickname: (id: string) => id,
    isOnline: (id) => !offline.has(id),
    inRoom: () => true,
    finish: vi.fn(),
  };
  const act = (pid: string, a: unknown) =>
    impostorGame.processAction(state, pid, impostorGame.validateAction(state, pid, a), ctx);
  const fire = () => timers.get('phase')!();
  impostorGame.startRound(state, ctx);
  const citizens = () => state.players.filter((p) => p !== state.impostorId);
  return { state, ctx, act, fire, citizens, offline };
}

describe('Impostor', () => {
  it('só os jogadores comuns veem o local; ninguém vê quem é o impostor', () => {
    const { state, citizens } = setup();
    const imp = impostorGame.viewFor(state, state.impostorId) as ImpostorView;
    expect(imp.me).toEqual({ isImpostor: true });
    expect(JSON.stringify(imp.me)).not.toContain(state.location);
    expect(imp.locations).toContain(state.location);
    const c = impostorGame.viewFor(state, citizens()[0]!) as ImpostorView;
    expect(c.me).toMatchObject({ isImpostor: false, location: state.location });
    expect(c.outcome).toBeNull();
    expect(JSON.stringify(c)).not.toContain(`"impostorId"`);
    const spectator = impostorGame.viewFor(state, null) as ImpostorView;
    expect(spectator.me).toBeNull();
  });

  it('impostor descoberto: comuns pontuam, com bônus para quem votou certo', () => {
    const { state, act, citizens } = setup();
    for (const p of state.players) act(p, { type: 'ready' });
    expect(state.phase).toBe('discussion');
    // maioria pede votação
    const [a, b, c] = citizens() as [string, string, string];
    act(a, { type: 'callVote' });
    act(b, { type: 'callVote' });
    expect(state.phase).toBe('discussion');
    act(c, { type: 'callVote' });
    expect(state.phase).toBe('voting');
    expect(() => act(a, { type: 'vote', targetId: a })).toThrow(/si mesmo/);
    act(a, { type: 'vote', targetId: state.impostorId });
    act(b, { type: 'vote', targetId: state.impostorId });
    act(c, { type: 'vote', targetId: a });
    // votos ficam secretos até o fim
    const mid = impostorGame.viewFor(state, a) as ImpostorView;
    expect(mid.votedPlayers.sort()).toEqual([a, b, c].sort());
    expect(mid.outcome).toBeNull();
    act(state.impostorId, { type: 'vote', targetId: c });
    expect(state.phase).toBe('round-results');
    expect(state.outcome!.reason).toBe('caught');
    const P = IMPOSTOR_POINTS;
    expect(state.totals[a]).toBe(P.caughtCitizen + P.correctVote);
    expect(state.totals[c]).toBe(P.caughtCitizen);
    expect(state.totals[state.impostorId]).toBe(0);
  });

  it('empate na votação deixa o impostor escapar', () => {
    const { state, act, fire, citizens } = setup();
    fire(); // revelação -> discussão
    fire(); // discussão -> votação
    const [a, b] = citizens() as [string, string];
    act(a, { type: 'vote', targetId: b });
    act(b, { type: 'vote', targetId: a });
    fire(); // fim do tempo de votação
    expect(state.outcome!.reason).toBe('escaped');
    expect(state.totals[state.impostorId]).toBe(IMPOSTOR_POINTS.impostorWin);
  });

  it('impostor pode chutar o local; só ele pode', () => {
    const { state, act, fire, citizens } = setup();
    fire();
    expect(() => act(citizens()[0]!, { type: 'guess', location: state.location })).toThrow(
      /Só o impostor/,
    );
    act(state.impostorId, { type: 'guess', location: state.location.toUpperCase() });
    expect(state.outcome!.reason).toBe('guessed');
    expect(state.totals[state.impostorId]).toBe(IMPOSTOR_POINTS.impostorWin);
  });

  it('chute errado dá pontos aos comuns', () => {
    const { state, act, fire, citizens } = setup();
    fire();
    const wrong = state.options.find((o) => o !== state.location)!;
    act(state.impostorId, { type: 'guess', location: wrong });
    expect(state.outcome!.reason).toBe('wrong-guess');
    expect(state.totals[citizens()[0]!]).toBe(IMPOSTOR_POINTS.wrongGuessCitizen);
  });

  it('troca impostor e local entre rodadas e termina após o total', () => {
    const { state, fire, ctx } = setup(4, 2);
    const first = { imp: state.impostorId, loc: state.location };
    fire();
    fire();
    fire(); // votação sem votos -> resultados
    fire(); // -> rodada 2
    expect(state.round).toBe(2);
    expect(state.impostorId).not.toBe(first.imp);
    expect(state.location).not.toBe(first.loc);
    fire();
    fire();
    fire();
    fire();
    expect(state.phase).toBe('finished');
    expect(ctx.finish).toHaveBeenCalledOnce();
  });

  it('jogador desconectado não trava a votação', () => {
    const { state, act, fire, citizens, offline, ctx } = setup();
    fire();
    fire();
    const [a, b, c] = citizens() as [string, string, string];
    act(a, { type: 'vote', targetId: state.impostorId });
    act(b, { type: 'vote', targetId: state.impostorId });
    act(state.impostorId, { type: 'vote', targetId: a });
    offline.add(c);
    impostorGame.onPlayerLeft!(state, c, ctx);
    expect(state.outcome!.reason).toBe('caught');
  });

  it('accusedFrom exige maioria sem empate', () => {
    expect(accusedFrom({})).toBeNull();
    expect(accusedFrom({ a: 'x', b: 'y' })).toBeNull();
    expect(accusedFrom({ a: 'x', b: 'x', c: 'y' })).toBe('x');
  });
});
