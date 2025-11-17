/* sw.js v40 */
const CACHE = 'ws-cache-v44';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=41',
  './app.js?v=43',
  './manifest.webmanifest',
  './assets/images/icon.png',
  './data/songs.json'
];

// install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate: pulizia cache vecchie
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

// fetch (cache-first con write-back)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // bypass per host esterni che non vanno in cache (es. contatori)
  const bypassHosts = new Set(['api.countapi.xyz', 'countapi.xyz']);
  if (bypassHosts.has(url.hostname)) {
    e.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }

  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        if (res.ok && /^https?:$/.test(url.protocol)) {
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || Response.error())
    )
  );
});
