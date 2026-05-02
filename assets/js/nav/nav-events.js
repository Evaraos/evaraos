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
  compactNav,
  scheduleCompact,
  showQuickBubbles,
  hideQuickBubbles
} from "./nav-scroll.js";

import {
  closeMenu
} from "./nav-menu.js";

import {
  navigateWithLoader
} from "./nav-navigation.js";

export function clearPressTimer() {
  if (NAV_STATE.pressTimer) {
    clearTimeout(NAV_STATE.pressTimer);
    NAV_STATE.pressTimer = null;
  }
}

export function endCompactPress() {
  const pill = getNavPill();

  clearPressTimer();

  if (pill) {
    pill.classList.remove("is-pressing");
  }

  document.body.classList.remove("eva-pressing-nav");
}

export function togglePill(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (document.body.classList.contains("nav-menu-open")) return;

  if (isCompact()) {
    expandNav(true, "tap");
    scheduleCompact(2200);
    return;
  }

  if (window.scrollY > 4) {
    NAV_STATE.navPinnedOpen = false;
    compactNav(true, "tap");
  }
}

export function startCompactPress(event) {
  const pill = getNavPill();

  if (!pill || !isCompact()) return;
  if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
  if (event.target.closest("#evaBrandBlock")) return;

  clearPressTimer();

  NAV_STATE.longPressTriggered = false;

  pill.classList.add("is-pressing");
  document.body.classList.add("eva-pressing-nav");

  NAV_STATE.pressTimer = setTimeout(() => {
    NAV_STATE.longPressTriggered = true;
    showQuickBubbles();
  }, 220);
}

export function bindTapToggle() {
  const pill = getNavPill();
  if (!pill) return;

  function onTouchStart(event) {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    if (event.target.closest("#evaBrandBlock")) return;

    const touch = event.touches ? event.touches[0] : event;

    NAV_STATE.tapStartX = touch.clientX;
    NAV_STATE.tapStartY = touch.clientY;
    NAV_STATE.tapMoved = false;
    NAV_STATE.tapHandled = false;

    startCompactPress(event);
  }

  function onTouchMove(event) {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    if (event.target.closest("#evaBrandBlock")) return;

    const touch = event.touches ? event.touches[0] : event;
    const dx = Math.abs(touch.clientX - NAV_STATE.tapStartX);
    const dy = Math.abs(touch.clientY - NAV_STATE.tapStartY);

    if (dx > 10 || dy > 10) {
      NAV_STATE.tapMoved = true;
      endCompactPress();
    }
  }

  function onTouchEnd(event) {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    if (event.target.closest("#evaBrandBlock")) return;

    const wasLongPress = NAV_STATE.longPressTriggered;

    endCompactPress();

    if (NAV_STATE.tapMoved || NAV_STATE.tapHandled || wasLongPress) return;

    NAV_STATE.tapHandled = true;
    togglePill(event);
  }

  pill.addEventListener("touchstart", onTouchStart, { passive: false });
  pill.addEventListener("touchmove", onTouchMove, { passive: false });
  pill.addEventListener("touchend", onTouchEnd);
  pill.addEventListener("touchcancel", endCompactPress);

  pill.addEventListener("mousedown", (event) => {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    if (event.target.closest("#evaBrandBlock")) return;
    startCompactPress(event);
  });

  pill.addEventListener("mouseup", () => {
    const wasLongPress = NAV_STATE.longPressTriggered;
    endCompactPress();
    if (wasLongPress) return;
  });

  pill.addEventListener("mouseleave", endCompactPress);
  pill.addEventListener("dragstart", (event) => event.preventDefault());
  pill.addEventListener("selectstart", (event) => event.preventDefault());

  pill.addEventListener("click", (event) => {
    if (event.target.closest("#evaMenuBtn, #evaThemePillToggle")) return;
    if (event.target.closest("#evaBrandBlock")) return;

    if (NAV_STATE.longPressTriggered) {
      NAV_STATE.longPressTriggered = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (NAV_STATE.tapHandled) {
      NAV_STATE.tapHandled = false;
      return;
    }

    togglePill(event);
  });
}

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand) return;

  brand.addEventListener("click", (event) => {
    if (isCompact()) {
      event.preventDefault();
      event.stopPropagation();
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

  document.querySelectorAll("[data-quick-link]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const href = btn.getAttribute("data-quick-link");

      hideQuickBubbles();

      navigateWithLoader(href, {
        title: "Opening shortcut",
        subtitle: "Launching your quick action."
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
