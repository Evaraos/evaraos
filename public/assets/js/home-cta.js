import { defaultRouteForRole } from "./access-control.js";
import { isVerifiedSession } from "./nav/nav-utils.js";

const HOME_CTA_SELECTOR = "[data-home-guest-cta]";
const ENTER_PLATFORM_SELECTOR = "[data-home-enter-platform]";

export function getHomeCtaState(session = window.EvaraRouteSession) {
  const authenticated = isVerifiedSession(session);
  return Object.freeze({
    authenticated,
    enterPlatformHref: authenticated ? defaultRouteForRole(session.role) : "/login.html"
  });
}

function applyHomeCtaState(session) {
  const state = getHomeCtaState(session);

  document.querySelectorAll(HOME_CTA_SELECTOR).forEach((cta) => {
    cta.hidden = state.authenticated;
  });

  document.querySelectorAll(ENTER_PLATFORM_SELECTOR).forEach((cta) => {
    cta.href = state.enterPlatformHref;
  });
}

function bindHomeCtas() {
  applyHomeCtaState();
  window.addEventListener("evara:session-ready", (event) => {
    applyHomeCtaState(event.detail);
  });
}

if (
  typeof document !== "undefined"
  && typeof window !== "undefined"
  && typeof document.querySelectorAll === "function"
  && typeof window.addEventListener === "function"
) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindHomeCtas, { once: true });
  } else {
    bindHomeCtas();
  }
}
