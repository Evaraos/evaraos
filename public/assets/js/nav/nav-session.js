import { NAV_STATE } from "./nav-config.js";
import { syncThemeLabel } from "./nav-utils.js";
import { applyProgress, atTopOfPage } from "./nav-scroll.js";
import { renderNav } from "./nav-render.js";
import { bindMenu, openMenu, closeMenu } from "./nav-menu.js";
import { bindAllNavEvents } from "./nav-events.js";
import { bindNavInteractions } from "./nav-interactions.js";
import { bindLogout } from "./nav-logout.js";

export function rebindNavAfterRender() {
  bindAllNavEvents();
  bindMenu();
  bindNavInteractions();
  bindLogout();
  syncThemeLabel();
}

export function refreshNav() {
  try {
    const wasOpen = document.body.classList.contains("nav-menu-open");
    if (wasOpen) closeMenu(false);

    renderNav();

    const immediate = atTopOfPage() ? 1 : NAV_STATE.progress;
    applyProgress(immediate);
    rebindNavAfterRender();

    if (wasOpen) openMenu();
  } catch (error) {
    console.warn("Nav refresh failed:", error);
  }
}

export function bindRuntimeRefresh() {
  if (NAV_STATE.sessionRefreshBound) return;
  NAV_STATE.sessionRefreshBound = true;

  window.addEventListener("evara:session-ready", refreshNav);

  window.addEventListener("storage", (event) => {
    if (["evaraos-user", "evaraos-role"].includes(event.key)) refreshNav();
    if (event.key === "evaraos-appearance") syncThemeLabel();
  });

  window.addEventListener("evara:theme-applied", syncThemeLabel);
  window.addEventListener("evara:appearance-updated", syncThemeLabel);

  window.addEventListener("pageshow", () => {
    NAV_STATE.isNavigating = false;
    window.EvaraTheme?.applyAppearance?.();
    applyProgress(1);

    if (window.EvaraLoader && typeof window.EvaraLoader.completeNavigationLoad === "function") {
      window.EvaraLoader.completeNavigationLoad();
    } else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}
