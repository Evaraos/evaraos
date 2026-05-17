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

import { closeMenu } from "./nav-menu.js";
import { navigateWithLoader } from "./nav-navigation.js";
import { logoutAndRedirect } from "../firebase.js";

const NAV_ACTION_SELECTOR = "#evaMenuBtn, #evaThemePillToggle, .eva-menu-btn, .eva-theme-nav-btn";
const BRAND_SELECTOR = "#evaBrandBlock";
const BOUND_ATTR = "data-evara-nav-bound";

function isNavActionTarget(event) {
  return !!event?.target?.closest?.(NAV_ACTION_SELECTOR);
}

function isBrandTarget(event) {
  return !!event?.target?.closest?.(BRAND_SELECTOR);
}

function shouldIgnorePillTarget(event) {
  return isNavActionTarget(event) || isBrandTarget(event);
}

function stopEvent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

function clean(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function bindOnce(node, key, handler, options) {
  if (!node) return false;
  const attr = `${BOUND_ATTR}-${key}`;
  if (node.getAttribute(attr) === "true") return false;
  node.setAttribute(attr, "true");
  node.addEventListener(key, handler, options);
  return true;
}

export function clearPressTimer() {
  if (!NAV_STATE.pressTimer) return;
  clearTimeout(NAV_STATE.pressTimer);
  NAV_STATE.pressTimer = null;
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
  if (!pill || pill.dataset.tapToggleBound === "true") return;
  pill.dataset.tapToggleBound = "true";

  pill.addEventListener("touchstart", (event) => {
    if (shouldIgnorePillTarget(event)) return;
    const touch = event.touches ? event.touches[0] : event;
    NAV_STATE.tapStartX = touch.clientX;
    NAV_STATE.tapStartY = touch.clientY;
    NAV_STATE.tapMoved = false;
    NAV_STATE.tapHandled = false;
    startCompactPress(event);
  }, { passive: false });

  pill.addEventListener("touchmove", (event) => {
    if (shouldIgnorePillTarget(event)) return;
    const touch = event.touches ? event.touches[0] : event;
    const dx = Math.abs(touch.clientX - NAV_STATE.tapStartX);
    const dy = Math.abs(touch.clientY - NAV_STATE.tapStartY);
    if (dx > 10 || dy > 10) {
      NAV_STATE.tapMoved = true;
      endCompactPress();
    }
  }, { passive: false });

  pill.addEventListener("touchend", (event) => {
    if (shouldIgnorePillTarget(event)) return;
    const wasLongPress = NAV_STATE.longPressTriggered;
    endCompactPress();
    if (NAV_STATE.tapMoved || NAV_STATE.tapHandled || wasLongPress) {
      stopEvent(event);
      return;
    }
    NAV_STATE.tapHandled = true;
    togglePill(event);
  }, { passive: false });

  pill.addEventListener("touchcancel", endCompactPress);
  pill.addEventListener("mousedown", (event) => {
    if (!shouldIgnorePillTarget(event)) startCompactPress(event);
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
    if (NAV_STATE.longPressTriggered || NAV_STATE.tapHandled) {
      NAV_STATE.longPressTriggered = false;
      NAV_STATE.tapHandled = false;
      stopEvent(event);
      return;
    }
    togglePill(event);
  });
}

export function bindBrandHome() {
  const brand = getBrandBlock();
  if (!brand || brand.dataset.brandHomeBound === "true") return;
  brand.dataset.brandHomeBound = "true";

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
    if (event.key === "Enter" || event.key === " ") openHome(event);
  });
}

function openNavHref(href, options = {}) {
  if (!href) return;
  closeMenu(false);
  hideQuickBubbles(true);
  navigateWithLoader(href, {
    title: options.title || "Loading page",
    subtitle: options.subtitle || "Preparing your next screen."
  });
}

export function bindLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    bindOnce(link, "click", (event) => {
      stopEvent(event);
      openNavHref(link.getAttribute("data-menu-link") || link.getAttribute("href"));
    });
  });

  document.querySelectorAll("[data-quick-link]").forEach((btn) => {
    bindOnce(btn, "click", (event) => {
      stopEvent(event);
      openNavHref(btn.getAttribute("data-quick-link"), {
        title: "Opening shortcut",
        subtitle: "Launching your quick action."
      });
    });
  });

  const logoutBtn = document.getElementById("evaLogoutBtn");
  bindOnce(logoutBtn, "click", async (event) => {
    stopEvent(event);
    closeMenu(false);
    await logoutAndRedirect(buildHref("login.html"));
  });
}

