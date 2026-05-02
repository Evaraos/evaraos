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
  setTarget
} from "./nav-scroll.js";

import {
  closeMenu
} from "./nav-menu.js";

import {
  navigateWithLoader
} from "./nav-navigation.js";

/*
  Long-press shortcuts removed.
  New behavior:
  - Dot is default.
  - Tap dot/pill once = expand full nav.
  - Tap full nav once = shrink back to dot.
  - No long press. No shortcut bubbles.
*/

export function togglePill(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (document.body.classList.contains("nav-menu-open")) return;

  if (isCompact()) {
    NAV_STATE.navPinnedOpen = true;
    expandNav(true, "tap");
    return;
  }

  NAV_STATE.navPinnedOpen = false;
  setTarget(0, "tap");
}

export function bindTapToggle() {
  const pill = getNavPill();
  if (!pill) return;

  pill.addEventListener("click", (event) => {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    if (event.target.closest("#evaBrandBlock") && !isCompact()) return;

    togglePill(event);
  });

  pill.addEventListener("dragstart", (event) => event.preventDefault());
  pill.addEventListener("selectstart", (event) => event.preventDefault());
}

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand) return;

  brand.addEventListener("click", (event) => {
    if (isCompact()) {
      event.preventDefault();
      event.stopPropagation();
      togglePill(event);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const href = brand.getAttribute("data-home-link");

    navigateWithLoader(href, {
      title: "Opening Home",
      subtitle: "Loading the Evaraos home experience."
    });
  });

  brand.addEventListener("keydown", (event) => {
    if (isCompact()) {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      const href = brand.getAttribute("data-home-link");

      navigateWithLoader(href, {
        title: "Opening Home",
        subtitle: "Loading the Evaraos home experience."
      });
    }
  });
}

export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
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

  if (logoutBtn) {
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

  if (!input) return;

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
  if (!closeBtn) return;

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
