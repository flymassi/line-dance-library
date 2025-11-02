/* sw.js v30 */
const CACHE = 'ws-cache-v30';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=30',
  './app.js?v=30',
  './assets/images/icon.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=> k===CACHE?null:caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method!=='GET') return;
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res=>{
        // salviamo solo risposte OK con schema http/https
        const copy = res.clone();
        const url  = new URL(req.url);
        if (res.ok && (url.protocol==='http:' || url.protocol==='https:')){
          caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=> cached || Response.error())
    )
  );
});
