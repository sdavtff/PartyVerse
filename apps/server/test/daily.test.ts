import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayKey, scoreStopDay } from '../src/modules/daily/daily.service.js';
import {
  bankChallenge,
  buildPrompt,
  generateChallenge,
  rotation,
} from '../src/modules/daily/generator.js';
import { DAILY_QUESTIONS } from '../src/modules/daily/daily.bank.js';
import { QUIZ_QUESTIONS } from '../src/games/quiz/quiz.questions.js';

const dailyQuiz = (day: string) => bankChallenge(day).quiz;
const dailyStop = (day: string) => bankChallenge(day).stop;
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
      { letter: 'M', categories: cats },
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

describe('conteúdo do desafio', () => {
  it('banco exclusivo: sem perguntas do Quiz normal e sem repetir por semanas', () => {
    const normal = new Set(QUIZ_QUESTIONS.map((q) => q.q));
    expect(DAILY_QUESTIONS.filter((q) => normal.has(q.q))).toEqual([]);
    expect(new Set(DAILY_QUESTIONS.map((q) => q.q)).size).toBe(DAILY_QUESTIONS.length);
    for (const q of DAILY_QUESTIONS) expect(new Set([q.a, ...q.w]).size).toBe(4);
    // 14 dias seguidos: nenhuma pergunta repete
    const seen = new Set<string>();
    for (let d = 1; d <= 14; d++) {
      const day = `2026-01-${String(d).padStart(2, '0')}`;
      for (const q of dailyQuiz(day)) {
        expect(seen.has(q.text)).toBe(false);
        seen.add(q.text);
      }
    }
    expect(rotation([1, 2, 3, 4], '2026-01-01', 2, 'x')).toHaveLength(2);
    // nenhum dia tem pergunta repetida, nem na virada do rodízio
    for (let d = 0; d < 400; d++) {
      const day = new Date(Date.parse('2026-01-01T12:00:00Z') + d * 86400_000)
        .toISOString()
        .slice(0, 10);
      const texts = dailyQuiz(day).map((q) => q.text);
      expect(new Set(texts).size).toBe(10);
    }
  });

  const aiReply = (n = 10) => ({
    perguntas: Array.from({ length: n }, (_, i) => ({
      tema: 'Teste',
      pergunta: `Pergunta inventada número ${i + 1}?`,
      certa: `Certa ${i}`,
      erradas: [`A${i}`, `B${i}`, `C${i}`],
    })),
    categorias: ['Fruta', 'Cor', 'Doce', 'Animal', 'Lugar', 'Bebida', 'Hobby'],
  });
  const fakeFetch = (body: unknown, status = 200) =>
    (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '```json\n' + JSON.stringify(body) + '\n```' } }],
        }),
        { status },
      )) as unknown as typeof fetch;

  it('gera com IA quando há chave, e cai para o banco se a IA falhar', async () => {
    const ok = await generateChallenge('2026-11-05', {
      apiKey: 'k',
      model: 'm',
      fetchFn: fakeFetch(aiReply()),
    });
    expect(ok.source).toBe('ia');
    expect(ok.quiz).toHaveLength(10);
    expect(ok.quiz[0]!.options[ok.quiz[0]!.correct]).toBe('Certa 0');
    expect(ok.stop.categories).toHaveLength(6);

    const bad = await generateChallenge('2026-11-05', {
      apiKey: 'k',
      model: 'm',
      fetchFn: fakeFetch(aiReply(4)),
    });
    expect(bad.source).toBe('banco');
    const down = await generateChallenge('2026-11-05', {
      apiKey: 'k',
      model: 'm',
      fetchFn: fakeFetch({ error: 'x' }, 500),
    });
    expect(down.source).toBe('banco');
    expect(buildPrompt('2026-11-05', 'M', ['velha?'])).toContain('velha?');
  });

  it('servidor usa o conteúdo da IA, igual para todos e gerado uma vez só', async () => {
    await t.close();
    let calls = 0;
    const f = fakeFetch(aiReply());
    t = await startTestServer(
      { OPENROUTER_API_KEY: 'chave-teste' },
      {
        aiFetch: (async (...a: Parameters<typeof fetch>) => {
          calls++;
          return f(...a);
        }) as typeof fetch,
      },
    );
    const ana = await account('ana@x.com', 'Ana');
    const bia = await account('bia@x.com', 'Bia');
    const [q1, q2] = await Promise.all([
      ana.agent.get('/api/daily/quiz'),
      bia.agent.get('/api/daily/quiz'),
    ]);
    expect(q1.body[0].text).toBe('Pergunta inventada número 1?');
    expect(q2.body).toEqual(q1.body);
    expect(calls).toBe(1);
    expect(JSON.stringify(q1.body)).not.toMatch(/correct/);
    const st = (await ana.agent.get('/api/daily')).body;
    expect(st.source).toBe('ia');
    // resposta toda certa = 1000
    const answers = (q1.body as { options: string[] }[]).map((q, i) =>
      q.options.indexOf(`Certa ${i}`),
    );
    const r = await ana.agent.post('/api/daily/quiz').send({ answers });
    expect(r.body.result.score).toBe(1000);
    expect(r.body.result.questions[0].text).toBe('Pergunta inventada número 1?');
  });
});

describe('desafio guardado no banco', () => {
  it('se o banco falha ao guardar, tenta de novo depois e mantém o mesmo conteúdo', async () => {
    const { DailyService } = await import('../src/modules/daily/daily.service.js');
    const { MemoryChallengeStore, MemoryDailyRepository } =
      await import('../src/modules/daily/daily.repository.js');
    const store = new MemoryChallengeStore();
    let fail = true;
    const orig = store.saveIfMissing.bind(store);
    store.saveIfMissing = async (d, c) => {
      if (fail) throw new Error('banco fora');
      return orig(d, c);
    };
    const svc = new DailyService(new MemoryDailyRepository(() => undefined), store, { model: 'x' });
    const a = await svc.challenge('2026-10-10');
    expect(store.rows.size).toBe(0);
    fail = false;
    const realNow = Date.now;
    Date.now = () => realNow() + 61_000;
    try {
      const b = await svc.challenge('2026-10-10');
      expect(b).toEqual(a);
      expect(store.rows.get('2026-10-10')).toEqual(a);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('dia seguinte', () => {
  it('amanhã só fica guardado quando vem da IA', async () => {
    const { DailyService, dayKey: dk } = await import('../src/modules/daily/daily.service.js');
    const { MemoryChallengeStore, MemoryDailyRepository } =
      await import('../src/modules/daily/daily.repository.js');
    const store = new MemoryChallengeStore();
    const svc = new DailyService(new MemoryDailyRepository(() => undefined), store, { model: 'x' });
    const tomorrow = new Date(Date.parse(`${dk()}T12:00:00Z`) + 86400_000)
      .toISOString()
      .slice(0, 10);
    expect((await svc.challenge(tomorrow)).source).toBe('banco');
    expect(store.rows.has(tomorrow)).toBe(false);
    await svc.challenge(dk());
    expect(store.rows.has(dk())).toBe(true);
  });
});
