import { NAV_STATE } from "./nav-config.js";
import { forcePageVisible } from "./nav-utils.js";

function unlockNavigation() {
  NAV_STATE.isNavigating = false;
  forcePageVisible();
  try { window.EvaraLoader?.markAppReady?.(); } catch {}
}

export function navigateWithLoader(href, options = {}) {
  if (!href) return;

  let targetUrl;
  try {
    targetUrl = new URL(href, window.location.origin);
  } catch {
    unlockNavigation();
    return;
  }

  const currentUrl = new URL(window.location.href);
  const samePage =
    currentUrl.origin === targetUrl.origin &&
    currentUrl.pathname === targetUrl.pathname &&
    currentUrl.search === targetUrl.search &&
    currentUrl.hash === targetUrl.hash;

  if (samePage) {
    unlockNavigation();
    return;
  }

  /* A stale navigation lock must never freeze the app. */
  NAV_STATE.isNavigating = true;
  forcePageVisible();

  try {
    window.EvaraLoader?.beginNavigationLoad?.({
      title: options.title || "Opening Evaraos",
      subtitle: options.subtitle || "Preparing your next screen."
    });
  } catch {
    /* Loader visuals are optional; navigation must continue. */
  }

  const go = () => {
    try {
      window.location.href = targetUrl.href;
    } catch {
      unlockNavigation();
      window.location.assign(targetUrl.href);
    }
  };

  requestAnimationFrame(go);

  /* If WebKit cancels the first assignment, retry once, then unlock the UI. */
  setTimeout(() => {
    if (!NAV_STATE.isNavigating) return;
    go();
  }, 700);

  setTimeout(() => {
    if (!NAV_STATE.isNavigating) return;
    unlockNavigation();
  }, 2200);
}

window.addEventListener("pageshow", unlockNavigation);
window.addEventListener("pagehide", () => { NAV_STATE.isNavigating = false; });
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") unlockNavigation();
});
