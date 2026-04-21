(function () {
  const FAST_LOADER_ID = "evaraFastLoader";
  const PAGE_TRANSITION_ID = "evaPageTransition";
  const GLOBAL_LOADER_ID = "evaraGlobalLoader";

  const FAST_TO_FULL_DELAY = 700;
  const READY_CLASS_DELAY = 80;
  const PAGE_READY_FALLBACK = 1600;

  let fastLoaderTimer = null;
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
      <img
        src="${getBasePath()}/assets/img/evaraos_logo.png"
        alt="Evaraos"
        class="evara-loader-fast-logo"
        onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
      />
    `;
    document.body.appendChild(el);
    return el;
  }

  function getGlobalLoader() {
    return document.getElementById(GLOBAL_LOADER_ID);
  }

  function clearTimer(timerRefName) {
    if (timerRefName === "fastLoaderTimer" && fastLoaderTimer) {
      clearTimeout(fastLoaderTimer);
      fastLoaderTimer = null;
    }
    if (timerRefName === "fullLoaderTimer" && fullLoaderTimer) {
      clearTimeout(fullLoaderTimer);
      fullLoaderTimer = null;
    }
    if (timerRefName === "readyTimer" && readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
    if (timerRefName === "transitionTimer" && transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    if (timerRefName === "pageReadyFallbackTimer" && pageReadyFallbackTimer) {
      clearTimeout(pageReadyFallbackTimer);
      pageReadyFallbackTimer = null;
    }
  }

  function clearAllTimers() {
    clearTimer("fastLoaderTimer");
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
    fast.classList.add("active");
    fast.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
    document.body.classList.remove("app-ready");
  }

  function hideFastLoader() {
    const fast = document.getElementById(FAST_LOADER_ID);
    if (!fast) return;
    fast.classList.remove("active");
    fast.setAttribute("aria-hidden", "true");
  }

  function showFullLoader() {
    const loader = getGlobalLoader();
    if (!loader) return;

    loader.classList.add("active", "upgrading");
    loader.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
    document.body.classList.remove("app-ready");

    transitionTimer = setTimeout(() => {
      loader.classList.remove("upgrading");
    }, 260);
  }

  function hideFullLoader() {
    const loader = getGlobalLoader();
    if (!loader) return;
    loader.classList.remove("active", "upgrading");
    loader.setAttribute("aria-hidden", "true");
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

  function beginNavigationLoad() {
    if (isTransitioning) return;
    isTransitioning = true;

    clearAllTimers();
    showPageTransition();
    showFastLoader();

    fullLoaderTimer = setTimeout(() => {
      showFullLoader();
      hideFastLoader();
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
      beginNavigationLoad();

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