// sw.js — service worker for offline use (PWA shell + bundled dataset + self-hosted fonts). Cache-first
// for same-origin GETs. Fonts are now first-party (styles/fonts.css + assets/fonts/*.woff2), so there
// are NO third-party runtime requests. Bump CACHE to invalidate. The app is a static file set.

const CACHE = 'ps-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './styles/fonts.css', './styles/tokens.css', './styles/app.css',
  './js/app.js', './js/color.js', './js/harmony.js', './js/data.js', './js/a11y.js',
  './js/scheme.js', './js/ui.js', './js/store.js', './js/collection-io.js', './js/i18n.js',
  './assets/fonts/inter-400.woff2', './assets/fonts/inter-500.woff2', './assets/fonts/inter-600.woff2',
  './assets/fonts/space-grotesk-500.woff2', './assets/fonts/space-grotesk-600.woff2', './assets/fonts/space-grotesk-700.woff2',
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
