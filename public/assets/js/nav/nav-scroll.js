import { NAV_STATE } from "./nav-config.js";
import { getNavShell, getBrandBlock } from "./nav-utils.js";

let scrollTicking = false;

export function atTopOfPage() {
  return (window.scrollY || 0) <= 4;
}

export function atBottomOfPage() {
  const scrollBottom = (window.scrollY || 0) + window.innerHeight;
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  return scrollBottom >= docHeight - 4;
}

export function isCompact() {
  return false;
}

export function applyProgress() {
  const shell = getNavShell();
  const brand = getBrandBlock();
  if (!shell) return;

  NAV_STATE.progress = 1;
  NAV_STATE.targetProgress = 1;
  NAV_STATE.motionMode = "stable";
  NAV_STATE.lastY = window.scrollY || 0;

  shell.style.setProperty("--nav-progress", "1.0000");
  shell.dataset.navProgress = "1.0000";
  shell.classList.add("expanded");
  shell.classList.remove("compact", "quick-pressing");

  document.body.classList.add("eva-nav-expanded");
  document.body.classList.remove("eva-nav-compact", "eva-pressing-nav");

  if (brand) {
    brand.removeAttribute("aria-disabled");
    brand.setAttribute("tabindex", "0");
    brand.style.pointerEvents = "auto";
  }
}

export function setTarget() {
  NAV_STATE.targetProgress = 1;
  NAV_STATE.motionMode = "stable";
}

export function expandNav() {
  NAV_STATE.navPinnedOpen = true;
  setTarget();
  applyProgress();
}

export function compactNav() {
  expandNav();
}

export function scheduleCompact() {}
export function clearCompactTimer() {}
export function clearScrollSettleTimer() {}
export function settleAfterScroll() {}
export function hideQuickBubbles() {}
export function showQuickBubbles() {}

function requestScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    applyProgress();
  });
}

export function bindScrollBehavior() {
  if (NAV_STATE.scrollBehaviorBound) return;
  NAV_STATE.scrollBehaviorBound = true;
  applyProgress();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
}

export function animateNav() {
  applyProgress();
}
