import {
  buildHref,
  getAppearanceTheme,
  setTheme,
  syncThemeLabel,
  getBrandBlock
} from "./nav-utils.js";

import { expandNav } from "./nav-scroll.js";
import { closeMenu } from "./nav-menu.js";
import { navigateWithLoader } from "./nav-navigation.js";

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand || brand.dataset.homeBound === "true") return;

  brand.dataset.homeBound = "true";

  brand.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const href = brand.getAttribute("data-home-link") || buildHref("index.html");

    navigateWithLoader(href, {
      title: "Opening Home",
      subtitle: "Loading the Evaraos home experience."
    });
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
  expandNav(true, "tap");
  bindBrandHome();
  bindLinks();
  bindThemeToggle();
  bindSearch();
  bindMenuCloseButton();
  syncThemeLabel();
}
