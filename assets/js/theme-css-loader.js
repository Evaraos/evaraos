(function () {
  const loadedModules = new Set();
  const loadedStylesheets = new Set();
  let swRegistrationStarted = false;

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
    if (loadedStylesheets.has(href) || document.getElementById(id)) return;
    loadedStylesheets.add(href);
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScriptOnce(src, id) {
    if (document.getElementById(id)) return;
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

    navigator.serviceWorker.register("/evaraos/sw.js", { scope: "/evaraos/" })
      .then((registration) => {
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      })
      .catch((error) => console.warn("Evaraos service worker registration skipped:", error));
  }

  function bootGlobalModules() {
    loadStylesheetOnce("/evaraos/assets/css/install-nav.css?v=1", "evaraInstallNavCss");
    loadStylesheetOnce("/evaraos/assets/css/install-apple-hotfix.css?v=1", "evaraInstallAppleHotfixCss");
    loadModuleOnce("/evaraos/assets/js/evara-notifications.js?v=1");
    loadModuleOnce("/evaraos/assets/js/offline-staff-gate.js?v=1");
    loadScriptOnce("/evaraos/assets/js/install.js?v=6", "evaraInstallScript");
    loadScriptOnce("/evaraos/assets/js/install-click-hotfix.js?v=3", "evaraInstallClickHotfixScript");
  }

  function bootPageModules() {
    const path = window.location.pathname;

    bootGlobalModules();

    if (path.endsWith("/leads.html")) {
      loadStylesheetOnce("/evaraos/assets/css/premium-leads.css?v=1", "evaraPremiumLeadsCss");
      loadStylesheetOnce("/evaraos/assets/css/lead-visibility-fix.css?v=1", "evaraLeadVisibilityFixCss");
      loadModuleOnce("/evaraos/assets/js/leads.js?v=3");
      loadModuleOnce("/evaraos/assets/js/offline-leads.js?v=2");
      loadModuleOnce("/evaraos/assets/js/premium-leads.js?v=1");
    }

    if (path.endsWith("/customer_dashboard.html")) {
      loadStylesheetOnce("/evaraos/assets/css/premium-leads.css?v=1", "evaraPremiumLeadsCss");
      loadModuleOnce("/evaraos/assets/js/customer-lead-request.js?v=1");
    }

    if (path.endsWith("/dashboard.html")) {
      loadModuleOnce("/evaraos/assets/js/dashboard-stats.js?v=1");
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

    window.EvaraThemeCssLoader = {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
