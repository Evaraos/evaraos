import { NAV_STATE } from "./nav-config.js";

import {
  setTheme,
  getAppearanceTheme,
  syncThemeLabel
} from "./nav-utils.js";

import {
  applyProgress,
  atTopOfPage,
  hideQuickBubbles
} from "./nav-scroll.js";

import {
  renderNav
} from "./nav-render.js";

import {
  bindMenu,
  openMenu,
  closeMenu
} from "./nav-menu.js";

import {
  bindAllNavEvents,
  endCompactPress
} from "./nav-events.js";

export function rebindNavAfterRender() {
  bindAllNavEvents();
  bindMenu();
  syncThemeLabel();
}

export function refreshNav() {
  try {
    const wasOpen = document.body.classList.contains("nav-menu-open");

    if (wasOpen) {
      closeMenu(false);
    }

    renderNav();

    const immediate = atTopOfPage() ? 1 : NAV_STATE.progress;

    applyProgress(immediate);
    rebindNavAfterRender();

    if (wasOpen) {
      openMenu();
    }
  } catch (error) {
    console.warn("Nav refresh failed:", error);
  }
}

export function bindRuntimeRefresh() {
  window.addEventListener("evara:session-ready", () => {
    refreshNav();
  });

  window.addEventListener("storage", (event) => {
    if (
      event.key === "evaraos-user" ||
      event.key === "evaraos-role" ||
      event.key === "evaraos-appearance"
    ) {
      refreshNav();
    }
  });

  window.addEventListener("evara:theme-ready", () => {
    syncThemeLabel();
  });

  window.addEventListener("evara:theme-changed", () => {
    syncThemeLabel();
  });

  window.addEventListener("pageshow", () => {
    NAV_STATE.isNavigating = false;

    setTheme(getAppearanceTheme());
    hideQuickBubbles();
    endCompactPress();

    if (window.EvaraLoader && typeof window.EvaraLoader.completeNavigationLoad === "function") {
      window.EvaraLoader.completeNavigationLoad();
    } else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}
