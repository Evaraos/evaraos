(function () {
  const GALAXY_CSS_ID = "evaraGalaxyCss";
  const GALAXY_CSS_HREF = "/evaraos/assets/css/effects/galaxy.css?v=1";
  const APPEARANCE_KEY = "evaraos-appearance";

  let galaxyLoaded = false;
  let pending = false;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function safeJsonParse(value, fallback = {}) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function getAppearance() {
    try {
      return safeJsonParse(localStorage.getItem(APPEARANCE_KEY), {});
    } catch {
      return {};
    }
  }

  function normalizeBeamStyle(value = "") {
    const safe = String(value || "").trim().toLowerCase();
    if (["off", "glass", "rainbow", "nebula"].includes(safe)) return safe;
    if (safe === "default") return "glass";
    return "glass";
  }

  function syncBeamPreferences() {
    const appearance = getAppearance();
    const theme = currentTheme();
    const enabled = appearance.beamEnabled !== false;
    let mode = normalizeBeamStyle(appearance.beamStyle || appearance.beamMode || "");

    if (!enabled || mode === "off") {
      document.documentElement.setAttribute("data-beam-mode", "off");
      document.documentElement.setAttribute("data-user-beam-off", "true");
      return;
    }

    document.documentElement.removeAttribute("data-user-beam-off");

    if (appearance.rainbowBeam === true && !appearance.beamStyle) {
      mode = "rainbow";
    }

    if (theme === "galaxy" && !appearance.beamStyle) {
      mode = "nebula";
    }

    document.documentElement.setAttribute("data-beam-mode", mode || "glass");
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
    syncBeamPreferences();

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
    window.addEventListener("storage", (event) => {
      if (event.key === APPEARANCE_KEY) syncCss();
    });

    const observer = new MutationObserver(syncCss);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-beam-mode"]
    });

    window.EvaraThemeCssLoader = {
      syncCss,
      syncBeamPreferences,
      loadGalaxyCss,
      disableGalaxyCss,
      markThemeHydrated,
      getState() {
        const link = getGalaxyLink();

        return {
          theme: currentTheme(),
          beamMode: document.documentElement.getAttribute("data-beam-mode") || "glass",
          userBeamOff: document.documentElement.getAttribute("data-user-beam-off") === "true",
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
