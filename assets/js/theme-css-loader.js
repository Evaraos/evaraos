(function () {
  const loadedModules = new Set();
  const loadedStylesheets = new Set();

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

  function bootGlobalModules() {
    // Intentionally empty. Universal nav and install UI are loaded by the page, not injected here.
  }

  function bootPageModules() {
    bootGlobalModules();
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

    const bootstrapApi = {
      syncCss,
      markThemeHydrated,
      bootPageModules,
      registerServiceWorker() {},
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
          swRegistrationStarted: false
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
