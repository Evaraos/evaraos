(function () {
  const FAST_LOADER_ID = "evaraFastLoader";
  const PAGE_TRANSITION_ID = "evaPageTransition";
  const GLOBAL_LOADER_ID = "evaraGlobalLoader";

  const INITIAL_FAST_LOADER_DELAY = 650;
  const INITIAL_FULL_LOADER_DELAY = 1800;
  const NAV_FULL_LOADER_DELAY = 900;
  const FORCE_READY_TIMEOUT = 3200;
  const FORCE_NAV_TIMEOUT = 4200;
  const EXIT_DURATION = 180;

  let initialFastTimer = null;
  let initialFullTimer = null;
  let navFullTimer = null;
  let forceReadyTimer = null;
  let forceNavTimer = null;
  let exitTimer = null;

  let isTransitioning = false;
  let fullLoaderVisible = false;
  let firstBootDone = false;
  let initialBootStarted = false;
  let hasMarkedReady = false;
  let loadersCreated = false;

  function clearTimer(timer) {
    if (timer) clearTimeout(timer);
    return null;
  }

  function clearAllTimers() {
    initialFastTimer = clearTimer(initialFastTimer);
    initialFullTimer = clearTimer(initialFullTimer);
    navFullTimer = clearTimer(navFullTimer);
    forceReadyTimer = clearTimer(forceReadyTimer);
    forceNavTimer = clearTimer(forceNavTimer);
    exitTimer = clearTimer(exitTimer);
  }

  function isAuthPending() {
    return (
      document.documentElement.classList.contains("auth-pending") ||
      document.body?.classList.contains("auth-pending")
    );
  }

  function isBootPending() {
    return document.documentElement.classList.contains("boot-pending");
  }

  function isAppPending() {
    return isAuthPending() || isBootPending() || document.body?.classList.contains("app-loading");
  }

  function unlockApp() {
    document.documentElement.classList.remove("boot-pending");
    document.documentElement.classList.remove("auth-pending");
    document.body?.classList.remove("auth-pending");
    document.body?.classList.remove("app-loading");
    document.body?.classList.add("app-ready");
  }

  function ensurePageTransition() {
    let el = document.getElementById(PAGE_TRANSITION_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = PAGE_TRANSITION_ID;
    el.className = "eva-page-transition";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    return el;
  }

  function inlineMarkSVG(className) {
    return `
      <svg viewBox="0 0 100 100" class="${className}" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="evaraCoreGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#ffb3c0"></stop>
            <stop offset="32%" stop-color="#ff355d"></stop>
            <stop offset="72%" stop-color="#b10f35"></stop>
            <stop offset="100%" stop-color="#5f0821"></stop>
          </radialGradient>
          <linearGradient id="evaraChrome" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"></stop>
            <stop offset="55%" stop-color="#d9dbe8"></stop>
            <stop offset="100%" stop-color="#8c91a8"></stop>
          </linearGradient>
          <radialGradient id="evaraShine" cx="38%" cy="28%" r="55%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.98)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"></stop>
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="28" fill="url(#evaraCoreGrad)"></circle>
        <ellipse cx="50" cy="50" rx="37" ry="18" fill="none" stroke="url(#evaraChrome)" stroke-width="6.8" transform="rotate(-18 50 50)"></ellipse>
        <ellipse cx="50" cy="50" rx="20" ry="37" fill="none" stroke="url(#evaraChrome)" stroke-width="6.8" transform="rotate(28 50 50)"></ellipse>
        <circle cx="50" cy="50" r="10" fill="url(#evaraShine)" opacity="0.75"></circle>
        <circle cx="72" cy="34" r="5.6" fill="#ff2048"></circle>
        <circle cx="31" cy="34" r="5.2" fill="#ff6a7e"></circle>
        <circle cx="72" cy="66" r="5.2" fill="#ff2048"></circle>
        <circle cx="31" cy="66" r="5.2" fill="#ff6a7e"></circle>
      </svg>
    `;
  }

  function ensureFastLoader() {
    let el = document.getElementById(FAST_LOADER_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = FAST_LOADER_ID;
    el.className = "evara-loader-fast";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="evara-loader-fast-bg evara-loader-mode-bg" aria-hidden="true">
        <span class="evara-loader-fast-bg-wave wave-a"></span>
        <span class="evara-loader-fast-bg-wave wave-b"></span>
        <span class="evara-loader-fast-bg-wave wave-c"></span>
        <span class="evara-loader-fast-bg-glow glow-a"></span>
        <span class="evara-loader-fast-bg-glow glow-b"></span>
        <span class="evara-loader-fast-bg-stars"></span>
      </div>

      <div class="evara-loader-fast-wrap">
        <span class="evara-loader-fast-wave wave-a"></span>
        <span class="evara-loader-fast-wave wave-b"></span>
        <span class="evara-loader-fast-wave wave-c"></span>
        ${inlineMarkSVG("evara-loader-fast-logo")}
      </div>
    `;

    document.body.appendChild(el);
    return el;
  }

  function ensureGlobalLoader() {
    let el = document.getElementById(GLOBAL_LOADER_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = GLOBAL_LOADER_ID;
    el.className = "evara-global-loader";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="evara-loader-backdrop evara-loader-mode-bg" aria-hidden="true">
        <span class="evara-loader-bg-wave wave-1"></span>
        <span class="evara-loader-bg-wave wave-2"></span>
        <span class="evara-loader-bg-wave wave-3"></span>
        <span class="evara-loader-bg-wave wave-4"></span>
        <span class="evara-loader-bg-glow glow-1"></span>
        <span class="evara-loader-bg-glow glow-2"></span>
        <span class="evara-loader-bg-glow glow-3"></span>
        <span class="evara-loader-bg-stars"></span>
      </div>

      <div class="evara-loader-box glass-card">
        <div class="evara-loader-mark evara-loader-mark--premium">
          <div class="evara-loader-logo-wrap evara-loader-logo-wrap--premium evara-loader-pulse-wrap">
            <span class="evara-loader-wave wave-1"></span>
            <span class="evara-loader-wave wave-2"></span>
            <span class="evara-loader-wave wave-3"></span>
            <span class="evara-loader-pulse-ring pulse-ring-a"></span>
            <span class="evara-loader-pulse-ring pulse-ring-b"></span>
            <span class="evara-loader-pulse-ring pulse-ring-c"></span>
            <span class="evara-loader-pulse-glow"></span>
            ${inlineMarkSVG("evara-loader-logo evara-loader-logo--premium")}
          </div>
        </div>

        <div class="evara-loader-copy">
          <p class="evara-loader-title" id="evaraLoaderTitle">Opening Evaraos</p>
          <p class="evara-loader-subtitle" id="evaraLoaderSubtitle">Loading your experience.</p>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    return el;
  }

  function ensureLoaders() {
    if (loadersCreated) return;
    ensurePageTransition();
    ensureFastLoader();
    ensureGlobalLoader();
    loadersCreated = true;
  }

  function showPageTransition() {
    ensureLoaders();
    const transition = document.getElementById(PAGE_TRANSITION_ID);
    document.documentElement.classList.add("eva-transitioning");
    transition?.classList.add("active");
  }

  function hidePageTransition() {
    const transition = document.getElementById(PAGE_TRANSITION_ID);
    document.documentElement.classList.remove("eva-transitioning");
    transition?.classList.remove("active");
  }

  function showFastLoader() {
    ensureLoaders();

    const fast = document.getElementById(FAST_LOADER_ID);
    const global = document.getElementById(GLOBAL_LOADER_ID);

    global?.classList.remove("active", "is-entering", "is-exiting");
    global?.setAttribute("aria-hidden", "true");
    fullLoaderVisible = false;

    fast?.classList.remove("is-exiting");
    fast?.classList.add("active", "is-entering");
    fast?.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      fast?.classList.remove("is-entering");
    });

    document.documentElement.classList.add("eva-fast-loading");
  }

  function hideFastLoader(immediate = false) {
    const fast = document.getElementById(FAST_LOADER_ID);
    if (!fast) return;

    document.documentElement.classList.remove("eva-fast-loading");

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

    const loader = document.getElementById(GLOBAL_LOADER_ID);
    if (!loader) return;

    const titleEl = loader.querySelector("#evaraLoaderTitle");
    const subtitleEl = loader.querySelector("#evaraLoaderSubtitle");

    hideFastLoader(true);
    unlockApp();

    if (titleEl) titleEl.textContent = options.title || "Opening Evaraos";
    if (subtitleEl) subtitleEl.textContent = options.subtitle || "Preparing your next screen.";

    loader.classList.remove("is-exiting");
    loader.classList.add("active", "is-entering");
    loader.setAttribute("aria-hidden", "false");
    fullLoaderVisible = true;

    requestAnimationFrame(() => {
      loader.classList.remove("is-entering");
    });
  }

  function hideFullLoader(immediate = false) {
    const loader = document.getElementById(GLOBAL_LOADER_ID);
    if (!loader) return;

    fullLoaderVisible = false;

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
    hidePageTransition();
    unlockApp();
    isTransitioning = false;
    firstBootDone = true;
    hasMarkedReady = true;
  }

  function scheduleInitialSlowLoaders(options = {}) {
    initialFastTimer = setTimeout(() => {
      if (!isAppPending()) return;
      showFastLoader();
    }, INITIAL_FAST_LOADER_DELAY);

    initialFullTimer = setTimeout(() => {
      if (!isAppPending()) return;
      showFullLoader(options);
    }, INITIAL_FULL_LOADER_DELAY);
  }

  function beginNavigationLoad(options = {}) {
    if (isTransitioning) return;

    isTransitioning = true;
    clearAllTimers();
    unlockApp();
    showPageTransition();
    showFastLoader();

    navFullTimer = setTimeout(() => {
      if (!isTransitioning) return;
      showFullLoader({
        title: options.title || "Opening Evaraos",
        subtitle: options.subtitle || "Preparing your next screen."
      });
    }, NAV_FULL_LOADER_DELAY);

    forceNavTimer = setTimeout(() => {
      if (!isTransitioning) return;
      hideAllLoaders(true);
    }, FORCE_NAV_TIMEOUT);
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

      requestAnimationFrame(() => {
        window.location.assign(anchor.href);
      });
    });
  }

  function setupInitialBoot() {
    if (initialBootStarted) return;
    initialBootStarted = true;

    unlockApp();

    if (!isAppPending()) {
      firstBootDone = true;
      hasMarkedReady = true;
      return;
    }

    scheduleInitialSlowLoaders({
      title: "Loading Evaraos",
      subtitle: "Checking your secure session."
    });

    forceReadyTimer = setTimeout(() => {
      if (!hasMarkedReady) {
        hideAllLoaders(true);
      }
    }, FORCE_READY_TIMEOUT);

    window.addEventListener("load", () => {
      if (!isAuthPending()) {
        hideAllLoaders(false);
      }
    });

    window.addEventListener("pageshow", () => {
      if (!isAuthPending()) {
        hideAllLoaders(true);
      }
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
        return {
          isTransitioning,
          fullLoaderVisible,
          firstBootDone,
          initialBootStarted,
          hasMarkedReady,
          authPending: isAuthPending(),
          bootPending: isBootPending(),
          appPending: isAppPending(),
          loadersCreated
        };
      }
    };
  }

  function init() {
    exposeApi();
    setupInitialBoot();
    interceptDocumentLinks();

    window.addEventListener("evara:session-ready", () => {
      markAppReady();
    });

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