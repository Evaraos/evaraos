import { NAV_STATE } from "./nav-config.js";
import {
  getMenuZone,
  getMenuBtn,
  getMenuPanel
} from "./nav-utils.js";
import { applyProgress, expandNav } from "./nav-scroll.js";

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
  if (!zone || !btn) return;

  updateMenuViewportFit();
  lockBodyScroll();
  NAV_STATE.navPinnedOpen = true;
  document.body.classList.add("nav-menu-open");
  zone.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
  expandNav();
  window.dispatchEvent(new CustomEvent("evara:menu-open"));

  requestAnimationFrame(() => {
    window.EvaraTheme?.refreshAdaptiveGlass?.();
    requestAnimationFrame(() => window.EvaraTheme?.refreshAdaptiveGlass?.());
  });
}

export function closeMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  if (!zone || !btn) return;

  document.body.classList.remove("nav-menu-open");
  zone.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
  unlockBodyScroll();
  NAV_STATE.navPinnedOpen = false;
  applyProgress();
  window.dispatchEvent(new CustomEvent("evara:menu-close"));
}

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

  document.addEventListener("click", event => {
    const target = event.target;
    const clickedMenuButton = btn.contains(target);
    const clickedMenuPanel = panel.contains(target);
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
