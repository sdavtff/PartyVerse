import { api } from './api';
import { isIos, isStandalone } from './pwa';

/** Situação das notificações neste aparelho. */
export type PushState =
  | 'unsupported' // navegador sem suporte (ou iPhone fora do app instalado)
  | 'ios-install' // iPhone: precisa instalar na tela de início primeiro
  | 'denied' // a pessoa bloqueou nas configurações do navegador
  | 'off'
  | 'on';

const supported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register('/sw.js');
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Pede permissão, inscreve o aparelho e manda uma notificação de teste. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const { publicKey } = await api<{ publicKey: string }>('/push/key');
  let sub = await reg.pushManager.getSubscription();
  // chave do servidor mudou: refaz a inscrição
  const current = sub?.options.applicationServerKey;
  if (sub && current) {
    const a = new Uint8Array(current);
    const b = keyBytes(publicKey);
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await api('/push/subscribe', { method: 'POST', json: sub.toJSON() });
  await api('/push/test', { method: 'POST' }).catch(() => undefined);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api('/push/subscribe', { method: 'DELETE', json: { endpoint: sub.endpoint } }).catch(
      () => undefined,
    );
    await sub.unsubscribe();
  }
  return pushState();
}
