(function () {
  const GALAXY_CSS_ID = "evaraGalaxyCss";
  const GALAXY_CSS_HREF = "/evaraos/assets/css/effects/galaxy.css?v=1";

  let galaxyLoaded = false;
  let pending = false;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function shouldUseGalaxy() {
    return currentTheme() === "galaxy";
  }

  function markThemeHydrated() {
    document.documentElement.setAttribute("data-evara-theme-ready", "true");
  }

  function getGalaxyLink() {
    return document.getElementById(GALAXY_CSS_ID);
  }

  function syncGalaxyEngine() {
    if (window.EvaraGalaxy && typeof window.EvaraGalaxy.syncTheme === "function") {
      window.EvaraGalaxy.syncTheme();
    }
  }

  function stopGalaxyEngine() {
    if (window.EvaraGalaxy && typeof window.EvaraGalaxy.stop === "function") {
      window.EvaraGalaxy.stop();
    }
  }

  function emitGalaxyReady() {
    window.dispatchEvent(
      new CustomEvent("evara:galaxy-css-ready", {
        detail: {
          loaded: true,
          theme: currentTheme()
        }
      })
    );
  }

  function loadGalaxyCss() {
    let link = getGalaxyLink();

    if (link && galaxyLoaded) {
      link.disabled = false;
      syncGalaxyEngine();
      return;
    }

    if (pending) return;

    pending = true;

    if (!link) {
      link = document.createElement("link");
      link.id = GALAXY_CSS_ID;
      link.rel = "stylesheet";
      link.href = GALAXY_CSS_HREF;
      link.media = "all";
      link.disabled = false;

      link.onload = () => {
        galaxyLoaded = true;
        pending = false;
        link.disabled = false;

        emitGalaxyReady();
        syncGalaxyEngine();
      };

      link.onerror = () => {
        pending = false;
        console.warn("Evaraos galaxy CSS failed to load:", GALAXY_CSS_HREF);
      };

      document.head.appendChild(link);
      return;
    }

    link.disabled = false;
    galaxyLoaded = true;
    pending = false;
    syncGalaxyEngine();
  }

  function disableGalaxyCss() {
    const link = getGalaxyLink();

    if (link) {
      link.disabled = true;
    }

    stopGalaxyEngine();
  }

  function syncCss() {
    if (shouldUseGalaxy()) {
      loadGalaxyCss();
      return;
    }

    disableGalaxyCss();
  }

  function syncAfterThemeReady() {
    markThemeHydrated();
    syncCss();
  }

  function init() {
    syncCss();

    window.addEventListener("evara:theme-ready", syncAfterThemeReady);
    window.addEventListener("evara:theme-changed", syncAfterThemeReady);
    window.addEventListener("pageshow", syncCss);

    const observer = new MutationObserver(syncCss);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    window.EvaraThemeCssLoader = {
      syncCss,
      loadGalaxyCss,
      disableGalaxyCss,
      markThemeHydrated,
      getState() {
        const link = getGalaxyLink();

        return {
          theme: currentTheme(),
          galaxyLoaded,
          pending,
          hasGalaxyLink: Boolean(link),
          galaxyCssDisabled: link ? Boolean(link.disabled) : null,
          galaxyHref: link ? link.href : null,
          hydrated: document.documentElement.getAttribute("data-evara-theme-ready") === "true"
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
