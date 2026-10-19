import type { MostLikelyView, TruthDareView, TwoTruthsView } from '@partyverse/shared';
import { describe, expect, it } from 'vitest';
import type { AnyGameModule } from '../src/games/GameModule.js';
import { mostLikelyGame, tally } from '../src/games/party/mostlikely.game.js';
import { DARES, MOST_LIKELY_PROMPTS, TRUTHS } from '../src/games/party/prompts.js';
import { truthDareGame } from '../src/games/party/truthdare.game.js';
import { twoTruthsGame } from '../src/games/party/twotruths.game.js';
import { pickQuestions } from '../src/games/quiz/quiz.game.js';
import { QUIZ_QUESTIONS } from '../src/games/quiz/quiz.questions.js';
import { wordsFor } from '../src/games/guess/words.js';
import { fakeCtx } from './fakeCtx.js';

function setup(mod: AnyGameModule, settings: Record<string, unknown> = {}, n = 3) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const s = mod.createInitialState(
    players,
    mod.settingsSchema.parse({ ...mod.defaultSettings(), ...settings }),
  );
  const { ctx, timers, offline } = fakeCtx();
  const act = (pid: string, a: unknown) =>
    mod.processAction(s, pid, mod.validateAction(s, pid, a), ctx);
  const fire = () => timers.get('phase')!();
  mod.startRound(s, ctx);
  return { s, ctx, act, fire, offline, view: (id: string | null) => mod.viewFor(s, id) };
}

describe('Quem é mais provável', () => {
  it('conta votos: quem votou na maioria e o escolhido pontuam', () => {
    const r = tally({ p1: 'p2', p2: 'p2', p3: 'p1' }, ['p1', 'p2', 'p3']);
    expect(r.chosen).toEqual(['p2']);
    expect(r.gained).toEqual({ p1: 100, p2: 150, p3: 0 });
  });

  it('partida completa e frases personalizadas primeiro', () => {
    const g = setup(mostLikelyGame, {
      rounds: 3,
      customPrompts: ['comer areia'],
      onlyCustom: false,
    });
    g.fire(); // countdown -> vote
    let v = g.view('p1') as MostLikelyView;
    expect(v.phase).toBe('vote');
    expect(v.prompt).toBe('comer areia');
    expect(() => g.act('p1', { type: 'vote', targetId: 'zz' })).toThrow();
    g.act('p1', { type: 'vote', targetId: 'p3' });
    g.act('p2', { type: 'vote', targetId: 'p3' });
    g.act('p3', { type: 'vote', targetId: 'p1' });
    v = g.view(null) as MostLikelyView;
    expect(v.phase).toBe('reveal');
    expect(v.reveal!.chosen).toEqual(['p3']);
    g.fire();
    g.fire(); // ninguém votou
    expect((g.view('p1') as MostLikelyView).reveal!.chosen).toEqual([]);
    g.fire();
    g.fire();
    g.fire();
    expect(g.ctx.finish).toHaveBeenCalled();
    expect(MOST_LIKELY_PROMPTS.length).toBeGreaterThan(40);
  });
});

describe('Verdade ou Desafio', () => {
  it('escolha, desafio, julgamento e pontos', () => {
    const g = setup(truthDareGame, {}, 3);
    let v = g.view('p1') as TruthDareView;
    const cur = v.currentId!;
    const others = ['p1', 'p2', 'p3'].filter((p) => p !== cur);
    expect(() => g.act(others[0]!, { type: 'choose', pick: 'dare' })).toThrow();
    g.act(cur, { type: 'choose', pick: 'dare' });
    v = g.view(cur) as TruthDareView;
    expect(v.phase).toBe('perform');
    expect(DARES).toContain(v.card);
    expect(() => g.act(cur, { type: 'judge', ok: true })).toThrow();
    g.act(cur, { type: 'done' });
    g.act(others[0]!, { type: 'judge', ok: true });
    g.act(others[1]!, { type: 'judge', ok: false });
    v = g.view(null) as TruthDareView;
    expect(v.phase).toBe('result');
    expect(v.result).toMatchObject({ ok: true, gained: 150 });
    expect(v.totals[cur]).toBe(150);
  });

  it('passar a vez não pontua; tempo esgotado sorteia', () => {
    const g = setup(truthDareGame, { turnsPerPlayer: 1 }, 2);
    g.fire(); // escolha automática
    const v = g.view(null) as TruthDareView;
    expect(v.phase).toBe('perform');
    expect([...TRUTHS, ...DARES]).toContain(v.card);
    g.act(v.currentId!, { type: 'skip' });
    expect((g.view(null) as TruthDareView).result).toMatchObject({ skipped: true, gained: 0 });
    g.fire(); // próxima vez
    g.fire(); // escolha
    g.fire(); // perform -> judge
    g.fire(); // judge -> result (sem votos = cumpriu)
    g.fire(); // fim
    expect(g.ctx.finish).toHaveBeenCalled();
  });
});

