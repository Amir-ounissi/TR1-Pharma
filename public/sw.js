const STATIC_CACHE = "tr1-pwa-static-v1";
const STATIC_PREFIX = "tr1-pwa-static-";
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/pwa/icon/180",
  "/pwa/icon/192",
  "/pwa/icon/512",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(STATIC_PREFIX) && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated business data or API responses.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match("/offline")) || Response.error();
      }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa/icon/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico";

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
