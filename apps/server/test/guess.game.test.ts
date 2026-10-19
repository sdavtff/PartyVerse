import type { GuessView } from '@partyverse/shared';
import { describe, expect, it } from 'vitest';
import {
  charadesGame,
  drawGame,
  editDistance,
  GUESS_POINTS,
  isCloseGuess,
  secretWordGame,
  type GuessState,
} from '../src/games/guess/guess.game.js';
import { fakeCtx } from './fakeCtx.js';

function setup(game = drawGame, n = 3, rounds = 1) {
  let now = 1000;
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}` }));
  const state = game.createInitialState(players, { ...game.defaultSettings(), rounds });
  const { ctx, timers, offline } = fakeCtx({ now: () => now });
  const act = (pid: string, a: unknown) =>
    game.processAction(state, pid, game.validateAction(state, pid, a), ctx);
  const fire = (k = 'phase') => timers.get(k)!();
  const chat = (pid: string, text: string) => game.onChat!(state, pid, text, ctx);
  const tick = (ms: number) => (now += ms);
  game.startRound(state, ctx);
  const others = () => state.players.filter((p) => p !== state.currentId);
  return { state, ctx, act, fire, chat, tick, timers, offline, others, game };
}

const view = (g: typeof drawGame, s: GuessState, id: string | null) =>
  g.viewFor(s, id) as GuessView;

describe('jogos de adivinhar', () => {
  it('só quem está na vez vê as opções e a palavra', () => {
    const { state, act, others } = setup();
    expect(state.phase).toBe('choosing');
    const cur = state.currentId!;
    expect(view(drawGame, state, cur).choices).toHaveLength(3);
    expect(view(drawGame, state, others()[0]!).choices).toBeNull();
    act(cur, { type: 'choose', index: 1 });
    expect(state.phase).toBe('playing');
    const mine = view(drawGame, state, cur);
    expect(mine.word).toBe(state.word);
    const theirs = view(drawGame, state, others()[0]!);
    expect(theirs.word).toBeNull();
    expect(JSON.stringify(theirs)).not.toContain(`"${state.word}"`);
    expect(theirs.mask.filter((c) => c === '_').length).toBeGreaterThan(0);
  });

  it('acerto no chat: pontos por rapidez, bônus do 1º, e o turno acaba quando todos acertam', () => {
    const { state, act, chat, others, tick, ctx } = setup();
    const cur = state.currentId!;
    act(cur, { type: 'choose', index: 0 });
    const [a, b] = others() as [string, string];
    expect(chat(a, 'palavra-errada-qualquer').consumed).toBe(false);
    expect(chat(a, state.word.toUpperCase()).consumed).toBe(true);
    expect(ctx.announce).toHaveBeenCalledWith(`${a.toUpperCase()} acertou!`, 'guess-correct');
    expect(state.guessed[0]!.points).toBe(GUESS_POINTS.max + GUESS_POINTS.firstBonus);
    // quem já acertou fala só com quem sabe
    expect(chat(a, 'que fácil').consumed).toBe(true);
    expect(ctx.chatTo).toHaveBeenCalled();
    tick(40_000);
    chat(b, state.word);
    expect(state.phase).toBe('turn-end');
    expect(state.turnScores![b]!).toBeLessThan(state.turnScores![a]!);
    expect(state.turnScores![cur]).toBe(GUESS_POINTS.perGuesser * 2);
    // fim do turno revela a palavra a todos
    expect(view(drawGame, state, b).word).toBe(state.word);
  });

  it('quem está na vez não pode escrever a palavra e "quase" avisa só quem chutou', () => {
    const { state, act, chat, others, ctx } = setup();
    const cur = state.currentId!;
    act(cur, { type: 'choose', index: 0 });
    expect(chat(cur, `é ${state.word}`).consumed).toBe(true);
    expect(ctx.whisper).toHaveBeenCalledWith(cur, expect.stringContaining('não vale'));
    const w = state.word;
    if (w.replace(/[\s-]/g, '').length >= 4) {
      const typo = w.slice(0, -1) + (w.endsWith('x') ? 'y' : 'x');
      expect(chat(others()[0]!, typo).consumed).toBe(true);
      expect(ctx.whisper).toHaveBeenCalledWith(
        others()[0],
        expect.stringContaining('quase'),
        'guess-close',
      );
    }
  });

  it('desenho: só quem desenha, traços vão para os outros e entram na visão de quem chega depois', () => {
    const { state, act, others, ctx } = setup();
    const cur = state.currentId!;
    act(cur, { type: 'choose', index: 0 });
    expect(() => act(others()[0]!, { type: 'draw', ops: [{ t: 'clear' }] })).toThrow(
      /Só quem está desenhando/,
    );
    act(cur, {
      type: 'draw',
      ops: [
        { t: 's', id: 'a1', c: '#000000', w: 4, p: [10, 10, 20, 20] },
        { t: 'a', id: 'a1', p: [30, 30] },
        { t: 'f', id: 'f1', c: '#ff0000', x: 100, y: 100 },
      ],
    });
    expect(ctx.emit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'draw' }), cur);
    const v = view(drawGame, state, others()[0]!);
    expect(v.ops).toHaveLength(2);
    expect((v.ops[0] as { p: number[] }).p).toEqual([10, 10, 20, 20, 30, 30]);
    act(cur, { type: 'draw', ops: [{ t: 'u' }] });
    expect(view(drawGame, state, null).ops).toHaveLength(1);
  });

  it('revela letras ao longo do tempo e termina após todos os turnos', () => {
    const { state, act, fire, timers, ctx } = setup(drawGame, 2, 1);
    act(state.currentId!, { type: 'choose', index: 0 });
    const before = view(drawGame, state, null).mask.filter((c) => c === '_').length;
    for (const k of ['hint0', 'hint1']) timers.get(k)?.();
    const after = view(drawGame, state, null).mask.filter((c) => c === '_').length;
    if (before >= 3) expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0); // nunca revela tudo
    fire(); // tempo acabou -> fim do turno
    fire(); // -> próximo jogador
    expect(state.turn).toBe(2);
    fire(); // escolha automática
    fire(); // tempo
    fire(); // -> fim (1 rodada × 2 jogadores)
    expect(state.phase).toBe('finished');
    expect(ctx.finish).toHaveBeenCalledOnce();
  });

  it('Palavra Secreta: dicas não podem conter a palavra e reduzem os pontos', () => {
    const { state, act, chat, others } = setup(secretWordGame);
    const cur = state.currentId!;
    act(cur, { type: 'choose', index: 0 });
    expect(() => act(cur, { type: 'clue', text: state.word })).toThrow(/não pode conter/);
    act(cur, { type: 'clue', text: 'primeira dica' });
    act(cur, { type: 'clue', text: 'segunda dica' });
    act(cur, { type: 'clue', text: 'terceira dica' });
    expect(view(secretWordGame, state, others()[0]!).clues).toHaveLength(3);
    chat(others()[0]!, state.word);
    expect(state.guessed[0]!.points).toBeLessThan(GUESS_POINTS.max + GUESS_POINTS.firstBonus);
    expect(() => act(others()[1]!, { type: 'clue', text: 'x' })).toThrow();
  });

  it('Mímica não aceita desenho; passar a vez encerra o turno', () => {
    const { state, act } = setup(charadesGame);
    const cur = state.currentId!;
    act(cur, { type: 'choose', index: 2 });
    expect(() => act(cur, { type: 'draw', ops: [{ t: 'clear' }] })).toThrow(/não tem desenho/);
    act(cur, { type: 'giveUp' });
    expect(state.phase).toBe('turn-end');
  });

  it('se quem está na vez cai, o turno passa', () => {
    const { state, act, offline, game, ctx } = setup();
    const cur = state.currentId!;
    act(cur, { type: 'choose', index: 0 });
    offline.add(cur);
    game.onPlayerLeft!(state, cur, ctx);
    expect(state.phase).toBe('turn-end');
  });

  it('comparação de palpites', () => {
    expect(editDistance('girafa', 'girafs')).toBe(1);
    expect(isCloseGuess('giraf', 'girafa')).toBe(true);
    expect(isCloseGuess('pato', 'gato')).toBe(true);
    expect(isCloseGuess('cachorroquente', 'cachorro-quente')).toBe(false); // igual = acerto, não "quase"
    expect(isCloseGuess('banana', 'tubarão')).toBe(false);
  });
});
