(function () {
  const loadedModules = new Set();

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

  function loadModuleOnce(src) {
    if (loadedModules.has(src)) return;
    loadedModules.add(src);
    import(src).catch((error) => console.warn("Evaraos module load skipped:", src, error));
  }

  function bootPageModules() {
    const path = window.location.pathname;

    if (path.endsWith("/leads.html")) {
      loadModuleOnce("/evaraos/assets/js/leads.js?v=3");
      loadModuleOnce("/evaraos/assets/js/offline-leads.js?v=1");
    }

    if (path.endsWith("/dashboard.html")) {
      loadModuleOnce("/evaraos/assets/js/dashboard-stats.js?v=1");
    }
  }

  function init() {
    syncCss();
    bootPageModules();

    window.addEventListener("evara:theme-ready", syncCss);
    window.addEventListener("evara:theme-changed", syncCss);
    window.addEventListener("pageshow", () => {
      syncCss();
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
      syncBeamPreferences: syncCss,
      loadGalaxyCss: syncCss,
      disableGalaxyCss: syncCss,
      getState() {
        return {
          theme: document.documentElement.getAttribute("data-theme") || "light",
          hydrated: document.documentElement.getAttribute("data-evara-theme-ready") === "true",
          visualStack: "apple-settings-glass",
          loadedModules: Array.from(loadedModules)
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
