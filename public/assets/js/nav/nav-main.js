import { NAV_STATE } from "./nav-config.js";

import {
  getNavShell,
  setTheme,
  getAppearanceTheme,
  syncThemeLabel
} from "./nav-utils.js";

import {
  renderNav
} from "./nav-render.js";

import {
  applyProgress,
  atTopOfPage,
  bindScrollBehavior,
  animateNav
} from "./nav-scroll.js";

import {
  bindMenu
} from "./nav-menu.js";

import {
  bindAllNavEvents
} from "./nav-events.js";

import {
  bindRuntimeRefresh
} from "./nav-session.js";

import {
  bindNavInteractions
} from "./nav-interactions.js";

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
  if (!rendered) return;

  const shell = getNavShell();
  const immediate = atTopOfPage() ? 1 : 0;

  NAV_STATE.progress = immediate;
  NAV_STATE.targetProgress = immediate;

  if (shell) {
    shell.style.setProperty("--nav-progress", immediate.toFixed(4));
    shell.classList.toggle("expanded", immediate === 1);
    shell.classList.toggle("compact", immediate !== 1);
    shell.dataset.navBuild = "unified-20260504";
  }

  applyProgress(immediate);

  bindAllNavEvents();
  bindMenu();
  bindNavInteractions();
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
