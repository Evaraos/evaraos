(function () {
  const GALAXY_CSS_ID = "evaraGalaxyCss";
  const GALAXY_CSS_HREF = "/evaraos/assets/css/effects/galaxy.css?v=1";
  const APPEARANCE_KEY = "evaraos-appearance";

  let galaxyLoaded = false;
  let pending = false;
  let isSyncing = false;

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
    if (safe === "rainbow") return "rainbow";
    if (safe === "nebula") return "nebula";
    if (safe === "off") return "off";
    return "glass";
  }

  function setRootAttribute(name, value) {
    if (document.documentElement.getAttribute(name) === value) return;
    document.documentElement.setAttribute(name, value);
  }

  function removeRootAttribute(name) {
    if (!document.documentElement.hasAttribute(name)) return;
    document.documentElement.removeAttribute(name);
  }

  function syncBeamPreferences() {
    const appearance = getAppearance();
    const theme = currentTheme();
    const enabled = appearance.beamEnabled !== false;
    let mode = normalizeBeamStyle(appearance.beamStyle || appearance.beamMode || "glass");

    if (appearance.rainbowBeam === true && !appearance.beamStyle) {
      mode = "rainbow";
    }

    if (theme === "galaxy" && !appearance.beamStyle && mode !== "rainbow") {
      mode = "nebula";
    }

    if (!enabled || mode === "off") {
      setRootAttribute("data-beam-mode", "off");
      setRootAttribute("data-user-beam-off", "true");
      return;
    }

    removeRootAttribute("data-user-beam-off");
    setRootAttribute("data-beam-mode", mode || "glass");
  }

  function shouldUseGalaxy() {
    return currentTheme() === "galaxy";
  }

  function markThemeHydrated() {
    setRootAttribute("data-evara-theme-ready", "true");
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
    if (isSyncing) return;
    isSyncing = true;

    try {
      syncBeamPreferences();

      if (shouldUseGalaxy()) {
        loadGalaxyCss();
      } else {
        disableGalaxyCss();
      }
    } finally {
      window.setTimeout(() => {
        isSyncing = false;
      }, 0);
    }
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
      attributeFilter: ["data-theme"]
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
