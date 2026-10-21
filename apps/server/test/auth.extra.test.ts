import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { setDbState } from '../src/db/status.js';
import { GoogleAuth, nicknameFrom, safeReturnPath } from '../src/modules/auth/google.js';
import { startTestServer } from './helpers.js';

let srv: Awaited<ReturnType<typeof startTestServer>> | null = null;
afterEach(async () => {
  setDbState('off');
  await srv?.close();
  srv = null;
});

/** Google falso: aceita o código "bom" e devolve um perfil fixo. */
function fakeGoogle(profile: Record<string, unknown>) {
  return new GoogleAuth('client-id', 'client-secret', async (url, init) => {
    if (url.includes('/token')) {
      const body = String(init?.body ?? '');
      return new Response(
        JSON.stringify(body.includes('code=bom') ? { access_token: 'tok' } : {}),
        {
          status: body.includes('code=bom') ? 200 : 400,
        },
      );
    }
    return new Response(JSON.stringify(profile), { status: 200 });
  });
}

/** Faz o fluxo: /auth/google → (Google) → /callback, mantendo os cookies. */
async function googleFlow(app: Parameters<typeof request>[0], code = 'bom', voltar = '/salas') {
  const agent = request.agent(app);
  const start = await agent.get(`/api/auth/google?voltar=${encodeURIComponent(voltar)}`);
  expect(start.status).toBe(302);
  const url = new URL(start.headers.location as string);
  expect(url.hostname).toBe('accounts.google.com');
  expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/auth\/google\/callback$/);
  const state = url.searchParams.get('state')!;
  const cb = await agent.get(`/api/auth/google/callback?code=${code}&state=${state}`);
  return { agent, cb };
}

describe('login com Google', () => {
  it('cria a conta, entra e volta para a página de origem', async () => {
    srv = await startTestServer(
      {},
      {
        google: fakeGoogle({
          sub: 'g-1',
          email: 'Ana@Gmail.com',
          email_verified: true,
          given_name: 'Ana Clara',
        }),
      },
    );
    const { agent, cb } = await googleFlow(srv.app);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/salas');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ nickname: 'Ana Clara', isGuest: false });
    // segunda vez: mesma conta (não duplica)
    const again = await googleFlow(srv.app);
    const me2 = await again.agent.get('/api/auth/me');
    expect(me2.body.user.id).toBe(me.body.user.id);
    expect(srv.users.users.size).toBe(1);
  });

  it('liga o Google a uma conta existente com o mesmo e-mail', async () => {
    srv = await startTestServer(
      {},
      {
        google: fakeGoogle({ sub: 'g-2', email: 'bia@x.com', email_verified: true, name: 'Bia' }),
      },
    );
    const reg = await request(srv.app)
      .post('/api/auth/register')
      .send({ email: 'bia@x.com', password: 'senha12345', nickname: 'Bia' });
    const { agent } = await googleFlow(srv.app);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.id).toBe(reg.body.user.id);
  });

  it('recusa estado inválido, código ruim e e-mail não verificado', async () => {
    srv = await startTestServer(
      {},
      {
        google: fakeGoogle({ sub: 'g-3', email: 'c@x.com', email_verified: false, name: 'C' }),
      },
    );
    const bad = await request(srv.app).get('/api/auth/google/callback?code=bom&state=forjado');
    expect(bad.headers.location).toMatch(/^\/entrar\?erro=/);
    const { cb } = await googleFlow(srv.app, 'ruim');
    expect(decodeURIComponent(cb.headers.location ?? '')).toMatch(/recusou/);
    const unverified = await googleFlow(srv.app);
    expect(decodeURIComponent(unverified.cb.headers.location ?? '')).toMatch(/não está verificado/);
  });

  it('sem credenciais o botão fica desligado', async () => {
    srv = await startTestServer();
    expect((await request(srv.app).get('/api/health')).body.google).toBe(false);
    const r = await request(srv.app).get('/api/auth/google');
    expect(r.headers.location).toMatch(/^\/entrar\?erro=/);
  });

  it('apelido e redirecionamento seguros', () => {
    expect(nicknameFrom('João 🎉 da Silva Sauro Junior', 'j@x.com')).toBe('João da Silva Sauro');
    expect(nicknameFrom('', 'maria.luz@x.com')).toBe('maria.luz');
    expect(nicknameFrom('😀', '@x.com')).toBe('Jogador');
    expect(safeReturnPath('//evil.com')).toBe('/');
    expect(safeReturnPath('https://evil.com')).toBe('/');
    expect(safeReturnPath('/sala/ABCDEF')).toBe('/sala/ABCDEF');
  });
});

