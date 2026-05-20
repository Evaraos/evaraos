import { NAV_STATE } from "./nav-config.js";
import { forcePageVisible } from "./nav-utils.js";

function samePageUrl(currentUrl, targetUrl) {
  return currentUrl.origin === targetUrl.origin &&
    currentUrl.pathname === targetUrl.pathname &&
    currentUrl.search === targetUrl.search &&
    currentUrl.hash === targetUrl.hash;
}

function markOutgoing(route = "") {
  document.documentElement.classList.add("eva-route-leaving");
  document.body?.classList.add("eva-route-leaving");

  try {
    sessionStorage.setItem("evaraos-last-route", window.location.pathname || "/");
    sessionStorage.setItem("evaraos-next-route", route || "");
    sessionStorage.setItem("evaraos-route-started-at", String(Date.now()));
  } catch {}
}

function clearOutgoingSoon() {
  window.setTimeout(() => {
    document.documentElement.classList.remove("eva-route-leaving");
    document.body?.classList.remove("eva-route-leaving");
  }, 700);
}

function openHash(targetUrl) {
  if (!targetUrl.hash) return false;
  const target = document.querySelector(targetUrl.hash);
  if (!target) return false;

  forcePageVisible();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", targetUrl.href);
  return true;
}

export function navigateWithLoader(href, options = {}) {
  if (!href || NAV_STATE.isNavigating) return;

  let targetUrl;

  try {
    targetUrl = new URL(href, window.location.origin);
  } catch {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const samePage = samePageUrl(currentUrl, targetUrl);
  const sameDocumentHash = currentUrl.origin === targetUrl.origin &&
    currentUrl.pathname === targetUrl.pathname &&
    currentUrl.search === targetUrl.search &&
    currentUrl.hash !== targetUrl.hash &&
    Boolean(targetUrl.hash);

  if (samePage) {
    forcePageVisible();
    return;
  }

  if (sameDocumentHash && openHash(targetUrl)) return;

  NAV_STATE.isNavigating = true;
  forcePageVisible();
  markOutgoing(targetUrl.pathname);

  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad({
      title: options.title || "Opening Evaraos",
      subtitle: options.subtitle || "Preparing your next screen.",
      theme: options.theme
    });
  }

  window.setTimeout(() => {
    requestAnimationFrame(() => {
      window.location.assign(targetUrl.href);
    });
  }, options.delayMs ?? 90);

  window.setTimeout(() => {
    if (!NAV_STATE.isNavigating) return;

    forcePageVisible();
    clearOutgoingSoon();

    try {
      window.location.href = targetUrl.href;
    } catch {
      window.location.assign(targetUrl.href);
    }
  }, options.fallbackMs ?? 1500);
}

export function completeRouteHandoff() {
  NAV_STATE.isNavigating = false;
  forcePageVisible();
  clearOutgoingSoon();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", completeRouteHandoff, { once: true });
} else {
  completeRouteHandoff();
}

window.addEventListener("pageshow", completeRouteHandoff);
