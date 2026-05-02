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

function bindAlwaysHomeLogo() {
  const brand = document.getElementById("evaBrandBlock");
  if (!brand || brand.dataset.alwaysHomeBound === "true") return;

  brand.dataset.alwaysHomeBound = "true";

  brand.addEventListener(
    "click",
    (event) => {
      const href = brand.getAttribute("data-home-link") || "/index.html";

      event.preventDefault();
      event.stopPropagation();

      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
        window.EvaraLoader.beginNavigationLoad({
          title: "Opening Home",
          subtitle: "Loading the Evaraos home experience."
        });
      }

      requestAnimationFrame(() => {
        window.location.assign(href);
      });
    },
    true
  );
}

export function initNav() {
  if (NAV_STATE.hasInitialized) return;

  NAV_STATE.hasInitialized = true;

  setTheme(getAppearanceTheme());

  const rendered = renderNav();
  if (!rendered) return;

  bindAlwaysHomeLogo();

  const shell = getNavShell();
  const immediate = atTopOfPage() ? 1 : 0;

  NAV_STATE.progress = immediate;
  NAV_STATE.targetProgress = immediate;

  if (shell) {
    shell.style.setProperty("--nav-progress", immediate.toFixed(4));
    shell.classList.toggle("expanded", immediate === 1);
    shell.classList.toggle("compact", immediate !== 1);
  }

  applyProgress(immediate);

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
