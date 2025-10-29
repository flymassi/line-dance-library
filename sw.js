// sw.js v40 — cache solo asset statici; i JSON passano sempre di rete
const CACHE = 'ws-v40';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './assets/images/icon.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  const isJSON = url.pathname.endsWith('.json') || req.headers.get('accept')?.includes('application/json');
  const hasBuster = url.searchParams.has('v') || /no-store|no-cache/i.test(req.headers.get('cache-control') || '');

  // JSON e richieste con cache-buster: network-first
  if (isJSON || hasBuster){
    e.respondWith(fetch(req).catch(()=>caches.match(req)));
    return;
  }

  if (req.method !== 'GET') return;

  // Asset statici: cache-first
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      });
    })
  );
});
