import { NAV_STATE } from "./nav-config.js";
import { getNavShell, getBrandBlock } from "./nav-utils.js";

let scrollTicking = false;

export function atTopOfPage() {
  return (window.scrollY || 0) <= 18;
}

export function atBottomOfPage() {
  const scrollBottom = (window.scrollY || 0) + window.innerHeight;
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  return scrollBottom >= docHeight - 4;
}

export function isCompact() {
  return !atTopOfPage() && !document.body.classList.contains("nav-menu-open");
}

export function applyProgress() {
  const shell = getNavShell();
  const brand = getBrandBlock();
  if (!shell) return;

  const compact = isCompact();
  const progress = compact ? 0 : 1;
  NAV_STATE.progress = progress;
  NAV_STATE.targetProgress = progress;
  NAV_STATE.motionMode = compact ? "compact" : "expanded";
  NAV_STATE.lastY = window.scrollY || 0;

  shell.style.setProperty("--nav-progress", progress.toFixed(4));
  shell.dataset.navProgress = progress.toFixed(4);
  shell.classList.toggle("compact", compact);
  shell.classList.toggle("expanded", !compact);
  shell.classList.remove("quick-pressing");

  document.body.classList.toggle("eva-nav-compact", compact);
  document.body.classList.toggle("eva-nav-expanded", !compact);
  document.body.classList.remove("eva-pressing-nav");

  if (brand) {
    brand.setAttribute("tabindex", "0");
    brand.style.pointerEvents = "auto";
  }
}

export function setTarget() { applyProgress(); }
export function expandNav() { NAV_STATE.navPinnedOpen = true; applyProgress(); }
export function compactNav() { NAV_STATE.navPinnedOpen = false; applyProgress(); }
export function scheduleCompact() {}
export function clearCompactTimer() {}
export function clearScrollSettleTimer() {}
export function settleAfterScroll() { applyProgress(); }
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
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  window.addEventListener("evara:menu-open", applyProgress);
  window.addEventListener("evara:menu-close", applyProgress);
}

export function animateNav() { applyProgress(); }
