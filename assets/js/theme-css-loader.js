(function () {
  const loadedModules = new Set();
  const loadedStylesheets = new Set();
  let swRegistrationStarted = false;

  function getAssetPath(value) {
    try {
      return new URL(value, window.location.origin).pathname;
    } catch {
      return String(value || "").split("?")[0];
    }
  }

  function markThemeHydrated() {
    document.documentElement.setAttribute("data-evara-theme-ready", "true");
  }

  function removeOldVisualModes() {
    document.documentElement.removeAttribute("data-beam-mode");
    document.documentElement.removeAttribute("data-user-beam-off");

    const oldGalaxyLink = document.getElementById("evaraGalaxyCss");
    if (oldGalaxyLink) oldGalaxyLink.disabled = true;

    if (window.EvaraGalaxy && typeof window.EvaraGalaxy.stop === "function") {
      window.EvaraGalaxy.stop();
    }
  }

  function syncCss() {
    removeOldVisualModes();
    markThemeHydrated();
  }

  function loadStylesheetOnce(href, id) {
    const targetPath = getAssetPath(href);
    const alreadyLoaded =
      document.getElementById(id) ||
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((link) => {
        const current = link.getAttribute("href") || link.href || "";
        return getAssetPath(current) === targetPath;
      });

    if (loadedStylesheets.has(targetPath) || alreadyLoaded) return;

    loadedStylesheets.add(targetPath);
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScriptOnce(src, id) {
    const targetPath = getAssetPath(src);
    const alreadyLoaded =
      document.getElementById(id) ||
      Array.from(document.scripts).some((script) => {
        const current = script.getAttribute("src") || script.src || "";
        return getAssetPath(current) === targetPath;
      });

    if (alreadyLoaded) return;

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    document.body.appendChild(script);
  }

  function loadModuleOnce(src) {
    if (loadedModules.has(src)) return;
    loadedModules.add(src);
    import(src).catch((error) => console.warn("Evaraos module load skipped:", src, error));
  }

  function registerServiceWorker() {
    if (swRegistrationStarted || !("serviceWorker" in navigator)) return;
    swRegistrationStarted = true;

    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      })
      .catch((error) => console.warn("Evaraos service worker registration skipped:", error));
  }

  function bootGlobalModules() {
    loadStylesheetOnce("/assets/css/install-nav.css?v=6", "evaraInstallNavCss");
    loadModuleOnce("/assets/js/evara-notifications.js?v=1");
    loadModuleOnce("/assets/js/offline-staff-gate.js?v=1");
    loadScriptOnce("/assets/js/performance-hotfix.js?v=1", "evaraPerformanceHotfixScript");
    loadScriptOnce("/assets/js/install.js?v=9", "evaraInstallScript");
  }

  function bootPageModules() {
    const path = window.location.pathname;

    bootGlobalModules();

    if (path.endsWith("/leads.html")) {
      loadStylesheetOnce("/assets/css/premium-leads.css?v=1", "evaraPremiumLeadsCss");
      loadStylesheetOnce("/assets/css/lead-visibility-fix.css?v=1", "evaraLeadVisibilityFixCss");
      loadModuleOnce("/assets/js/leads.js?v=3");
      loadModuleOnce("/assets/js/offline-leads.js?v=2");
      loadModuleOnce("/assets/js/premium-leads.js?v=1");
    }

    if (path.endsWith("/customer_dashboard.html")) {
      loadStylesheetOnce("/assets/css/premium-leads.css?v=1", "evaraPremiumLeadsCss");
      loadModuleOnce("/assets/js/customer-lead-request.js?v=1");
    }

    if (path.endsWith("/dashboard.html")) {
      loadModuleOnce("/assets/js/dashboard-stats.js?v=1");
    }
  }

  function init() {
    syncCss();
    registerServiceWorker();
    bootPageModules();

    window.addEventListener("evara:theme-ready", syncCss);
    window.addEventListener("evara:theme-changed", syncCss);
    window.addEventListener("pageshow", () => {
      syncCss();
      registerServiceWorker();
      bootPageModules();
    });

    const observer = new MutationObserver(syncCss);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    const bootstrapApi = {
      syncCss,
      markThemeHydrated,
      bootPageModules,
      registerServiceWorker,
      syncBeamPreferences: syncCss,
      loadGalaxyCss: syncCss,
      disableGalaxyCss: syncCss,
      getState() {
        return {
          theme: document.documentElement.getAttribute("data-theme") || "light",
          hydrated: document.documentElement.getAttribute("data-evara-theme-ready") === "true",
          visualStack: "apple-settings-glass",
          loadedModules: Array.from(loadedModules),
          loadedStylesheets: Array.from(loadedStylesheets),
          swRegistrationStarted
        };
      }
    };

    window.EvaraThemeCssLoader = bootstrapApi;
    window.EvaraAppBootstrap = bootstrapApi;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
