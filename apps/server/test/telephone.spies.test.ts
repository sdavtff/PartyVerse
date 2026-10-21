import type { SpiesView, TelephoneView } from '@partyverse/shared';
import { describe, expect, it } from 'vitest';
import type { AnyGameModule } from '../src/games/GameModule.js';
import { spiesGame } from '../src/games/spies/spies.game.js';
import { telephoneGame } from '../src/games/telephone/telephone.game.js';
import { fakeCtx } from './fakeCtx.js';

function setup(mod: AnyGameModule, settings: Record<string, unknown> = {}, n = 3) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const s = mod.createInitialState(
    players,
    mod.settingsSchema.parse({ ...mod.defaultSettings(), ...settings }),
  );
  const f = fakeCtx();
  const act = (pid: string, a: unknown) =>
    mod.processAction(s, pid, mod.validateAction(s, pid, a), f.ctx);
  mod.startRound(s, f.ctx);
  return { s, ...f, act, view: (id: string | null = null) => mod.viewFor(s, id) };
}

describe('Telefone sem fio', () => {
  it('escreve → desenha → descreve, cada caderno passa por todos, revelação e curtidas', () => {
    const g = setup(telephoneGame, {}, 3);
    const ps = ['p1', 'p2', 'p3'];
    expect((g.view('p1') as TelephoneView).task).toEqual({ kind: 'write' });
    for (const p of ps) g.act(p, { type: 'text', text: `frase de ${p}` });
    // desenhar: cada um recebe a frase de outro
    const prompts = ps.map((p) => (g.view(p) as TelephoneView).task);
    expect(prompts.every((t) => t?.kind === 'draw')).toBe(true);
    const got = prompts.map((t) => (t as { prompt: string }).prompt);
    expect(new Set(got).size).toBe(3);
    ps.forEach((p, i) => expect(got[i]).not.toBe(`frase de ${p}`));
    for (const p of ps) {
      g.act(p, {
        type: 'draw',
        ops: [{ t: 's', id: `a${p}`, c: '#000000', w: 7, p: [1, 2, 3, 4] }],
      });
      g.act(p, { type: 'done' });
    }
    const describe = (g.view('p1') as TelephoneView).task;
    expect(describe?.kind).toBe('describe');
    expect((describe as { ops: unknown[] }).ops).toHaveLength(1);
    for (const p of ps) g.act(p, { type: 'text', text: `vi um rabisco (${p})` });
    const v = g.view('p1') as TelephoneView;
    expect(v.phase).toBe('reveal');
    expect(v.reveal!.entries).toHaveLength(1);
    g.act('p1', { type: 'next' });
    g.act('p1', { type: 'next' });
    const book = (g.view('p1') as TelephoneView).reveal!;
    expect(book.entries.map((e) => e.kind)).toEqual(['text', 'drawing', 'text']);
    const someoneElse = book.entries.findIndex((e) => e.author !== 'p1');
    g.act('p1', { type: 'like', book: book.book, entry: someoneElse });
    const author = book.entries[someoneElse]!.author;
    expect(telephoneGame.calculateScores(g.s)[author]).toBe(15 + 10);
    const own = book.entries.findIndex((e) => e.author === 'p1');
    expect(() => g.act('p1', { type: 'like', book: book.book, entry: own })).toThrow();
    for (let i = 0; i < 10; i++) g.timers.get('phase')?.();
    expect(g.ctx.finish).toHaveBeenCalled();
  });

  it('quem não fez a tempo fica com página vazia, sem travar o jogo', () => {
    const g = setup(telephoneGame, { steps: 2 }, 3);
    g.act('p1', { type: 'text', text: 'oi' });
    g.timers.get('phase')!();
    expect((g.view('p2') as TelephoneView).phase).toBe('draw');
    g.timers.get('phase')!();
    const v = g.view() as TelephoneView;
    expect(v.phase).toBe('reveal');
    expect(v.reveal!.entries[0]!).toMatchObject({ kind: 'text' });
  });
});

describe('Espiões', () => {
  it('times, mestres veem a chave, dica, acerto, erro e assassino', () => {
    const g = setup(spiesGame, { category: 'animais' }, 4);
    let v = g.view(null) as SpiesView;
    expect(v.words).toHaveLength(25);
    expect(v.key).toBeNull();
    expect(v.teams.red).toHaveLength(2);
    const red = v.spymasters.red;
    const agent = v.teams.red.find((p) => p !== red)!;
    expect((g.view(red) as SpiesView).key).toHaveLength(25);
    expect((g.view(agent) as SpiesView).key).toBeNull();
    expect(() => g.act(agent, { type: 'clue', word: 'bicho', count: 1 })).toThrow('mestre');
    expect(() => g.act(red, { type: 'clue', word: v.words[0]!, count: 1 })).toThrow('mesa');
    g.act(red, { type: 'clue', word: 'teste', count: 1 });
    const key = (g.view(red) as SpiesView).key!;
    const mine = key.findIndex((c) => c === 'red');
    g.act(agent, { type: 'reveal', card: mine });
    v = g.view(agent) as SpiesView;
    expect(v.revealed[mine]).toBe('red');
    expect(v.remaining.red).toBe(8);
    expect(v.totals[agent]).toBe(1);
    const neutral = key.findIndex((c) => c === 'neutral');
    g.act(agent, { type: 'reveal', card: neutral });
    v = g.view() as SpiesView;
    expect(v.turn).toBe('blue');
    expect(v.phase).toBe('clue');
    // azul toca o assassino: vermelho vence
    const blue = v.spymasters.blue;
    const bAgent = v.teams.blue.find((p) => p !== blue)!;
    g.act(blue, { type: 'clue', word: 'perigo', count: 2 });
    g.act(bAgent, { type: 'reveal', card: key.indexOf('assassin') });
    v = g.view(bAgent) as SpiesView;
    expect(v.winner).toBe('red');
    expect(v.key).toHaveLength(25);
    g.timers.get('phase')!();
    expect(g.ctx.finish).toHaveBeenCalled();
  });
});
