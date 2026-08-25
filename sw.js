const CACHE = 'irish-academic-opportunities-v18-geographic-search';
const CORE = [
  './',
  './index.html',
  './config.js',
  './finder.css',
  './upcoming.css',
  './stage3.css',
  './stage4.css',
  './stage6.css',
  './stage8.css',
  './stage8-mobile.css',
  './feedback-visibility.css',
  './finder-core.js',
  './finder-data.js',
  './geo-search.js',
  './finder-ui.js',
  './upcoming.js',
  './stage3.js',
  './stage4.js',
  './stage5.js',
  './stage8.js',
  './stage8-mobile.js',
  './feedback-visibility.js',
  './schools.html',
  './student-guide.html',
  './about.html',
  './launch-pack.html',
  './launch.css',
  './launch.js',
  './qr-code.svg',
  './qr-poster.pdf',
  './manifest.webmanifest',
  './icon.svg',
  './404.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const path = url.pathname.endsWith('/') ? './index.html' : './' + url.pathname.split('/').pop();
            caches.open(CACHE).then(cache => cache.put(path, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const direct = await caches.match('./' + url.pathname.split('/').pop());
          return direct || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
