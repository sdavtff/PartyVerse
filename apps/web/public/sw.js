/* global self, caches, location, fetch, Response, URL, clients */
/* PartyVerse — service worker: permite instalar como app e abre rápido / sem internet. */
const CACHE = 'pv-v2';
const SHELL = ['/', '/favicon.svg', '/icon-192.png', '/manifest.webmanifest', '/theme.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // dados ao vivo nunca vêm do cache
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // páginas: tenta a rede (versão nova sempre), e cai para a cópia salva sem internet
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // arquivos com hash no nome não mudam: cache primeiro
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// ---------- notificações push (convites, pedidos de amizade, desafio do dia) ----------
self.addEventListener('push', (e) => {
  let msg = { title: 'PartyVerse', body: '', url: '/' };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    /* mensagem sem JSON: usa o padrão */
  }
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: msg.tag,
      renotify: Boolean(msg.tag),
      data: { url: msg.url },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '/', location.origin)
    .href;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // reaproveita uma aba aberta do site; senão abre uma nova
      for (const c of list) {
        if (new URL(c.url).origin === location.origin && 'focus' in c) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(target) : undefined));
        }
      }
      return clients.openWindow(target);
    }),
  );
});
