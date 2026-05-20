(function () {
  const LOADER_ID = "evaraGlobalLoader";
  const LOGO_SRC = "/assets/img/evaraos_logo.png";
  const EXIT_DURATION = 220;
  const FORCE_UNLOCK_DELAY = 4200;

  let forceTimer = null;
  let isTransitioning = false;
  let loaderCreated = false;
  let initialReady = false;

  function clearForceTimer() {
    if (forceTimer) clearTimeout(forceTimer);
    forceTimer = null;
  }

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function getTheme() {
    try {
      const raw = localStorage.getItem("evaraos-appearance");
      if (raw) {
        const appearance = JSON.parse(raw);
        if (appearance?.mode === "dark") return "dark";
        if (appearance?.mode === "light") return "light";
        if (appearance?.mode === "system") return systemTheme();
        if (appearance?.mode === "custom") return appearance.baseFamily === "light" ? "light" : "dark";
      }
      const stored = localStorage.getItem("evaraos-theme");
      if (stored === "dark" || stored === "light") return stored;
    } catch {}
    return document.documentElement.dataset.theme === "dark" ? "dark" : systemTheme();
  }

  function applyTheme(theme = getTheme()) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    const loader = document.getElementById(LOADER_ID);

    document.documentElement.dataset.theme = safeTheme;
    document.documentElement.style.colorScheme = safeTheme;
    document.documentElement.classList.toggle("dark", safeTheme === "dark");
    if (document.body) {
      document.body.dataset.theme = safeTheme;
      document.body.classList.toggle("dark", safeTheme === "dark");
    }

    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", safeTheme === "dark" ? "#020307" : "#f4f7f6");
    } catch {}

    if (loader) loader.dataset.theme = safeTheme;
    return safeTheme;
  }

  function logo() {
    return `<img class="evara-loader-logo" src="${LOGO_SRC}" alt="Evaraos" loading="eager" decoding="async" />`;
  }

  function ensureLoader() {
    if (loaderCreated && document.getElementById(LOADER_ID)) {
      const existing = document.getElementById(LOADER_ID);
      existing.dataset.theme = applyTheme();
      return existing;
    }

    document.getElementById("evaraFastLoader")?.remove();
    document.getElementById("evaPageTransition")?.remove();

    let loader = document.getElementById(LOADER_ID);
    if (!loader) {
      loader = document.createElement("div");
      loader.id = LOADER_ID;
      loader.className = "evara-global-loader";
      loader.setAttribute("aria-hidden", "true");
      loader.innerHTML = `
        <div class="evara-loader-card" role="status" aria-live="polite">
          <div class="evara-loader-mark">
            <span class="evara-loader-ring ring-a"></span>
            <span class="evara-loader-ring ring-b"></span>
            <span class="evara-loader-ring ring-c"></span>
            ${logo()}
          </div>
          <div class="evara-loader-copy">
            <p class="evara-loader-title" id="evaraLoaderTitle">Loading Evaraos</p>
            <p class="evara-loader-subtitle" id="evaraLoaderSubtitle">Preparing your secure workspace.</p>
          </div>
        </div>
      `;
      document.body.appendChild(loader);
    }

    loader.dataset.theme = applyTheme();
    loaderCreated = true;
    return loader;
  }

  function unlockApp() {
    document.documentElement.classList.remove("boot-pending", "auth-pending", "eva-transitioning");
    document.body?.classList.remove("auth-pending", "app-loading");
    document.body?.classList.add("app-ready");
  }

  function showLoader(options = {}) {
    const theme = applyTheme(options.theme || getTheme());
    const loader = ensureLoader();
    const title = loader.querySelector("#evaraLoaderTitle");
    const subtitle = loader.querySelector("#evaraLoaderSubtitle");

    loader.dataset.theme = theme;
    if (title) title.textContent = options.title || "Loading Evaraos";
    if (subtitle) subtitle.textContent = options.subtitle || "Preparing your secure workspace.";

    loader.classList.remove("is-exiting");
    loader.classList.add("active", "is-entering");
    loader.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("eva-transitioning");

    requestAnimationFrame(() => loader.classList.remove("is-entering"));

    clearForceTimer();
    forceTimer = setTimeout(() => hideLoader(true), FORCE_UNLOCK_DELAY);
  }

  function hideLoader(immediate = false) {
    clearForceTimer();
    const loader = document.getElementById(LOADER_ID);
    unlockApp();
    isTransitioning = false;
    initialReady = true;

    if (!loader) return;
    loader.dataset.theme = applyTheme();

    if (immediate) {
      loader.classList.remove("active", "is-entering", "is-exiting");
      loader.setAttribute("aria-hidden", "true");
      return;
    }

    loader.classList.remove("is-entering");
    loader.classList.add("is-exiting");

    setTimeout(() => {
      loader.classList.remove("active", "is-exiting");
      loader.setAttribute("aria-hidden", "true");
    }, EXIT_DURATION);
  }

  function beginNavigationLoad(options = {}) {
    if (isTransitioning) return;
    isTransitioning = true;
    unlockApp();
    showLoader({
      title: options.title || "Opening Evaraos",
      subtitle: options.subtitle || "Preparing your next screen.",
      theme: options.theme
    });
  }

  function completeNavigationLoad() {
    hideLoader(false);
  }

  function markAppReady() {
    hideLoader(false);
  }

  function shouldInterceptLink(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (anchor.hasAttribute("download")) return false;
    if (anchor.target && anchor.target !== "_self") return false;

    try {
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return false;
      if (url.pathname === window.location.pathname && url.hash) return false;
      return true;
    } catch {
      return false;
    }
  }

  function interceptDocumentLinks() {
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest("a[href]");
      if (!shouldInterceptLink(anchor)) return;
      if (anchor.hasAttribute("data-menu-link") || anchor.closest("#evaNavShell") || anchor.closest("#evaMenuPanel")) return;

      event.preventDefault();
      beginNavigationLoad({
        title: "Opening Evaraos",
        subtitle: "Preparing your next screen."
      });
      requestAnimationFrame(() => window.location.assign(anchor.href));
    });
  }

  function setupInitialBoot() {
    ensureLoader();
    showLoader({
      title: "Loading Evaraos",
      subtitle: "Checking your secure session."
    });

    window.addEventListener("load", () => hideLoader(false), { once: true });
    window.addEventListener("pageshow", () => {
      if (initialReady && !isTransitioning) hideLoader(true);
    });
  }

  function exposeApi() {
    window.EvaraLoader = {
      beginNavigationLoad,
      completeNavigationLoad,
      showLoader,
      hideLoader,
      showFullLoader: showLoader,
      hideFullLoader: hideLoader,
      showFastLoader: showLoader,
      hideFastLoader: hideLoader,
      hideAllLoaders: hideLoader,
      markAppReady,
      syncTheme: applyTheme,
      getState() {
        return { isTransitioning, initialReady, loaderCreated, theme: getTheme() };
      }
    };
  }

  function init() {
    exposeApi();
    setupInitialBoot();
    interceptDocumentLinks();
    window.addEventListener("evara:session-ready", () => markAppReady());
    window.addEventListener("evara:appearance-updated", (event) => applyTheme(event.detail?.mode || event.detail?.theme));
    window.addEventListener("evara:theme-applied", (event) => applyTheme(event.detail?.theme));
    window.addEventListener("storage", (event) => {
      if (["evaraos-theme", "evaraos-appearance"].includes(event.key)) applyTheme();
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !isTransitioning && initialReady) hideLoader(true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
