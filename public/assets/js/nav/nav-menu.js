import { NAV_STATE } from "./nav-config.js";
import { getMenuZone, getMenuBtn, getMenuPanel } from "./nav-utils.js";
import { expandNav } from "./nav-scroll.js";

let lockedScrollY = 0;

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
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  NAV_STATE.lockedScrollY = lockedScrollY;
  document.documentElement.classList.add("nav-menu-open", "eva-menu-layer-open");
  document.body.classList.add("nav-menu-open");
  document.body.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";
}

export function unlockBodyScroll() {
  document.documentElement.classList.remove("nav-menu-open", "eva-menu-layer-open");
  document.body.classList.remove("nav-menu-open");
  document.body.style.overflow = "";
  document.body.style.overscrollBehavior = "";
}

export function isMenuOpen() {
  return document.body.classList.contains("nav-menu-open") || document.documentElement.classList.contains("nav-menu-open");
}

export function openMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  if (!zone || !btn) return;
  updateMenuViewportFit();
  lockBodyScroll();
  zone.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
  expandNav(true, "tap");
}

export function closeMenu(keepExpanded = true) {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  if (!zone || !btn) return;
  zone.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
  unlockBodyScroll();
  if (keepExpanded) {
    NAV_STATE.navPinnedOpen = true;
    expandNav(true, "tap");
  }
}

export function toggleMenu(forceOpen = null) {
  if (forceOpen === true) { openMenu(); return true; }
  if (forceOpen === false) { closeMenu(true); return false; }
  if (isMenuOpen()) { closeMenu(true); return false; }
  openMenu();
  return true;
}

function bindMenuTouchGuard(panel) {
  if (window.__evaraMenuTouchGuardBound) return;
  window.__evaraMenuTouchGuardBound = true;
  document.addEventListener("touchmove", (event) => {
    if (!isMenuOpen()) return;
    const target = event.target;
    const currentPanel = getMenuPanel() || panel;
    if (currentPanel && currentPanel.contains(target)) return;
    event.preventDefault();
  }, { passive: false, capture: true });
}

export function bindMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  const panel = getMenuPanel();
  const backdrop = document.getElementById("evaBackdrop");
  if (!zone || !btn || !panel || !backdrop || btn.dataset.menuBound === "true") return;
  btn.dataset.menuBound = "true";
  bindMenuTouchGuard(panel);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    toggleMenu();
  }, true);
  panel.addEventListener("click", (event) => event.stopPropagation());
  backdrop.addEventListener("click", () => closeMenu(true));
  document.addEventListener("click", (event) => {
    const target = event.target;
    const clickedMenuButton = btn.contains(target);
    const clickedMenuPanel = panel.contains(target);
    if (!clickedMenuButton && !clickedMenuPanel && isMenuOpen()) closeMenu(true);
  });
  window.addEventListener("resize", () => { if (isMenuOpen()) updateMenuViewportFit(); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => { if (isMenuOpen()) updateMenuViewportFit(); });
}
