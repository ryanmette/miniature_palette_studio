// sw.js — service worker for offline use (PWA shell + bundled dataset). Cache-first for same-origin
// GETs; cross-origin (the Google Fonts CDN) passes through to the network with the in-app system-font
// fallback covering offline. Bump CACHE to invalidate. The app is a static file set, so this is simple.

const CACHE = 'ps-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './styles/tokens.css', './styles/app.css',
  './js/app.js', './js/color.js', './js/harmony.js', './js/data.js', './js/a11y.js',
  './js/scheme.js', './js/ui.js', './js/store.js', './js/i18n.js',
  './data/paints.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // fonts etc. → straight to network
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html')))   // offline navigation fallback
  );
});
