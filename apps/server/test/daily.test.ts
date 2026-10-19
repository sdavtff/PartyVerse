import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dailyQuiz, dailyStop, dayKey, scoreStopDay } from '../src/modules/daily/daily.service.js';
import { startTestServer } from './helpers.js';

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

describe('desafio diário', () => {
  it('é o mesmo para todos no mesmo dia e muda no outro', () => {
    expect(dailyQuiz('2026-10-19')).toEqual(dailyQuiz('2026-10-19'));
    expect(dailyQuiz('2026-10-19')[0]!.text).not.toBe(dailyQuiz('2026-10-20')[0]!.text);
    expect(dailyStop('2026-10-19').categories).toHaveLength(6);
    // virada do dia no horário de Brasília
    expect(dayKey(Date.parse('2026-10-20T02:59:00Z'))).toBe('2026-10-19');
    expect(dayKey(Date.parse('2026-10-20T03:00:00Z'))).toBe('2026-10-20');
  });

  it('pontua adedonha pela raridade', () => {
    const cats = ['Animal', 'Cor'];
    const s = scoreStopDay(
      [
        { userId: 'a', data: { answers: { Animal: 'Macaco', Cor: 'Marrom' } } },
        { userId: 'b', data: { answers: { Animal: 'macaco', Cor: 'Xadrez' } } },
        { userId: 'c', data: { answers: { Animal: 'Mula', Cor: '' } } },
      ],
      'M',
      cats,
    );
    expect(s.get('a')!.points).toEqual({ Animal: 5, Cor: 10 });
    expect(s.get('b')!.points).toEqual({ Animal: 5, Cor: 0 });
    expect(s.get('c')!.score).toBe(10);
  });

  it('quiz do dia: não vaza a resposta, uma vez por dia, XP e conquista', async () => {
    const ana = await account('ana@x.com', 'Ana');
    const qs = (await ana.agent.get('/api/daily/quiz')).body;
    expect(qs).toHaveLength(10);
    expect(JSON.stringify(qs)).not.toMatch(/correct/);
    const solution = dailyQuiz(dayKey()).map((q) => q.correct);
    const answers = solution.map((c, i) => (i < 7 ? c : (c + 1) % 4));
    const r = await ana.agent.post('/api/daily/quiz').send({ answers });
    expect(r.status).toBe(200);
    expect(r.body.result.score).toBe(700);
    expect(r.body.reward.achievements).toContain('daily_done');
    expect((await ana.agent.post('/api/daily/quiz').send({ answers })).status).toBe(409);
    const st = (await ana.agent.get('/api/daily')).body;
    expect(st.quiz.done.score).toBe(700);
    expect(st.streak).toBe(1);
    const rank = (await request(t.app).get('/api/daily/ranking?game=quiz')).body;
    expect(rank[0]).toMatchObject({ nickname: 'Ana', score: 700, place: 1 });
  });

  it('adedonha do dia e convidado fora do ranking', async () => {
    const ana = await account('ana@x.com', 'Ana');
    const bia = await account('bia@x.com', 'Bia');
    const { letter, categories } = dailyStop(dayKey());
    const mk = (suffix: string) =>
      Object.fromEntries(categories.map((c) => [c, `${letter}${suffix}${c}`]));
    await ana.agent.post('/api/daily/stop').send({ answers: mk('aa') });
    const r = await bia.agent.post('/api/daily/stop').send({ answers: mk('aa') });
    expect(r.body.result.score).toBe(30); // tudo repetido: 5 por categoria
    const guest = request.agent(t.app);
    await guest.post('/api/auth/guest').send({ nickname: 'Visita' });
    expect((await guest.post('/api/daily/stop').send({ answers: {} })).status).toBe(401);
    expect((await guest.get('/api/daily')).body.quiz.done).toBeNull();
  });
});
