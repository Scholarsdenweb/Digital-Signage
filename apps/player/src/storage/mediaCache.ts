/** Talks to the service worker to precache upcoming media, and reports cache size. */

export function precacheMedia(urls: string[]) {
  navigator.serviceWorker?.controller?.postMessage({ type: 'PRECACHE_MEDIA', urls });
}

export async function cacheStats(): Promise<{ cacheBytes: number; cachedItems: number }> {
  try {
    const cache = await caches.open('dsm-media-v1');
    const keys = await cache.keys();
    let bytes = 0;
    for (const req of keys) {
      const res = await cache.match(req);
      const len = res?.headers.get('content-length');
      if (len) bytes += Number(len);
    }
    return { cacheBytes: bytes, cachedItems: keys.length };
  } catch {
    return { cacheBytes: 0, cachedItems: 0 };
  }
}
