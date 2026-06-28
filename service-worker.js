// ============================================================
//  UKSDS Task Manager — Service Worker
//  Enables offline use and app-like behaviour on phones
// ============================================================
const CACHE_NAME = 'kaushal-kartavya-v1';
const ASSETS = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (url.includes('script.google.com')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error:'offline' }), { headers:{'Content-Type':'application/json'} })));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached =>
    cached || fetch(event.request).then(response =>
      caches.open(CACHE_NAME).then(cache => {
        if (event.request.method === 'GET' && response.status === 200) cache.put(event.request, response.clone());
        return response;
      })).catch(() => cached)));
});
