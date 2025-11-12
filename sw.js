/* sw.js v44 — Western Spritz */
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

/* Install: precache asset principali e attiva subito */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate: pulizia cache vecchie + claim immediato */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve()))
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch: 
   - BYPASS rete per API (/api/...) e host contatori/endpoint
   - Cache-first + write-back per asset statici
*/
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 🔴 BYPASS: tutte le API e alcuni host (contatori / endpoint Vercel)
  const isApiPath = url.pathname.startsWith('/api/');
  const bypassHosts = new Set([
    'api.countapi.xyz',
    'countapi.xyz',
    'western-spritz.vercel.app' // usato per /api/visits quando lavori in locale
  ]);

  if (isApiPath || bypassHosts.has(url.hostname)) {
    e.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }

  // ✅ Cache-first con write-back per il resto (asset statici)
  e.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => {
        const copy = res.clone();
        // metti in cache solo risposte OK e solo http/https
        if (res.ok && /^https?:$/.test(url.protocol)) {
          caches.open(CACHE)
            .then(c => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      }).catch(() => cached || Response.error())
    )
  );
});
