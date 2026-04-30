(function () {
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

  function init() {
    syncCss();

    window.addEventListener("evara:theme-ready", syncCss);
    window.addEventListener("evara:theme-changed", syncCss);
    window.addEventListener("pageshow", syncCss);

    const observer = new MutationObserver(syncCss);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    window.EvaraThemeCssLoader = {
      syncCss,
      markThemeHydrated,
      syncBeamPreferences: syncCss,
      loadGalaxyCss: syncCss,
      disableGalaxyCss: syncCss,
      getState() {
        return {
          theme: document.documentElement.getAttribute("data-theme") || "light",
          hydrated: document.documentElement.getAttribute("data-evara-theme-ready") === "true",
          visualStack: "apple-settings-glass"
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
