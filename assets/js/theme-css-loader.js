(function () {
  const GALAXY_CSS_ID = "evaraGalaxyCss";
  const GALAXY_CSS_HREF = "/evaraos/assets/css/effects/galaxy.css?v=1";

  let galaxyLoaded = false;
  let pending = false;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function shouldUseGalaxy() {
    return currentTheme() === "galaxy";
  }

  function loadGalaxyCss() {
    if (galaxyLoaded || pending) return;

    pending = true;

    let link = document.getElementById(GALAXY_CSS_ID);

    if (!link) {
      link = document.createElement("link");
      link.id = GALAXY_CSS_ID;
      link.rel = "stylesheet";
      link.href = GALAXY_CSS_HREF;
      link.media = "all";

      link.onload = () => {
        galaxyLoaded = true;
        pending = false;

        window.dispatchEvent(
          new CustomEvent("evara:galaxy-css-ready", {
            detail: { loaded: true }
          })
        );

        if (window.EvaraGalaxy && typeof window.EvaraGalaxy.syncTheme === "function") {
          window.EvaraGalaxy.syncTheme();
        }
      };

      link.onerror = () => {
        pending = false;
      };

      document.head.appendChild(link);
      return;
    }

    link.disabled = false;
    galaxyLoaded = true;
    pending = false;
  }

  function disableGalaxyCss() {
    const link = document.getElementById(GALAXY_CSS_ID);

    if (link) {
      link.disabled = true;
    }

    if (window.EvaraGalaxy && typeof window.EvaraGalaxy.stop === "function") {
      window.EvaraGalaxy.stop();
    }
  }

  function syncCss() {
    if (shouldUseGalaxy()) {
      loadGalaxyCss();
    } else {
      disableGalaxyCss();
    }
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
      loadGalaxyCss,
      disableGalaxyCss,
      getState() {
        return {
          theme: currentTheme(),
          galaxyLoaded,
          pending,
          hasGalaxyLink: Boolean(document.getElementById(GALAXY_CSS_ID))
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
