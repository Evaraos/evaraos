(function () {
  const FAST_LOADER_ID = "evaraFastLoader";
  const PAGE_TRANSITION_ID = "evaPageTransition";
  const GLOBAL_LOADER_ID = "evaraGlobalLoader";

  const FAST_TO_FULL_DELAY = 900;
  const READY_CLASS_DELAY = 12;
  const PAGE_READY_FALLBACK = 120;
  const EXIT_DURATION = 140;

  let fullLoaderTimer = null;
  let readyTimer = null;
  let transitionTimer = null;
  let pageReadyFallbackTimer = null;
  let isTransitioning = false;
  let fullLoaderVisible = false;
  let bootSettled = false;

  function getBasePath() {
    const path = window.location.pathname;
    const marker = "/evaraos/";
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index + marker.length - 1) : "/evaraos";
  }

  function clearTimer(refName) {
    if (refName === "fullLoaderTimer" && fullLoaderTimer) {
      clearTimeout(fullLoaderTimer);
      fullLoaderTimer = null;
    }
    if (refName === "readyTimer" && readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
    if (refName === "transitionTimer" && transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    if (refName === "pageReadyFallbackTimer" && pageReadyFallbackTimer) {
      clearTimeout(pageReadyFallbackTimer);
      pageReadyFallbackTimer = null;
    }
  }

  function clearAllTimers() {
    clearTimer("fullLoaderTimer");
    clearTimer("readyTimer");
    clearTimer("transitionTimer");
    clearTimer("pageReadyFallbackTimer");
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

  function ensureFastLoader() {
    let el = document.getElementById(FAST_LOADER_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = FAST_LOADER_ID;
    el.className = "evara-loader-fast";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="evara-loader-fast-wrap">
        <span class="evara-loader-fast-wave wave-a"></span>
        <span class="evara-loader-fast-wave wave-b"></span>
        <span class="evara-loader-fast-wave wave-c"></span>
        <img
          src="${getBasePath()}/assets/img/evaraos_logo.png"
          alt="Evaraos"
          class="evara-loader-fast-logo"
          onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
        />
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
      <div class="evara-loader-backdrop"></div>
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
            <img
              src="${getBasePath()}/assets/img/evaraos_logo.png"
              alt="Evaraos"
              class="evara-loader-logo evara-loader-logo--premium"
              onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
            />
          </div>
        </div>

        <div class="evara-loader-copy">
          <p class="evara-loader-title" id="evaraLoaderTitle">Launching Evaraos</p>
          <p class="evara-loader-subtitle" id="evaraLoaderSubtitle">Loading navigation, theme, and experience.</p>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function showPageTransition() {
    const transition = ensurePageTransition();
    document.documentElement.classList.add("eva-transitioning");
    transition.classList.add("active");
  }

  function hidePageTransition() {
    const transition = document.getElementById(PAGE_TRANSITION_ID);
    document.documentElement.classList.remove("eva-transitioning");
    if (transition) {
      transition.classList.remove("active");
    }
  }

  function showFastLoader() {
    const fast = ensureFastLoader();
    const global = ensureGlobalLoader();

    global.classList.remove("active", "is-entering", "is-exiting");
    global.setAttribute("aria-hidden", "true");
    fullLoaderVisible = false;

    fast.classList.remove("is-exiting");
    fast.classList.add("active", "is-entering");
    fast.setAttribute("aria-hidden", "false");

    document.body.classList.add("app-loading");
    document.body.classList.remove("app-ready");
    document.documentElement.classList.add("eva-fast-loading");

    clearTimer("transitionTimer");
    transitionTimer = setTimeout(() => {
      fast.classList.remove("is-entering");
    }, 90);
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
    const loader = ensureGlobalLoader();
    const titleEl = loader.querySelector("#evaraLoaderTitle");
    const subtitleEl = loader.querySelector("#evaraLoaderSubtitle");

    hideFastLoader(true);

    if (titleEl) {
      titleEl.textContent = options.title || "Opening Evaraos";
    }
    if (subtitleEl) {
      subtitleEl.textContent = options.subtitle || "Preparing your next screen.";
    }

    loader.classList.remove("is-exiting");
    loader.classList.add("active", "is-entering");
    loader.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
    document.body.classList.remove("app-ready");

    fullLoaderVisible = true;

    clearTimer("transitionTimer");
    transitionTimer = setTimeout(() => {
      loader.classList.remove("is-entering");
    }, 110);
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
    hideFastLoader(immediate);
    hideFullLoader(immediate);
    hidePageTransition();
    document.body.classList.remove("app-loading");
  }

  function markAppReady() {
    clearTimer("readyTimer");
    readyTimer = setTimeout(() => {
      hideAllLoaders();
      document.body.classList.add("app-ready");
      document.documentElement.classList.remove("eva-transitioning");
      isTransitioning = false;
      bootSettled = true;
    }, READY_CLASS_DELAY);
  }

  function beginNavigationLoad(options = {}) {
    if (isTransitioning) return;
    isTransitioning = true;

    clearAllTimers();
    showPageTransition();
    showFastLoader();

    fullLoaderTimer = setTimeout(() => {
      if (!document.body.classList.contains("app-ready")) {
        showFullLoader(options);
      }
    }, FAST_TO_FULL_DELAY);
  }

  function completeNavigationLoad() {
    clearAllTimers();
    markAppReady();
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

  function setupInitialReadyFlow() {
    document.body.classList.remove("app-ready");
    document.body.classList.add("app-loading");
    showFastLoader();

    pageReadyFallbackTimer = setTimeout(() => {
      markAppReady();
    }, PAGE_READY_FALLBACK);

    window.addEventListener("load", () => {
      completeNavigationLoad();
    });

    window.addEventListener("pageshow", () => {
      completeNavigationLoad();
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
          bootSettled
        };
      }
    };
  }

  function init() {
    ensurePageTransition();
    ensureFastLoader();
    ensureGlobalLoader();
    setupInitialReadyFlow();
    interceptDocumentLinks();
    exposeApi();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !isTransitioning) {
        document.body.classList.add("app-ready");
        document.body.classList.remove("app-loading");
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