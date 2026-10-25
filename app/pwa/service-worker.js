/* global __PWA_ASSETS__ */
/* The Vite client build replaces these tokens with immutable asset URLs/version. */
const VERSION = "__PWA_VERSION__";
const PRECACHE_URLS = __PWA_ASSETS__;
const PREFIX = "dharmaradio-";
const PRECACHE = `${PREFIX}assets-${VERSION}`;
const PAGES = `${PREFIX}pages-${VERSION}`;
const IMAGES = `${PREFIX}images-${VERSION}`;
const OFFLINE = "/pwa-offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  // Wait for the UI's update confirmation before replacing an active worker.
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, PAGES, IMAGES]);
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith(PREFIX) && !keep.has(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
const publicResponse = (response) =>
  response.ok &&
  response.type !== "opaque" &&
  !/private|no-store/i.test(response.headers.get("Cache-Control") || "") &&
  !response.headers.has("Set-Cookie") &&
  response.headers.get("Vary") !== "*";
async function putLimited(cacheName, request, response, limit) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - limit))
      .map((key) => cache.delete(key)),
  );
}
const isTeacherImage = (url, request) =>
  request.destination === "image" &&
  (url.hostname === "dharmaseed.org" ||
    url.hostname.endsWith(".dharmaseed.org")) &&
  (/\/(teachers?|media|images?)\//.test(url.pathname) ||
    /\/uploads\/photos\/teacher_/.test(url.pathname));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // These exclusions precede *all* respondWith calls, including navigations.
  // Audio is opt-in future work, even if same-origin or requested as a Range.
  if (
    request.method !== "GET" ||
    /^\/api(?:\/|$)/i.test(url.pathname) ||
    request.destination === "audio" ||
    request.destination === "video" ||
    request.headers.has("Range") ||
    /\.(?:mp3|m4a|aac|ogg|opus|wav|flac|mp4|webm)(?:$|\/)/i.test(
      url.pathname,
    ) ||
    request.headers.has("Authorization")
  )
    return;
  if (url.origin === self.location.origin && request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(request, { signal: controller.signal });
          if (response.status >= 500) throw new Error("Navigation unavailable");
          if (publicResponse(response))
            event.waitUntil(putLimited(PAGES, request, response.clone(), 30));
          return response;
        } catch {
          const cached =
            (await cache.match(request)) ||
            (await (await caches.open(PRECACHE)).match(OFFLINE));
          // Cloudflare redirects .html assets to clean URLs. A synthesized response
          // clears the cached redirect flag so offline navigations can consume it.
          if (cached)
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers: cached.headers,
            });
          return new Response(
            "You’re offline. Reconnect to browse Dharma Radio.",
            { headers: { "Content-Type": "text/plain; charset=utf-8" } },
          );
        } finally {
          clearTimeout(timeout);
        }
      })(),
    );
    return;
  }
  if (
    url.origin === self.location.origin &&
    PRECACHE_URLS.includes(url.pathname)
  ) {
    event.respondWith(
      caches
        .open(PRECACHE)
        .then(
          async (cache) => (await cache.match(url.pathname)) || fetch(request),
        ),
    );
    return;
  }
  if (isTeacherImage(url, request)) {
    const update = fetch(request).then(async (response) => {
      // Cross-origin <img> loads are opaque; only this narrow image rule allows them.
      if (response.ok || response.type === "opaque")
        await putLimited(IMAGES, request, response.clone(), 40).catch(
          () => undefined,
        );
      return response;
    });
    event.waitUntil(update.catch(() => undefined));
    event.respondWith(
      caches
        .open(IMAGES)
        .then(async (cache) => (await cache.match(request)) || update),
    );
  }
});
