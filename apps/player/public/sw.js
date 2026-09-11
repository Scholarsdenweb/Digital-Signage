/* Service worker: offline app shell + media cache.
   Media is cached on first fetch (cache-first) so the player keeps looping when
   the network drops. The app shell is cached so the player boots offline. */
const SHELL_CACHE = 'dsm-shell-v1';
const MEDIA_CACHE = 'dsm-media-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![SHELL_CACHE, MEDIA_CACHE].includes(k)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isMedia(url) {
  return url.pathname.includes('/media/');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Media: cache-first, then network; fall back to cache when offline.
  if (isMedia(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      }),
    );
    return;
  }

  // App shell / navigation: network-first, fall back to cache (offline boot).
  if (event.request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/player/'))),
    );
  }
});

// Allow the app to prefetch upcoming media into the cache.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE_MEDIA' && Array.isArray(event.data.urls)) {
    caches.open(MEDIA_CACHE).then((cache) =>
      Promise.all(
        event.data.urls.map((u) =>
          cache.match(u).then((hit) => (hit ? null : fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => null))),
        ),
      ),
    );
  }
});
