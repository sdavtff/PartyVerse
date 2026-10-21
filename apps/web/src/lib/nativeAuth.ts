import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { api, type Identity } from './api';
import { isNativeApp } from './platform';

const VERIFIER_KEY = 'pv:app-login';

/** O app instalado tem o necessário para o login com Google pelo navegador? (APKs antigos não) */
export const canGoogleInApp = () =>
  isNativeApp() &&
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('Browser') &&
  Capacitor.isPluginAvailable('App');

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/**
 * Abre o login do Google no navegador do celular (o Google não permite dentro do app).
 * No fim, o servidor manda o navegador de volta ao app com um código de uso único.
 */
export async function startGoogleInApp(back: string, avatar: string) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  try {
    localStorage.setItem(VERIFIER_KEY, JSON.stringify({ verifier, back }));
  } catch {
    /* sem armazenamento: o login falha com mensagem clara na volta */
  }
  const q = new URLSearchParams({ app: '1', challenge, voltar: back, avatar });
  await Browser.open({
    url: `${location.origin}/api/auth/google?${q}`,
    presentationStyle: 'popover',
  });
}

/**
 * Escuta a volta do navegador (partyverse://auth?...) e troca o código pela sessão.
 * Retorna uma função para parar de escutar.
 */
export function listenGoogleReturn(handlers: {
  onLogin: (user: Identity, back: string) => void;
  onError: (message: string) => void;
}) {
  if (!canGoogleInApp()) return () => undefined;
  const sub = App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith('partyverse://auth')) return;
    void Browser.close().catch(() => undefined);
    const params = new URL(url.replace('partyverse://', 'https://app/')).searchParams;
    const erro = params.get('erro');
    if (erro) return handlers.onError(erro);
    let saved: { verifier?: string; back?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(VERIFIER_KEY) ?? '{}');
      localStorage.removeItem(VERIFIER_KEY);
    } catch {
      /* ignora */
    }
    const code = params.get('code');
    if (!code || !saved.verifier) return handlers.onError('O login expirou. Tente de novo.');
    try {
      const r = await api<{ user: Identity }>('/auth/app-exchange', {
        method: 'POST',
        json: { code, verifier: saved.verifier },
      });
      handlers.onLogin(r.user, saved.back || '/');
    } catch (e) {
      handlers.onError((e as Error).message);
    }
  });
  return () => {
    void sub.then((s) => s.remove());
  };
}
