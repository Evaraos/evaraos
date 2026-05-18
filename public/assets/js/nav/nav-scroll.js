import { NAV_STATE } from "./nav-config.js";
import { getNavShell, getBrandBlock } from "./nav-utils.js";

let lastY = window.scrollY || 0;
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

export function clearCompactTimer() {
  if (NAV_STATE.compactTimer) {
    clearTimeout(NAV_STATE.compactTimer);
    NAV_STATE.compactTimer = null;
  }
}

export function clearScrollSettleTimer() {
  if (NAV_STATE.scrollSettleTimer) {
    clearTimeout(NAV_STATE.scrollSettleTimer);
    NAV_STATE.scrollSettleTimer = null;
  }
}

export function applyProgress(value = 1) {
  const shell = getNavShell();
  const brand = getBrandBlock();
  if (!shell) return;

  NAV_STATE.progress = 1;
  NAV_STATE.targetProgress = 1;

  shell.style.setProperty("--nav-progress", "1.0000");
  shell.dataset.navProgress = "1.0000";
  shell.classList.remove("compact", "quick-pressing");
  shell.classList.add("expanded");

  document.body.classList.remove("eva-nav-compact");
  document.body.classList.add("eva-nav-expanded");

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
  clearCompactTimer();
  NAV_STATE.navPinnedOpen = true;
  setTarget();
  applyProgress(1);
}

export function compactNav() {
  setTarget();
  applyProgress(1);
}

export function scheduleCompact() {
  clearCompactTimer();
}

export function hideQuickBubbles() {
  NAV_STATE.quickLocked = false;
  if (NAV_STATE.quickHideTimer) {
    clearTimeout(NAV_STATE.quickHideTimer);
    NAV_STATE.quickHideTimer = null;
  }
  getNavShell()?.classList.remove("quick-pressing");
}

export function showQuickBubbles() {
  hideQuickBubbles(true);
}

export function settleAfterScroll() {
  clearScrollSettleTimer();
}

function requestScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    lastY = window.scrollY || 0;
    NAV_STATE.lastY = lastY;
    applyProgress(1);
  });
}

export function bindScrollBehavior() {
  lastY = window.scrollY || 0;
  NAV_STATE.lastY = lastY;
  applyProgress(1);
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
}

export function animateNav() {
  applyProgress(1);
}
