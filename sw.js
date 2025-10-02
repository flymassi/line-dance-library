const CACHE = 'line-dance-v4';
const ASSETS = [
'/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest',
'/data/songs.json',
'/assets/images/line.jpg', '/assets/images/gruppo.png', '/assets/images/icon.png',
'/assets/audio/some_people.mp3', '/assets/audio/frusta.mp3'
];


self.addEventListener('install', e => {
e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});


self.addEventListener('activate', e => {
e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});


self.addEventListener('fetch', e => {
const url = new URL(e.request.url);
if (url.origin === location.origin) {
e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
}
});