/* Western Spritz — Service Worker v35 */
const CACHE_NAME = 'ws-cache-v35';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './data/songs.json'
];

// Install
self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k=>{
        if(k!==CACHE_NAME) return caches.delete(k);
      })))
  );
});

// Fetch
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(res=>{
      return res || fetch(e.request);
    })
  );
});
