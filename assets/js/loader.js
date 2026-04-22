(function () {
  const FAST_LOADER_ID = "evaraFastLoader";
  const PAGE_TRANSITION_ID = "evaPageTransition";
  const GLOBAL_LOADER_ID = "evaraGlobalLoader";

  const FAST_TO_FULL_DELAY = 120;
  const READY_CLASS_DELAY = 30;
  const PAGE_READY_FALLBACK = 420;

  let fullLoaderTimer = null;
  let readyTimer = null;
  let transitionTimer = null;
  let pageReadyFallbackTimer = null;
  let isTransitioning = false;

  function getBasePath() {
    const path = window.location.pathname;
    const marker = "/evaraos/";
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index + marker.length - 1) : "/evaraos";
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
            <span class="evara-loader-pulse-ring pulse-ring-a"></span>
            <span class="evara-loader-pulse-ring pulse-ring-b"></span>
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

  function clearTimer(name) {
    if (name === "fullLoaderTimer" && fullLoaderTimer) {
      clearTimeout(fullLoaderTimer);
      fullLoaderTimer = null;
    }
    if (name === "readyTimer" && readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
    if (name === "transitionTimer" && transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    if (name === "pageReadyFallbackTimer" && pageReadyFallbackTimer) {
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
    fast.classList.remove("is-exiting");
    fast.classList.add("active", "is-entering");
    fast.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
    document.body.classList.remove("app-ready");

    clearTimer("transitionTimer");
    transitionTimer = setTimeout(() => {
      fast.classList.remove("is-entering");
    }, 170);
  }

  function hideFastLoader() {
    const fast = document.getElementById(FAST_LOADER_ID);
    if (!fast) return;

    fast.classList.remove("is-entering");
    fast.classList.add("is-exiting");

    setTimeout(() => {
      fast.classList.remove("active", "is-exiting");
      fast.setAttribute("aria-hidden", "true");
    }, 160);
  }

  function showFullLoader(options = {}) {
    const loader = ensureGlobalLoader();
    const titleEl = loader.querySelector("#evaraLoaderTitle");
    const subtitleEl = loader.querySelector("#evaraLoaderSubtitle");

    if (titleEl && options.title) titleEl.textContent = options.title;
    if (subtitleEl && options.subtitle) subtitleEl.textContent = options.subtitle;

    loader.classList.remove("is-exiting");
    loader.classList.add("active", "is-entering");
    loader.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
    document.body.classList.remove("app-ready");

    clearTimer("transitionTimer");
    transitionTimer = setTimeout(() => {
      loader.classList.remove("is-entering");
    }, 180);
  }

  function hideFullLoader() {
    const loader = document.getElementById(GLOBAL_LOADER_ID);
    if (!loader) return;

    loader.classList.remove("is-entering");
    loader.classList.add("is-exiting");

    setTimeout(() => {
      loader.classList.remove("active", "is-exiting");
      loader.setAttribute("aria-hidden", "true");
    }, 170);
  }

  function hideAllLoaders() {
    hideFastLoader();
    hideFullLoader();
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
    }, READY_CLASS_DELAY);
  }

  function beginNavigationLoad(options = {}) {
    if (isTransitioning) return;
    isTransitioning = true;

    clearAllTimers();
    showPageTransition();
    showFastLoader();

    fullLoaderTimer = setTimeout(() => {
      hideFastLoader();
      showFullLoader(options);
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
      markAppReady
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
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();