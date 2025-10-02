// sw.js — Service Worker per Western Spritz
const CACHE_NAME = 'static-v33'; // <<< incrementa qui per forzare update

// Elenco risorse da cachare (aggiungi se ne servono altre)
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/assets/images/gruppo.png',
  '/assets/audio/some_people.mp3',
  '/assets/audio/frusta.mp3',
  '/assets/audio/correct.mp3',
  '/assets/audio/wrong.mp3',
  '/assets/images/alessia.png'
  // non metto i puzzle uno per uno: li caricherà runtime
];

self.addEventListener('install', (e) => {
  console.log('[SW] Install');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate');
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Intercetta richieste e serve da cache se possibile
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return (
        res ||
        fetch(e.request).then((response) => {
          return response;
        })
      );
    })
  );
});
