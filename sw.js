// Service Worker — base
const CACHE_NAME = 'static-v2';

const ASSETS = [
  '/', '/index.html',
  '/style.css?v=1', '/app.js?v=2', '/manifest.webmanifest',
  '/assets/images/icon.png',
  '/assets/images/gruppo.png',
  '/assets/audio/some_people.mp3',
  '/assets/audio/frusta.mp3'
  // gli sfondi e songs.json li prendiamo a runtime (non li “blocchiamo” in cache)
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
