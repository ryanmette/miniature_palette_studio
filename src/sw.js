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

// A service worker is a background script the browser runs for this origin; it can intercept network
// requests (the `fetch` handler below) and serve cached copies, which is what makes the app work offline.
// The "app shell" is the static HTML/CSS/JS/asset skeleton that renders the UI (a PWA = installable web app).
// "Cache-first" = serve the cached copy if present, only hit the network on a miss (fast, offline-friendly).
// "Network-first" = try the network first, fall back to cache when offline (always-fresh, avoids stale code).
//
// CACHE names the current cache bucket; BUMP this string on every shell/asset change so the `activate`
// step below deletes the old bucket and `install` re-precaches fresh copies (see CLAUDE.md §8 discipline).
const CACHE = 'ps-v21';
// Everything to precache at install time so the whole app is available offline in one go.
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './styles/fonts.css', './styles/tokens.css', './styles/app.css',
  './js/app.js', './js/color.js', './js/harmony.js', './js/data.js', './js/a11y.js',
  './js/scheme.js', './js/ui.js', './js/store.js', './js/collection-io.js', './js/i18n.js',
  './assets/fonts/inter-400.woff2', './assets/fonts/inter-500.woff2', './assets/fonts/inter-600.woff2',
  './assets/fonts/space-grotesk-500.woff2', './assets/fonts/space-grotesk-600.woff2', './assets/fonts/space-grotesk-700.woff2',
  './data/paints.json',
];

// install fires when a new SW version is first registered: open the cache, precache all ASSETS, then
// skipWaiting() so this new SW takes over immediately instead of waiting for old tabs to close.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// activate fires once the new SW takes control: delete every cache bucket except the current CACHE
// (clears out old bumped versions), then clients.claim() so open pages are controlled by this SW at once.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))  // drop stale buckets
      .then(() => self.clients.claim())                                                     // take control of existing pages
  );
});

// A request is "app shell" if it's a page navigation or a same-origin .js/.css file — the code that must
// stay in sync. Those go network-first; everything else (fonts, dataset, images) is a stable cache-first asset.
const isShell = (req, url) => req.mode === 'navigate' || /\.(?:js|css)$/.test(url.pathname);

// Intercept every fetch and decide how to serve it.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;             // only GETs are cacheable; let writes (POST etc.) pass through untouched
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // anything cross-origin → straight to network

  if (isShell(req, url)) {
    // network-first, bypassing the HTTP cache: latest code when online, cache (then index.html) when offline
    e.respondWith(
      // {cache:'reload'} forces a real trip to the origin, skipping the browser's own HTTP cache so a
      // stale-but-not-expired copy can't sneak in (the max-age=600 stale-shell bug noted in the header).
      fetch(req, { cache: 'reload' }).then(res => {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));  // refresh the offline copy in the background
        return res;                                                                // serve the fresh network response
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))  // offline → cached file, else the shell page
    );
    return;
  }
  // cache-first for stable assets (fonts, dataset, icon, manifest)
  e.respondWith(
    // Serve the cached copy if we have it; otherwise fetch from network AND stash it for next time.
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));  // populate the cache on first miss
      return res;
    }))
  );
});
