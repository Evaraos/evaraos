import { NAV_STATE } from "./nav-config.js";

import {
  getNavShell,
  setTheme,
  getAppearanceTheme,
  syncThemeLabel
} from "./nav-utils.js";

import { renderNav } from "./nav-render.js";

import {
  applyProgress,
  bindScrollBehavior,
  animateNav
} from "./nav-scroll.js";

import { bindMenu } from "./nav-menu.js";
import { bindAllNavEvents } from "./nav-events.js";
import { bindRuntimeRefresh } from "./nav-session.js";

function bootReadySignal() {
  if (NAV_STATE.hasBootAnimated) return;

  NAV_STATE.hasBootAnimated = true;

  requestAnimationFrame(() => {
    if (window.EvaraLoader && typeof window.EvaraLoader.markAppReady === "function") {
      window.EvaraLoader.markAppReady();
    } else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}

export function initNav() {
  if (NAV_STATE.hasInitialized) return;

  NAV_STATE.hasInitialized = true;

  setTheme(getAppearanceTheme());

  const rendered = renderNav();

  if (!rendered) {
    bootReadySignal();
    return;
  }

  const shell = getNavShell();

  NAV_STATE.progress = 0;
  NAV_STATE.targetProgress = 0;
  NAV_STATE.navPinnedOpen = false;

  if (shell) {
    shell.style.setProperty("--nav-progress", "0.0000");
    shell.classList.add("compact", "is-compact", "island", "is-island");
    shell.classList.remove("expanded");
  }

  applyProgress(0);

  bindAllNavEvents();
  bindMenu();
  bindScrollBehavior();
  bindRuntimeRefresh();
  syncThemeLabel();

  animateNav();
  bootReadySignal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNav, { once: true });
} else {
  initNav();
}
