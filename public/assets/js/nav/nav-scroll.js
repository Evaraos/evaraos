import { NAV_STATE } from "./nav-config.js";
import { getNavShell } from "./nav-utils.js";

let ticking = false;
let lastY = window.scrollY || 0;
let visible = true;
const DELTA = 7;
const TOP_GUARD = 18;

export function atTopOfPage() { return (window.scrollY || 0) <= TOP_GUARD; }
export function atBottomOfPage() {
  const bottom = (window.scrollY || 0) + window.innerHeight;
  const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  return bottom >= height - 4;
}
export function isCompact() { return false; }

function setVisibility(nextVisible) {
  const shell = getNavShell();
  if (!shell) return;
  visible = Boolean(nextVisible);
  shell.classList.toggle("is-hidden", !visible);
  shell.classList.toggle("is-visible", visible);
  shell.dataset.navVisible = visible ? "true" : "false";
  document.body.classList.toggle("eva-top-controls-hidden", !visible);
  document.body.classList.toggle("eva-top-controls-visible", visible);
}

export function applyProgress() {
  const shell = getNavShell();
  if (!shell) return;
  if (document.body.classList.contains("nav-menu-open")) setVisibility(true);
  shell.classList.remove("compact", "expanded");
  document.body.classList.remove("eva-nav-compact", "eva-nav-expanded");
  NAV_STATE.progress = visible ? 1 : 0;
  NAV_STATE.targetProgress = NAV_STATE.progress;
}

function processScroll() {
  ticking = false;
  const y = Math.max(0, window.scrollY || 0);
  const delta = y - lastY;

  if (document.body.classList.contains("nav-menu-open") || y <= TOP_GUARD) {
    setVisibility(true);
  } else if (Math.abs(delta) >= DELTA) {
    // X-style behavior: hide while moving deeper into the page, reveal when returning upward.
    setVisibility(delta < 0);
  }

  lastY = y;
  NAV_STATE.lastY = y;
}

function requestScrollUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(processScroll);
}

export function setTarget() { applyProgress(); }
export function expandNav() { setVisibility(true); applyProgress(); }
export function compactNav() { setVisibility(false); applyProgress(); }
export function scheduleCompact() {}
export function clearCompactTimer() {}
export function clearScrollSettleTimer() {}
export function settleAfterScroll() { applyProgress(); }
export function hideQuickBubbles() { setVisibility(false); }
export function showQuickBubbles() { setVisibility(true); }

export function bindScrollBehavior() {
  if (NAV_STATE.scrollBehaviorBound) return;
  NAV_STATE.scrollBehaviorBound = true;
  lastY = window.scrollY || 0;
  setVisibility(true);
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  window.addEventListener("evara:menu-open", () => setVisibility(true));
  window.addEventListener("evara:menu-close", () => { lastY = window.scrollY || 0; setVisibility(true); });
}

export function animateNav() { applyProgress(); }
