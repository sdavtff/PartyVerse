import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Identity } from './token.js';

/** Esquema do link que abre o app Android (declarado no AndroidManifest). */
export const APP_SCHEME = 'partyverse';
export const APP_PACKAGE = 'online.meuassistenteai.partyverse';

const TTL_MS = 3 * 60_000;

/**
 * Login com Google no app Android. O Google não deixa entrar por dentro do app (WebView),
 * então o login acontece no navegador do celular e volta ao app com um código de uso único.
 * Para ninguém mais conseguir usar o código, o app manda antes o hash de um segredo
 * (como no PKCE) e só quem tem o segredo troca o código pela sessão.
 */
export class AppLoginCodes {
  private codes = new Map<string, { identity: Identity; challenge: string; exp: number }>();

  constructor(private now: () => number = Date.now) {}

  create(identity: Identity, challenge: string) {
    this.sweep();
    const code = randomBytes(32).toString('base64url');
    this.codes.set(code, { identity, challenge, exp: this.now() + TTL_MS });
    return code;
  }

  /** Devolve a conta se o código e o segredo baterem (o código só vale uma vez). */
  consume(code: string, verifier: string): Identity | null {
    const item = this.codes.get(code);
    if (!item) return null;
    this.codes.delete(code);
    if (item.exp < this.now()) return null;
    const a = Buffer.from(challengeOf(verifier));
    const b = Buffer.from(item.challenge);
    return a.length === b.length && timingSafeEqual(a, b) ? item.identity : null;
  }

  private sweep() {
    const t = this.now();
    for (const [k, v] of this.codes) if (v.exp < t) this.codes.delete(k);
  }
}

export const challengeOf = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

/** Link "intent://" do Chrome: abre o app direto (ou a Play Store/erro se não estiver instalado). */
export function appIntentUrl(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return `intent://auth?${q}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};end`;
}

/** Página de retorno mostrada no navegador: tenta abrir o app sozinha e tem um botão. */
export function backToAppPage(url: string, ok: boolean) {
  const esc = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const title = ok ? 'Login feito!' : 'Não deu para entrar';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${esc}">
<title>PartyVerse — ${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a14;color:#d4cfea;font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
h1{color:#fff;font-size:22px}a{display:inline-block;margin-top:18px;padding:14px 26px;border-radius:14px;color:#fff;font-weight:700;text-decoration:none;background:linear-gradient(135deg,#9b74ff,#6d28d9)}p{color:#8d85b0}</style>
</head><body><main><h1>${title}</h1><p>${ok ? 'Toque no botão se o app não abrir sozinho.' : 'Volte para o app e tente de novo.'}</p>
<a href="${esc}">Voltar para o PartyVerse</a></main></body></html>`;
}
