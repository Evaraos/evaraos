import { NAV_STATE } from "./nav-config.js";
import { forcePageVisible } from "./nav-utils.js";

export function navigateWithLoader(href, options = {}) {
  if (!href || NAV_STATE.isNavigating) return;

  let targetUrl;

  try {
    targetUrl = new URL(href, window.location.origin);
  } catch {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const samePage =
    currentUrl.origin === targetUrl.origin &&
    currentUrl.pathname === targetUrl.pathname &&
    currentUrl.search === targetUrl.search &&
    currentUrl.hash === targetUrl.hash;

  if (samePage) return;

  NAV_STATE.isNavigating = true;
  forcePageVisible();

  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad({
      title: options.title || "Opening Evaraos",
      subtitle: options.subtitle || "Preparing your next screen."
    });
  }

  requestAnimationFrame(() => {
    window.location.assign(targetUrl.href);
  });

  setTimeout(() => {
    if (!NAV_STATE.isNavigating) return;

    forcePageVisible();

    try {
      window.location.href = targetUrl.href;
    } catch {
      window.location.assign(targetUrl.href);
    }
  }, 1200);
}
