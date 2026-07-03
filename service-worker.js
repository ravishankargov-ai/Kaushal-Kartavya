// ============================================================
//  Kaushal Kartavya — Service Worker  (v5)
//  Network-first for the app HTML so updates always appear.
// ============================================================
const CACHE_NAME = 'kaushal-kartavya-v11';
const ASSETS = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Apps Script calls always go to network (never cached)
  if (url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error:'offline' }), { headers:{'Content-Type':'application/json'} }))
    );
    return;
  }

  // App HTML / navigation: NETWORK-FIRST so new versions show immediately
  const isHTML = event.request.mode === 'navigate' ||
                 url.endsWith('/') || url.endsWith('index.html');
  if (isHTML) {
    event.respondWith(
      fetch(event.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return resp;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Other assets (icons, manifest): cache-first
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(resp => {
        if (event.request.method === 'GET' && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached))
  );
});
