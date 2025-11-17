/* sw.js v50 */
const CACHE = 'ws-cache-v50';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=50',
  './app.js?v=50',
  './manifest.webmanifest',
  './assets/images/icon.png',
  './data/songs.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // BYPASS per CountAPI (anche JSONP <script>)
  const bypassHosts = new Set(['api.countapi.xyz', 'countapi.xyz']);
  if (bypassHosts.has(url.hostname)) {
    e.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }

  // Strategia cache-first
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
