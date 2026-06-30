// sw.js — service worker for offline use (PWA shell + bundled dataset + self-hosted fonts).
//
// Strategy (avoids the stale-shell mismatch where a new index.html runs an old app.js):
//  • App shell — navigations + same-origin .js / .css → NETWORK-FIRST: always load the latest from the
//    network when online (GitHub Pages serves one consistent deploy), falling back to cache when offline.
//    This means a deploy can't leave a browser running mismatched HTML+JS even if CACHE isn't bumped.
//  • Stable assets — fonts (.woff2), the dataset (paints.json), icon/manifest → CACHE-FIRST (big, rarely
//    change; fast + offline). They refresh whenever CACHE is bumped (install re-precaches).
// Shell fetches use {cache:'reload'} so they BYPASS the browser HTTP cache — GitHub Pages sends
// `cache-control: max-age=600`, so a plain network-first fetch can still return a stale app.js against a
// fresh index.html (the v1.3.0 bug). 'reload' always hits the origin and refreshes the HTTP cache.
// Bump CACHE on any shell/asset change. skipWaiting + clients.claim hand control to the new SW promptly.

const CACHE = 'ps-v9';
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

const isShell = (req, url) => req.mode === 'navigate' || /\.(?:js|css)$/.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // anything cross-origin → straight to network

  if (isShell(req, url)) {
    // network-first, bypassing the HTTP cache: latest code when online, cache (then index.html) when offline
    e.respondWith(
      fetch(req, { cache: 'reload' }).then(res => {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  // cache-first for stable assets (fonts, dataset, icon, manifest)
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