describe('cadastro nunca fica carregando para sempre', () => {
  it('banco fora do ar: responde 503 na hora com mensagem clara', async () => {
    srv = await startTestServer();
    setDbState('error', 'ECONNREFUSED');
    const t0 = Date.now();
    const r = await request(srv.app)
      .post('/api/auth/register')
      .send({ email: 'x@x.com', password: 'senha12345', nickname: 'Xis' });
    expect(r.status).toBe(503);
    expect(r.body.error.message).toMatch(/convidado/);
    expect(Date.now() - t0).toBeLessThan(1000);
    const h = await request(srv.app).get('/api/health');
    expect(h.body).toMatchObject({ db: 'error', accounts: false });
  });

  it('mensagens de validação em português', async () => {
    srv = await startTestServer();
    const r = await request(srv.app)
      .post('/api/auth/register')
      .send({ email: 'x@x.com', password: '123', nickname: 'Xis' });
    expect(r.body.error.message).toMatch(/pelo menos 8/);
  });

  it('cadastro guarda o avatar escolhido', async () => {
    srv = await startTestServer();
    const r = await request(srv.app)
      .post('/api/auth/register')
      .send({ email: 'av@x.com', password: 'senha12345', nickname: 'Avi', avatar: 'c-123456' });
    expect(r.body.user.avatar).toBe('c-123456');
  });
});

describe('dica de erro do banco', () => {
  it('explica os erros mais comuns sem mostrar a senha', async () => {
    const { explainDbError } = await import('../src/db/status.js');
    const pooler =
      'postgresql://postgres.abc:segredo123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
    expect(explainDbError('password authentication failed for user', '28P01', pooler)).toMatch(
      /Senha/,
    );
    expect(
      explainDbError(
        'connect ETIMEDOUT',
        'ETIMEDOUT',
        'postgresql://postgres:x@db.abc.supabase.co:5432/postgres',
      ),
    ).toMatch(/Direct connection/);
    expect(explainDbError('timeout expired', undefined, pooler)).toMatch(/expirou/);
    expect(explainDbError('x', undefined, 'isso não é url')).toMatch(/não é um endereço válido/);
    expect(explainDbError('', undefined, 'https://abc.supabase.co')).toMatch(/Session pooler/);
    expect(
      explainDbError('x', undefined, 'postgresql://p:[YOUR-PASSWORD]@h:5432/postgres'),
    ).toMatch(/YOUR-PASSWORD/);
    for (const h of [
      explainDbError('password authentication failed', '28P01', pooler),
      explainDbError('timeout expired', undefined, pooler),
    ])
      expect(h).not.toContain('segredo123');
  });
});

describe('login com Google no app Android', () => {
  it('volta ao app com código de uso único que só o app (com o segredo) consegue trocar', async () => {
    const { challengeOf } = await import('../src/modules/auth/appLogin.js');
    srv = await startTestServer(
      {},
      {
        google: fakeGoogle({
          sub: 'g-app',
          email: 'app@x.com',
          email_verified: true,
          name: 'Duda',
        }),
      },
    );
    const verifier = 'v'.repeat(20) + 'segredo-do-app-1234567890-abcdefghij';
    const browser = request.agent(srv.app);
    const start = await browser.get(`/api/auth/google?app=1&challenge=${challengeOf(verifier)}`);
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const cb = await browser.get(`/api/auth/google/callback?code=bom&state=${state}`);
    expect(cb.status).toBe(200);
    // o navegador não fica logado: quem entra é o app
    expect([cb.headers['set-cookie'] ?? []].flat().join(';')).not.toMatch(/pv_token=[^;]/);
    const m =
      /intent:\/\/auth\?code=([A-Za-z0-9_-]+)#Intent;scheme=partyverse;package=online\.meuassistenteai\.partyverse;end/.exec(
        cb.text,
      );
    expect(m).not.toBeNull();
    const code = m![1]!;

    const app = request.agent(srv.app);
    const wrong = await app.post('/api/auth/app-exchange').send({ code, verifier: 'x'.repeat(50) });
    expect(wrong.status).toBe(401);
    // o código já foi gasto na tentativa errada: precisa de outro login
    const again = await app.post('/api/auth/app-exchange').send({ code, verifier });
    expect(again.status).toBe(401);

    const start2 = await browser.get(`/api/auth/google?app=1&challenge=${challengeOf(verifier)}`);
    const state2 = new URL(start2.headers.location as string).searchParams.get('state')!;
    const cb2 = await browser.get(`/api/auth/google/callback?code=bom&state=${state2}`);
    const code2 = /code=([A-Za-z0-9_-]+)#/.exec(cb2.text)![1]!;
    const ok = await app.post('/api/auth/app-exchange').send({ code: code2, verifier });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ nickname: 'Duda', isGuest: false });
    expect((await app.get('/api/auth/me')).body.user.nickname).toBe('Duda');

    // cancelou no Google: volta ao app com a mensagem
    const s3 = await browser.get(`/api/auth/google?app=1&challenge=${challengeOf(verifier)}`);
    const st3 = new URL(s3.headers.location as string).searchParams.get('state')!;
    const cancel = await browser.get(`/api/auth/google/callback?error=access_denied&state=${st3}`);
    expect(cancel.text).toContain('intent://auth?erro=');
  });
});
