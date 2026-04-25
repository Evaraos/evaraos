import { NAV_STATE } from "./nav-config.js";
import {
  getMenuZone,
  getMenuBtn,
  getMenuPanel
} from "./nav-utils.js";

import {
  expandNav,
  setTarget,
  atTopOfPage,
  hideQuickBubbles
} from "./nav-scroll.js";

export function updateMenuViewportFit() {
  const panel = getMenuPanel();
  if (!panel) return;

  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const topInset = 8;
  const menuTop = window.innerWidth <= 480 ? 62 : 66;
  const bottomInset = 12;

  const maxHeight = Math.max(260, viewportHeight - menuTop - bottomInset);

  panel.style.setProperty("--eva-menu-max-height", `${maxHeight}px`);
  panel.style.top = `calc(max(${topInset}px, env(safe-area-inset-top)) + ${menuTop}px)`;
}

export function lockBodyScroll() {
  NAV_STATE.lockedScrollY = window.scrollY || window.pageYOffset || 0;

  document.body.style.position = "fixed";
  document.body.style.top = `-${NAV_STATE.lockedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
}

export function unlockBodyScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";

  window.scrollTo(0, NAV_STATE.lockedScrollY);
}

export function openMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();

  if (!zone || !btn) return;

  hideQuickBubbles();
  updateMenuViewportFit();
  lockBodyScroll();

  document.body.classList.add("nav-menu-open");
  zone.classList.add("open");
  btn.setAttribute("aria-expanded", "true");

  expandNav(true, "tap");
}

export function closeMenu(shouldCompact = true) {
  const zone = getMenuZone();
  const btn = getMenuBtn();

  if (!zone || !btn) return;

  document.body.classList.remove("nav-menu-open");
  zone.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");

  unlockBodyScroll();

  if (shouldCompact) {
    NAV_STATE.navPinnedOpen = false;

    if (atTopOfPage()) {
      setTarget(1, "tap");
    } else {
      setTarget(0, "tap");
    }
  }
}

export function bindMenu() {
  const zone = getMenuZone();
  const btn = getMenuBtn();
  const panel = getMenuPanel();
  const backdrop = document.getElementById("evaBackdrop");

  if (!zone || !btn || !panel || !backdrop) return;

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    hideQuickBubbles();

    if (document.body.classList.contains("nav-menu-open")) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  panel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  backdrop.addEventListener("click", () => {
    closeMenu(true);
    hideQuickBubbles();
  });

  document.addEventListener("click", (event) => {
    if (!zone.contains(event.target) && !panel.contains(event.target)) {
      if (document.body.classList.contains("nav-menu-open")) {
        closeMenu(true);
      }

      if (!event.target.closest("#evaQuickBubbles")) {
        hideQuickBubbles();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (document.body.classList.contains("nav-menu-open")) {
      updateMenuViewportFit();
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (document.body.classList.contains("nav-menu-open")) {
        updateMenuViewportFit();
      }
    });
  }
}