describe('Duas verdades e uma mentira', () => {
  it('escrever, adivinhar e pontuar sem vazar a mentira', () => {
    const g = setup(twoTruthsGame, {}, 3);
    expect((g.view('p1') as TwoTruthsView).phase).toBe('write');
    expect(() =>
      g.act('p1', { type: 'submit', statements: ['a a a', 'a a a', 'b b b'], lie: 0 }),
    ).toThrow();
    for (const p of ['p1', 'p2', 'p3'])
      g.act(p, { type: 'submit', statements: [`${p} um`, `${p} dois`, `${p} três`], lie: 2 });
    let v = g.view('p1') as TwoTruthsView;
    expect(v.phase).toBe('guess');
    const author = v.authorId!;
    const other = (['p1', 'p2', 'p3'] as const).find((p) => p !== author)!;
    const ov = g.view(other) as TwoTruthsView;
    expect(ov.reveal).toBeNull();
    expect(ov.mySubmission!.statements[0]).toBe(`${other} um`);
    const lieShown = v.statements!.indexOf(`${author} três`);
    const [a, b] = ['p1', 'p2', 'p3'].filter((p) => p !== author);
    expect(() => g.act(author, { type: 'guess', index: 0 })).toThrow();
    g.act(a!, { type: 'guess', index: lieShown });
    g.act(b!, { type: 'guess', index: (lieShown + 1) % 3 });
    v = g.view(null) as TwoTruthsView;
    expect(v.phase).toBe('reveal');
    expect(v.reveal!.lie).toBe(lieShown);
    expect(v.totals[a!]).toBe(100);
    expect(v.totals[author]).toBe(50);
    g.fire();
    g.fire();
    g.fire();
    g.fire();
    g.fire();
    expect(g.ctx.finish).toHaveBeenCalled();
  });
});

describe('temas personalizados', () => {
  it('quiz usa as perguntas do anfitrião e completa se faltar', () => {
    const qs = pickQuestions({
      questions: 5,
      secondsPerQuestion: 15,
      category: 'personalizado',
      customQuestions: [{ q: 'Cor da Ana?', a: 'Roxo', w: ['Azul', 'Verde', 'Preto'] }],
    });
    expect(qs).toHaveLength(5);
    expect(qs.some((q) => q.text === 'Cor da Ana?')).toBe(true);
    expect(qs.find((q) => q.text === 'Cor da Ana?')!.category).toBe('Personalizado');
  });

  it('novas categorias do quiz têm perguntas válidas', () => {
    for (const c of ['anime', 'games', 'musica', 'futebol'] as const) {
      const list = QUIZ_QUESTIONS.filter((q) => q.c === c);
      expect(list.length).toBeGreaterThanOrEqual(15);
      for (const q of list) expect(new Set([q.a, ...q.w]).size).toBe(4);
    }
  });

  it('palavras personalizadas', () => {
    expect(wordsFor('personalizado', 'draw', ['a1', 'b2', 'c3']).map((w) => w.word)).toEqual([
      'a1',
      'b2',
      'c3',
    ]);
    expect(wordsFor('personalizado', 'draw', ['só uma']).length).toBeGreaterThan(10);
    expect(wordsFor('futebol', 'draw').length).toBeGreaterThanOrEqual(20);
  });
});
