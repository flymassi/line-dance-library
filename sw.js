// sw.js - versione "sempre fresco"

self.addEventListener('install', event => {
  // salta subito alla nuova versione
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // prendi il controllo di tutte le pagine aperte
  event.waitUntil(self.clients.claim());
});

// NIENTE CACHE: ogni richiesta va direttamente alla rete
self.addEventListener('fetch', event => {
  // per sicurezza, usiamo no-store sugli asset
  const req = new Request(event.request, { cache: 'no-store' });

  event.respondWith(
    fetch(req).catch(() => fetch(event.request)) // piccola fallback
  );
});
