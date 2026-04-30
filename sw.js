const CACHE_VERSION = "evaraos-menu-speed-fix-v7";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const CORE_ASSETS = [
  "/evaraos/",
  "/evaraos/index.html",
  "/evaraos/login.html",
  "/evaraos/dashboard.html",
  "/evaraos/customer_dashboard.html",
  "/evaraos/leads.html",
  "/evaraos/manifest.json",
  "/evaraos/assets/css/base.css?v=34",
  "/evaraos/assets/css/theme.css?v=36",
  "/evaraos/assets/css/nav.css?v=35",
  "/evaraos/assets/css/install-nav.css?v=4",
  "/evaraos/assets/css/install-apple-hotfix.css?v=1",
  "/evaraos/assets/css/home.css?v=34",
  "/evaraos/assets/css/dashboard.css?v=34",
  "/evaraos/assets/css/mobile-polish.css?v=1",
  "/evaraos/assets/css/premium-leads.css?v=1",
  "/evaraos/assets/css/lead-visibility-fix.css?v=1",
  "/evaraos/assets/js/loader.js?v=35",
  "/evaraos/assets/js/theme-css-loader.js?v=2",
  "/evaraos/assets/js/nav.js?v=38",
  "/evaraos/assets/js/performance-hotfix.js?v=1",
  "/evaraos/assets/js/install.js?v=6",
  "/evaraos/assets/js/install-click-hotfix.js?v=3",
  "/evaraos/assets/js/leads.js?v=3",
  "/evaraos/assets/js/premium-leads.js?v=1",
  "/evaraos/assets/js/customer-lead-request.js?v=1",
  "/evaraos/assets/js/offline-lead-queue.js?v=1",
  "/evaraos/assets/js/offline-leads.js?v=2",
  "/evaraos/assets/js/device-trust.js?v=1",
  "/evaraos/assets/js/evara-notifications.js?v=2",
  "/evaraos/assets/js/offline-staff-gate.js?v=1",
  "/evaraos/assets/js/dashboard-stats.js?v=1",
  "/evaraos/assets/img/evaraos_logo.png",
  "/evaraos/assets/img/icon-192.png",
  "/evaraos/assets/img/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS.map((asset) => new Request(asset, { cache: "reload" }))))
      .catch((error) => console.warn("Evaraos SW install cache skipped:", error))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key.startsWith("evaraos-") && key !== STATIC_CACHE ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

function isCoreStaticRequest(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/evaraos/");
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok && request.method === "GET") {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

async function navigationFallback(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    return (
      await cache.match(request) ||
      await cache.match("/evaraos/index.html") ||
      new Response("Evaraos is offline. Reconnect to continue.", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isNavigationRequest(request)) {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (isCoreStaticRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
