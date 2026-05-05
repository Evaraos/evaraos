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

import {
  logoutAndRedirect
} from "../firebase.js";

const NAV_ACTION_SELECTOR = "#evaMenuBtn, #evaThemePillToggle, .eva-menu-btn, .eva-theme-nav-btn";
const BRAND_SELECTOR = "#evaBrandBlock";

function isNavActionTarget(event) {
  const target = event?.target;
  return !!target?.closest?.(NAV_ACTION_SELECTOR);
}

function isBrandTarget(event) {
  const target = event?.target;
  return !!target?.closest?.(BRAND_SELECTOR);
}

function shouldIgnorePillTarget(event) {
  return isNavActionTarget(event) || isBrandTarget(event);
}

function stopEvent(event) {
  if (!event) return;
  event.preventDefault();
  event.stopPropagation();
}

export function clearPressTimer() {
  if (NAV_STATE.pressTimer) {
    clearTimeout(NAV_STATE.pressTimer);
    NAV_STATE.pressTimer = null;
  }
}

export function endCompactPress() {
  const pill = getNavPill();

  clearPressTimer();
  pill?.classList.remove("is-pressing");
  document.body.classList.remove("eva-pressing-nav");
}

export function togglePill(event) {
  stopEvent(event);

  if (document.body.classList.contains("nav-menu-open")) return;

  if (isCompact()) {
    expandNav(true, "tap");
    scheduleCompact();
    return;
  }

  compactNav(true, "tap");
}

export function startCompactPress(event) {
  const pill = getNavPill();

  if (!pill || !isCompact() || shouldIgnorePillTarget(event)) return;

  clearPressTimer();
  NAV_STATE.longPressTriggered = false;

  pill.classList.add("is-pressing");
  document.body.classList.add("eva-pressing-nav");

  NAV_STATE.pressTimer = setTimeout(() => {
    NAV_STATE.longPressTriggered = true;
    showQuickBubbles();
  }, 240);
}

export function bindTapToggle() {
  const pill = getNavPill();
  if (!pill) return;

  function onTouchStart(event) {
    if (shouldIgnorePillTarget(event)) return;

    const touch = event.touches ? event.touches[0] : event;

    NAV_STATE.tapStartX = touch.clientX;
    NAV_STATE.tapStartY = touch.clientY;
    NAV_STATE.tapMoved = false;
    NAV_STATE.tapHandled = false;

    startCompactPress(event);
  }

  function onTouchMove(event) {
    if (shouldIgnorePillTarget(event)) return;

    const touch = event.touches ? event.touches[0] : event;
    const dx = Math.abs(touch.clientX - NAV_STATE.tapStartX);
    const dy = Math.abs(touch.clientY - NAV_STATE.tapStartY);

    if (dx > 10 || dy > 10) {
      NAV_STATE.tapMoved = true;
      endCompactPress();
    }
  }

  function onTouchEnd(event) {
    if (shouldIgnorePillTarget(event)) return;

    const wasLongPress = NAV_STATE.longPressTriggered;

    endCompactPress();

    if (NAV_STATE.tapMoved || NAV_STATE.tapHandled || wasLongPress) {
      stopEvent(event);
      return;
    }

    NAV_STATE.tapHandled = true;
    togglePill(event);
  }

  pill.addEventListener("touchstart", onTouchStart, { passive: false });
  pill.addEventListener("touchmove", onTouchMove, { passive: false });
  pill.addEventListener("touchend", onTouchEnd, { passive: false });
  pill.addEventListener("touchcancel", endCompactPress);

  pill.addEventListener("mousedown", (event) => {
    if (shouldIgnorePillTarget(event)) return;
    startCompactPress(event);
  });

  pill.addEventListener("mouseup", (event) => {
    const wasLongPress = NAV_STATE.longPressTriggered;
    endCompactPress();
    if (wasLongPress) {
      NAV_STATE.longPressTriggered = false;
      stopEvent(event);
    }
  });

  pill.addEventListener("mouseleave", endCompactPress);
  pill.addEventListener("dragstart", (event) => event.preventDefault());
  pill.addEventListener("selectstart", (event) => event.preventDefault());

  pill.addEventListener("click", (event) => {
    if (shouldIgnorePillTarget(event)) return;

    if (NAV_STATE.longPressTriggered) {
      NAV_STATE.longPressTriggered = false;
      stopEvent(event);
      return;
    }

    if (NAV_STATE.tapHandled) {
      NAV_STATE.tapHandled = false;
      stopEvent(event);
      return;
    }

    togglePill(event);
  });
}

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand) return;

  function openHome(event) {
    stopEvent(event);

    if (isCompact()) return;

    const href = brand.getAttribute("data-home-link") || buildHref("index.html");

    navigateWithLoader(href, {
      title: "Opening Home",
      subtitle: "Loading the Evaraos home experience."
    });
  }

  brand.addEventListener("click", openHome);

  brand.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    openHome(event);
  });
}

export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      stopEvent(event);

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
      stopEvent(event);

      const href = btn.getAttribute("data-quick-link");
      if (!href) return;

      hideQuickBubbles(true);

      navigateWithLoader(href, {
        title: "Opening shortcut",
        subtitle: "Launching your quick action."
      });
    });
  });

  const logoutBtn = document.getElementById("evaLogoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (event) => {
      stopEvent(event);
      closeMenu(false);
      await logoutAndRedirect(buildHref("login.html"));
    });
  }
}

export function bindThemeToggle() {
  const toggles = Array.from(document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle"));
  if (!toggles.length) return;

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      stopEvent(event);

      const current = getAppearanceTheme();
      const next = current === "light" ? "dark" : "light";

      try {
        const raw = localStorage.getItem("evaraos-appearance");
        const appearance = raw ? JSON.parse(raw) : {};

        appearance.mode = next;
        appearance.baseFamily = next;

        localStorage.setItem("evaraos-appearance", JSON.stringify(appearance));
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
    stopEvent(event);
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
