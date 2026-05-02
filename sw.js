const CACHE_VERSION = "evaraos-no-cache-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => {
      if (event.request.mode === "navigate") {
        return new Response("Evaraos is offline. Reconnect to continue.", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      }
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
