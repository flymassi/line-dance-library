/* sw.js v35 */
const CACHE = 'ws-cache-v35';
const CORE = [
  '/', '/index.html',
  '/style.css?v=35', '/app.js?v=35',
  '/manifest.webmanifest',
  '/assets/images/icon.png',
  '/assets/images/gruppo.png',
  '/assets/audio/some_people.mp3'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});

/* Strategia:
   - JSON e immagini: Stale-While-Revalidate (veloce + aggiorna in background)
   - asset core: Cache-First
   - offline fallback per /data/songs.json e immagini puzzle
*/
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);

  // bypass per chiamate non GET
  if (e.request.method !== 'GET') return;

  // Cache-First per core e app shell
  if (CORE.some(p=>url.pathname === p || url.pathname.startsWith(p.replace(/\?.*$/,'')))){
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r=>{
        const copy = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy));
        return r;
      }))
    );
    return;
  }

  // Stale-While-Revalidate per JSON, immagini, audio
  if (url.pathname.endsWith('.json') || url.pathname.match(/\.(png|jpg|jpeg|webp|mp3)$/i)){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        const net = fetch(e.request).then(r=>{
          const copy = r.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy));
          return r;
        }).catch(()=>cached || new Response('[]',{headers:{'Content-Type':'application/json'}}));
        return cached || net;
      })
    );
    return;
  }

  // Default: rete con fallback cache
  e.respondWith(
    fetch(e.request).catch(()=>caches.match(e.request))
  );
});
