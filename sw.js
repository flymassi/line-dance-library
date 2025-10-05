const CACHE_NAME = 'static-v11';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=11',
  './app.js?v=11',
  './assets/images/icon.png',
  './assets/images/gruppo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
      return resp;
    }).catch(() => cached))
  );
});
