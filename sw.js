// Service Worker — Western Spritz
const CACHE_NAME = 'static-v38'; // alza numero a ogni modifica

const ASSETS = [
  '/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest',
  '/assets/images/icon.png',
  '/assets/images/gruppo.png',
  '/assets/images/alessia.png',
  '/assets/audio/some_people.mp3',
  '/assets/audio/frusta.mp3',
  '/assets/audio/correct.mp3',
  '/assets/audio/wrong.mp3'
  // i puzzle e gli sfondi vengono caricati a runtime
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
