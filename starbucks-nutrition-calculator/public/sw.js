// Minimal offline app-shell service worker.
//
// This calculator's entire dataset is bundled into the JS at build time (see
// src/data/us/) - there is no live API call involved in calculating
// nutrition. That means caching the app shell (HTML/CSS/JS) is enough to let
// the calculator keep working offline with the same real data it uses
// online. This worker never invents a response for something it hasn't
// actually cached - an uncached page with no network simply fails to load,
// rather than silently showing something incorrect.

const CACHE_NAME = 'sbnc-shell-v1';
// Deliberately small and non-critical: '/' is enough of a shell to boot the
// app offline (it pulls in the JS bundle with the full embedded dataset via
// the cache-first _astro/ handler below). Manifest/icon aren't precached
// here to avoid racing the browser's own concurrent fetch of those same
// URLs on first load; they still get cached opportunistically once fetched.
const CORE_ASSETS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigations: try the network first so visitors get fresh content;
  // fall back to a cached copy of the same page (or the cached homepage)
  // only when the network is unavailable. Guarded on the Accept header too,
  // so a direct top-level request for a non-HTML resource (e.g. someone
  // opening the manifest URL itself) isn't mistaken for a page load.
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  if (request.mode === 'navigate' && acceptsHtml) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')))
    );
    return;
  }

  // Static build assets (hashed filenames, safe to cache indefinitely):
  // cache-first, populating the cache the first time each is requested.
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
