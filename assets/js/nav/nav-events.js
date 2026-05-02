import { NAV_STATE } from "./nav-config.js";

import {
  buildHref,
  getAppearanceTheme,
  setTheme,
  syncThemeLabel,
  getNavPill,
  getBrandBlock
} from "./nav-utils.js";

import {
  isCompact,
  expandNav,
  setTarget,
  hideQuickBubbles
} from "./nav-scroll.js";

import { closeMenu } from "./nav-menu.js";
import { navigateWithLoader } from "./nav-navigation.js";

export function togglePill(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (document.body.classList.contains("nav-menu-open")) return;

  hideQuickBubbles();

  if (isCompact()) {
    NAV_STATE.navPinnedOpen = true;
    expandNav(true, "tap");
  } else {
    NAV_STATE.navPinnedOpen = false;
    setTarget(0, "tap");
  }
}

export function bindTapToggle() {
  const pill = getNavPill();
  if (!pill || pill.dataset.tapToggleBound === "true") return;

  pill.dataset.tapToggleBound = "true";

  pill.addEventListener("click", (event) => {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    togglePill(event);
  });

  pill.addEventListener("dragstart", (event) => event.preventDefault());
  pill.addEventListener("selectstart", (event) => event.preventDefault());
}

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand || brand.dataset.brandToggleBound === "true") return;

  brand.dataset.brandToggleBound = "true";

  brand.addEventListener("click", (event) => {
    togglePill(event);
  });
}

export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    if (link.dataset.menuLinkBound === "true") return;
    link.dataset.menuLinkBound = "true";

    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const href = link.getAttribute("data-menu-link");
      if (!href) return;

      closeMenu(false);

      navigateWithLoader(href, {
        title: "Loading page",
        subtitle: "Preparing your next screen."
      });
    });
  });

  const logoutBtn = document.getElementById("evaLogoutBtn");

  if (logoutBtn && logoutBtn.dataset.logoutBound !== "true") {
    logoutBtn.dataset.logoutBound = "true";

    logoutBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem("evaraos-user");
        localStorage.removeItem("evaraos-role");
        sessionStorage.removeItem("evaraos-user");
        sessionStorage.removeItem("evaraos-role");
      } catch {}

      closeMenu(false);

      navigateWithLoader(buildHref("login.html"), {
        title: "Signing out",
        subtitle: "Clearing local session and returning to login."
      });
    });
  }
}

export function bindThemeToggle() {
  const toggles = Array.from(document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle"));
  if (!toggles.length) return;

  toggles.forEach((toggle) => {
    if (toggle.dataset.themeBound === "true") return;
    toggle.dataset.themeBound = "true";

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const current = getAppearanceTheme();
      const next = current === "light" ? "dark" : "light";

      try {
        const raw = localStorage.getItem("evaraos-appearance");

        if (raw) {
          const appearance = JSON.parse(raw);
          appearance.mode = next;
          appearance.baseFamily = next;
          localStorage.setItem("evaraos-appearance", JSON.stringify(appearance));
        } else {
          localStorage.setItem("evaraos-appearance", JSON.stringify({
            mode: next,
            baseFamily: next
          }));
        }
      } catch {}

      setTheme(next);
      syncThemeLabel();
    });
  });
}

export function bindSearch() {
  const input = document.getElementById("evaSearchInput");
  const links = Array.from(document.querySelectorAll("#evaLinks .eva-link, #evaAuthLinks .eva-link"));

  if (!input || input.dataset.searchBound === "true") return;

  input.dataset.searchBound = "true";

  input.addEventListener("input", () => {
    const value = input.value.trim().toLowerCase();

    links.forEach((link) => {
      const label = (link.getAttribute("data-label") || "").toLowerCase();
      link.style.display = !value || label.includes(value) ? "" : "none";
    });
  });
}

function bindMenuCloseButton() {
  const closeBtn = document.getElementById("evaMenuCloseBtn");
  if (!closeBtn || closeBtn.dataset.closeBound === "true") return;

  closeBtn.dataset.closeBound = "true";

  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
  });
}

export function bindAllNavEvents() {
  bindTapToggle();
  bindBrandHome();
  bindLinks();
  bindThemeToggle();
  bindSearch();
  bindMenuCloseButton();
  syncThemeLabel();
}