export function bindThemeToggle() {
  Array.from(document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle")).forEach((toggle) => {
    bindOnce(toggle, "click", (event) => {
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

function navSearchItems() {
  return Array.from(document.querySelectorAll(".eva-menu-app-launcher[data-menu-link]")).map((link) => ({
    label: link.getAttribute("aria-label") || link.textContent.trim(),
    href: link.getAttribute("data-menu-link") || link.getAttribute("href"),
    group: link.getAttribute("data-group") || "",
    page: link.getAttribute("data-page") || "",
    element: link,
    haystack: [
      link.getAttribute("aria-label"),
      link.getAttribute("data-label"),
      link.getAttribute("data-group"),
      link.getAttribute("data-page"),
      link.textContent
    ].filter(Boolean).join(" ").toLowerCase()
  }));
}

function scoreSearchItem(item, query = "") {
  const value = String(query || "").toLowerCase();
  const labelValue = String(item.label || "").toLowerCase();
  const pageValue = String(item.page || "").toLowerCase();
  const groupValue = String(item.group || "").toLowerCase();
  if (!value) return 1;
  if (labelValue === value) return 100;
  if (labelValue.startsWith(value)) return 80;
  if (labelValue.includes(value)) return 60;
  if (pageValue.includes(value)) return 35;
  if (groupValue.includes(value)) return 25;
  if (item.haystack.includes(value)) return 10;
  return 0;
}

function renderSearchResults(root, items = [], query = "") {
  if (!root) return;

  if (!query.trim()) {
    root.innerHTML = '<div class="eva-search-empty">Start typing to search apps, tools, finance, jobs, or settings.</div>';
    root.classList.remove("active");
    return;
  }

  if (!items.length) {
    root.innerHTML = '<div class="eva-search-empty">No matching apps found for “' + clean(query) + '”.</div>';
    root.classList.add("active");
    return;
  }

  root.innerHTML = items.map((item) => {
    return '<button type="button" class="eva-search-result" data-search-link="' + clean(item.href) + '"><strong>' + clean(item.label) + '</strong><span>' + clean(label(item.group || 'App')) + ' • ' + clean(item.page) + '</span></button>';
  }).join("");
  root.classList.add("active");
}

export function bindSearch() {
  const input = document.getElementById("evaSearchInput");
  const resultsRoot = document.getElementById("evaSearchResults");
  if (!input || input.dataset.searchBound === "true") return;
  input.dataset.searchBound = "true";

  function applySearch() {
    const value = input.value.trim().toLowerCase();
    const items = navSearchItems();
    const scored = items
      .map((item) => ({ ...item, score: scoreSearchItem(item, value) }))
      .filter((item) => !value || item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    items.forEach((item) => {
      item.element.hidden = !!value && item.score === 0;
    });

    document.querySelectorAll(".eva-menu-section[data-nav-section]").forEach((section) => {
      const visibleChildren = Array.from(section.querySelectorAll(".eva-menu-app-launcher[data-menu-link]")).some((link) => !link.hidden);
      section.hidden = !!value && !visibleChildren;
    });

    renderSearchResults(resultsRoot, scored.slice(0, 8), input.value);
  }

  input.addEventListener("input", applySearch);
  input.addEventListener("focus", applySearch);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const href = resultsRoot?.querySelector("[data-search-link]")?.getAttribute("data-search-link");
    if (!href) return;
    stopEvent(event);
    openNavHref(href, { title: "Opening result", subtitle: "Launching your selected Evaraos app." });
  });

  resultsRoot?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-link]");
    if (!button) return;
    stopEvent(event);
    openNavHref(button.getAttribute("data-search-link"), {
      title: "Opening result",
      subtitle: "Launching your selected Evaraos app."
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".eva-menu-search")) return;
    resultsRoot?.classList.remove("active");
  });
}

function bindMenuCloseButton() {
  const closeBtn = document.getElementById("evaMenuCloseBtn");
  bindOnce(closeBtn, "click", (event) => {
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
