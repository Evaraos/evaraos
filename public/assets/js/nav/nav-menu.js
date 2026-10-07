import { NAV_STATE } from "./nav-config.js";
import {
  getMenuZone,
  getMenuBtn,
  getMenuPanel
} from "./nav-utils.js";
import { applyProgress, expandNav } from "./nav-scroll.js";

const backgroundInert = new Map();
const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

function restoreBackground() {
  for (const [element, wasInert] of backgroundInert) element.inert = wasInert;
  backgroundInert.clear();
}

function isolateDrawer(panel) {
  restoreBackground();
  for (let node = panel; node?.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.id === "evaBackdrop" || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
      backgroundInert.set(sibling, sibling.inert);
      sibling.inert = true;
    }
  }
}

function drawerControls(panel) {
  return [...panel.querySelectorAll(FOCUSABLE)].filter(node => !node.closest('[hidden],[inert],[aria-hidden="true"]') && getComputedStyle(node).visibility !== "hidden" && node.getClientRects().length);
}

function focusDrawer(panel) {
  (drawerControls(panel)[0] || panel).focus({ preventScroll: true });
}

export function updateMenuViewportFit() {
  const panel = getMenuPanel();
  if (!panel) return;
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const bottomInset = 14;
  const menuBottom = Math.max(88, 76 + (window.visualViewport ? window.visualViewport.offsetTop : 0));
  const maxHeight = Math.max(260, viewportHeight - menuBottom - bottomInset);
  panel.style.setProperty("--eva-menu-max-height", `${maxHeight}px`);
}

export function lockBodyScroll() {
  NAV_STATE.lockedScrollY = window.scrollY || window.pageYOffset || 0;
  document.documentElement.classList.add("eva-menu-layer-open");
}

export function unlockBodyScroll() {
  document.documentElement.classList.remove("eva-menu-layer-open");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
}

export function openMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  const panel = getMenuPanel();
  if (!zone || !btn || !panel) return;

  panel.inert = false;
  panel.setAttribute("aria-hidden", "false");
  panel.setAttribute("aria-modal", "true");
  updateMenuViewportFit();
  lockBodyScroll();
  NAV_STATE.navPinnedOpen = true;
  document.body.classList.add("nav-menu-open");
  zone.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
  expandNav();
  if (!panel.contains(document.activeElement)) focusDrawer(panel);
  isolateDrawer(panel);
  window.dispatchEvent(new CustomEvent("evara:menu-open"));

  requestAnimationFrame(() => {
    window.EvaraTheme?.refreshAdaptiveGlass?.();
    requestAnimationFrame(() => window.EvaraTheme?.refreshAdaptiveGlass?.());
  });
}

export function closeMenu(returnFocus = true) {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  if (!zone || !btn) return;

  const wasOpen = document.body.classList.contains("nav-menu-open");
  const panel = getMenuPanel();
  restoreBackground();
  if (panel) {
    panel.inert = true;
    panel.setAttribute("aria-hidden", "true");
    panel.removeAttribute("aria-modal");
  }
  document.body.classList.remove("nav-menu-open");
  zone.classList.remove("open");
  if (wasOpen && returnFocus) btn.focus({ preventScroll: true });
  btn.setAttribute("aria-expanded", "false");
  unlockBodyScroll();
  NAV_STATE.navPinnedOpen = false;
  applyProgress();
  window.dispatchEvent(new CustomEvent("evara:menu-close"));
}

let globalMenuEventsBound = false;

export function bindMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  const panel = getMenuPanel();
  const backdrop = document.getElementById("evaBackdrop");

  if (!zone || !btn || !panel || !backdrop || btn.dataset.menuBound === "true") return;
  btn.dataset.menuBound = "true";

  btn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    if (document.body.classList.contains("nav-menu-open")) closeMenu(true);
    else openMenu();
  }, true);

  panel.addEventListener("click", event => event.stopPropagation());
  backdrop.addEventListener("click", () => closeMenu(true));

  if (globalMenuEventsBound) return;
  globalMenuEventsBound = true;
  document.addEventListener("keydown", event => {
    if (!document.body.classList.contains("nav-menu-open")) return;
    const currentPanel = getMenuPanel();
    if (!currentPanel) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      const controls = drawerControls(currentPanel);
      const first = controls[0], last = controls.at(-1);
      const focus = document.activeElement;
      if (!first) { event.preventDefault(); focusDrawer(currentPanel); }
      else if (!currentPanel.contains(focus) || (event.shiftKey && focus === first) || (!event.shiftKey && focus === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener("focusin", event => {
    const currentPanel = getMenuPanel();
    if (document.body.classList.contains("nav-menu-open") && currentPanel && !currentPanel.contains(event.target)) focusDrawer(currentPanel);
  });
  document.addEventListener("click", event => {
    const target = event.target;
    const clickedMenuButton = getMenuBtn()?.contains(target);
    const clickedMenuPanel = getMenuPanel()?.contains(target);
    if (!clickedMenuButton && !clickedMenuPanel && document.body.classList.contains("nav-menu-open")) closeMenu(true);
  });

  window.addEventListener("resize", () => {
    if (document.body.classList.contains("nav-menu-open")) {
      updateMenuViewportFit();
      window.EvaraTheme?.refreshAdaptiveGlass?.();
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (document.body.classList.contains("nav-menu-open")) {
        updateMenuViewportFit();
        window.EvaraTheme?.refreshAdaptiveGlass?.();
      }
    });
  }
}
