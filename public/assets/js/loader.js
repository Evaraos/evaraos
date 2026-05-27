(function () {
  const FAST_LOADER_ID = "evaraFastLoader";
  const GLOBAL_LOADER_ID = "evaraGlobalLoader";
  const PAGE_TRANSITION_ID = "evaPageTransition";
  const LOGO_SRC = "/assets/img/evaraos_logo.png";

  const NAV_FAST_DELAY = 350;
  const NAV_FULL_DELAY = 1200;
  const INITIAL_FAST_DELAY = 0;
  const INITIAL_FULL_DELAY = 1600;
  const FORCE_UNLOCK_DELAY = 4200;
  const EXIT_DURATION = 180;

  let fastTimer = null;
  let fullTimer = null;
  let forceTimer = null;
  let isTransitioning = false;
  let loadersCreated = false;
  let firstBootDone = false;

  function clearTimer(timer) {
    if (timer) clearTimeout(timer);
    return null;
  }

  function clearAllTimers() {
    fastTimer = clearTimer(fastTimer);
    fullTimer = clearTimer(fullTimer);
    forceTimer = clearTimer(forceTimer);
  }

  function unlockApp() {
    document.documentElement.classList.remove("boot-pending", "auth-pending", "eva-transitioning");
    document.body?.classList.remove("auth-pending", "app-loading");
    document.body?.classList.add("app-ready");

    const transition = document.getElementById(PAGE_TRANSITION_ID);
    transition?.classList.remove("active");
  }

  function isStillPending() {
    return (
      document.documentElement.classList.contains("boot-pending") ||
      document.documentElement.classList.contains("auth-pending") ||
      document.body?.classList.contains("auth-pending") ||
      document.body?.classList.contains("app-loading") ||
      isTransitioning
    );
  }

  function logoImage(className) {
    return `<img class="${className}" src="${LOGO_SRC}" alt="Evaraos" loading="eager" decoding="async" />`;
  }

  function ensureLoaders() {
    if (loadersCreated) return;

    if (!document.getElementById(PAGE_TRANSITION_ID)) {
      const transition = document.createElement("div");
      transition.id = PAGE_TRANSITION_ID;
      transition.className = "eva-page-transition";
      transition.setAttribute("aria-hidden", "true");
      document.body.appendChild(transition);
    }

    if (!document.getElementById(FAST_LOADER_ID)) {
      const fast = document.createElement("div");
      fast.id = FAST_LOADER_ID;
      fast.className = "evara-loader-fast evara-loader-fast--logo-first";
      fast.setAttribute("aria-hidden", "true");
      fast.innerHTML = `
        <div class="evara-loader-fast-wrap">
          <span class="evara-loader-fast-wave wave-a"></span>
          <span class="evara-loader-fast-wave wave-b"></span>
          <span class="evara-loader-fast-wave wave-c"></span>
          ${logoImage("evara-loader-fast-logo evara-loader-logo-image")}
        </div>
      `;
      document.body.appendChild(fast);
    }

    if (!document.getElementById(GLOBAL_LOADER_ID)) {
      const global = document.createElement("div");
      global.id = GLOBAL_LOADER_ID;
      global.className = "evara-global-loader evara-global-loader--logo-first";
      global.setAttribute("aria-hidden", "true");
      global.innerHTML = `
        <div class="evara-loader-box glass-card">
          <div class="evara-loader-mark evara-loader-mark--premium">
            <div class="evara-loader-logo-wrap evara-loader-logo-wrap--premium evara-loader-pulse-wrap">
              <span class="evara-loader-wave wave-1"></span>
              <span class="evara-loader-wave wave-2"></span>
              <span class="evara-loader-wave wave-3"></span>
              ${logoImage("evara-loader-logo evara-loader-logo--premium evara-loader-logo-image")}
            </div>
          </div>

          <div class="evara-loader-copy">
            <p class="evara-loader-title" id="evaraLoaderTitle">Opening Evaraos</p>
            <p class="evara-loader-subtitle" id="evaraLoaderSubtitle">Loading your secure operating system.</p>
          </div>

          <p class="evara-loader-signature">from Evaraos Inc</p>
        </div>
      `;
      document.body.appendChild(global);
    }

    loadersCreated = true;
  }

  function showFastLoader() {
    ensureLoaders();

    const fast = document.getElementById(FAST_LOADER_ID);
    const global = document.getElementById(GLOBAL_LOADER_ID);

    global?.classList.remove("active", "is-entering", "is-exiting");
    global?.setAttribute("aria-hidden", "true");

    fast?.classList.remove("is-exiting");
    fast?.classList.add("active", "is-entering");
    fast?.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => fast?.classList.remove("is-entering"));
  }

  function hideFastLoader(immediate = false) {
    const fast = document.getElementById(FAST_LOADER_ID);
    if (!fast) return;

    if (immediate) {
      fast.classList.remove("active", "is-entering", "is-exiting");
      fast.setAttribute("aria-hidden", "true");
      return;
    }

    fast.classList.remove("is-entering");
    fast.classList.add("is-exiting");

    setTimeout(() => {
      fast.classList.remove("active", "is-exiting");
      fast.setAttribute("aria-hidden", "true");
    }, EXIT_DURATION);
  }

  function showFullLoader(options = {}) {
    ensureLoaders();
    unlockApp();

    const loader = document.getElementById(GLOBAL_LOADER_ID);
    if (!loader) return;

    const titleEl = loader.querySelector("#evaraLoaderTitle");
    const subtitleEl = loader.querySelector("#evaraLoaderSubtitle");

    hideFastLoader(true);

    if (titleEl) titleEl.textContent = options.title || "Opening Evaraos";
    if (subtitleEl) subtitleEl.textContent = options.subtitle || "Preparing your secure workspace.";

    loader.classList.remove("is-exiting");
    loader.classList.add("active", "is-entering");
    loader.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => loader.classList.remove("is-entering"));
  }

  function hideFullLoader(immediate = false) {
    const loader = document.getElementById(GLOBAL_LOADER_ID);
    if (!loader) return;

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

  function hideAllLoaders(immediate = false) {
    clearAllTimers();
    hideFastLoader(immediate);
    hideFullLoader(immediate);
    unlockApp();
    isTransitioning = false;
    firstBootDone = true;
  }

  function scheduleEmergencyLoaders(options = {}, mode = "nav") {
    const fastDelay = mode === "initial" ? INITIAL_FAST_DELAY : NAV_FAST_DELAY;
    const fullDelay = mode === "initial" ? INITIAL_FULL_DELAY : NAV_FULL_DELAY;

    fastTimer = setTimeout(() => {
      if (!isStillPending()) return;
      showFastLoader();
    }, fastDelay);

    if (mode !== "initial") {
      fullTimer = setTimeout(() => {
        if (!isStillPending()) return;
        showFullLoader(options);
      }, fullDelay);
    }

    forceTimer = setTimeout(() => hideAllLoaders(true), FORCE_UNLOCK_DELAY);
  }

  function beginNavigationLoad(options = {}) {
    if (isTransitioning) return;

    isTransitioning = true;
    clearAllTimers();
    unlockApp();

    scheduleEmergencyLoaders({
      title: options.title || "Opening Evaraos",
      subtitle: options.subtitle || "Preparing your next screen."
    }, "nav");
  }

  function completeNavigationLoad() {
    hideAllLoaders(false);
  }

  function markAppReady() {
    hideAllLoaders(false);
  }

  function shouldInterceptLink(anchor) {
    if (!anchor) return false;

    const href = anchor.getAttribute("href") || "";

    if (!href) return false;
    if (href.startsWith("#")) return false;
    if (href.startsWith("mailto:")) return false;
    if (href.startsWith("tel:")) return false;
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

      if (
        anchor.hasAttribute("data-menu-link") ||
        anchor.hasAttribute("data-home-link") ||
        anchor.closest("#evaNavShell")
      ) {
        return;
      }

      event.preventDefault();

      beginNavigationLoad({
        title: "Opening Evaraos",
        subtitle: "Preparing your next screen."
      });

      requestAnimationFrame(() => window.location.assign(anchor.href));
    });
  }

  function setupInitialBoot() {
    if (firstBootDone) return;

    ensureLoaders();
    showFastLoader();

    scheduleEmergencyLoaders({
      title: "Loading Evaraos",
      subtitle: "Checking your secure session."
    }, "initial");

    window.addEventListener("load", () => {
      if (!isStillPending()) hideAllLoaders(false);
    });

    window.addEventListener("pageshow", () => {
      if (!isStillPending()) hideAllLoaders(true);
    });
  }

  function exposeApi() {
    window.EvaraLoader = {
      beginNavigationLoad,
      completeNavigationLoad,
      showFastLoader,
      hideFastLoader,
      showFullLoader,
      hideFullLoader,
      hideAllLoaders,
      markAppReady,
      getState() {
        return { isTransitioning, firstBootDone, appPending: isStillPending(), loadersCreated };
      }
    };
  }

  function init() {
    exposeApi();
    setupInitialBoot();
    interceptDocumentLinks();

    window.addEventListener("evara:session-ready", () => markAppReady());

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !isTransitioning && firstBootDone) {
        hideAllLoaders(true);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
