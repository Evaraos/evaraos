const CACHE_VERSION = "evaraos-stable-v12";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/dashboard.html",
  "/customer_dashboard.html",
  "/leads.html",
  "/manifest.json",
  "/assets/css/base.css?v=34",
  "/assets/css/theme.css?v=36",
  "/assets/css/nav.css?v=37",
  "/assets/css/install-nav.css?v=5",
  "/assets/css/home.css?v=34",
  "/assets/css/dashboard.css?v=34",
  "/assets/css/mobile-polish.css?v=1",
  "/assets/css/premium-leads.css?v=1",
  "/assets/css/lead-visibility-fix.css?v=1",
  "/assets/js/loader.js?v=35",
  "/assets/js/theme-css-loader.js?v=2",
  "/assets/js/nav.js?v=37",
  "/assets/js/performance-hotfix.js?v=1",
  "/assets/js/install.js?v=8",
  "/assets/js/leads.js?v=3",
  "/assets/js/premium-leads.js?v=1",
  "/assets/js/customer-lead-request.js?v=1",
  "/assets/js/offline-lead-queue.js?v=1",
  "/assets/js/offline-leads.js?v=2",
  "/assets/js/device-trust.js?v=1",
  "/assets/js/evara-notifications.js?v=2",
  "/assets/js/offline-staff-gate.js?v=1",
  "/assets/js/dashboard-stats.js?v=1",
  "/assets/img/evaraos_logo.png",
  "/assets/img/apple-touch-icon.png",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png"
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
  return url.origin === self.location.origin && url.pathname.startsWith("/");
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
      await cache.match("/index.html") ||
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
