// Service Worker – UPDATE HARD
// v19: network-first per HTML, cache-first per statici.
// forza aggiornamento immediato (skipWaiting + clients.claim)

const CACHE_STATIC = 'static-v24';

const ASSETS = [
  // Non mettiamo "/" né "/index.html" qui: HTML sarà network-first
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/data/songs.json',

  // Immagini e audio principali
  '/assets/images/gruppo.png',
  '/assets/images/icon.png',
  '/assets/images/alessia.png',

  '/assets/audio/some_people.mp3',
  '/assets/audio/frusta.mp3',
  '/assets/audio/correct.mp3',
  '/assets/audio/wrong.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_STATIC).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_STATIC ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

// HTML (navigations) -> NETWORK FIRST, fallback index se offline
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  const url = new URL(req.url);

  // asset del nostro dominio -> CACHE FIRST
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(res => res || fetch(req))
    );
  }
});
