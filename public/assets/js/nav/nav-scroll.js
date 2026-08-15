import { NAV_STATE } from "./nav-config.js";
import { getNavShell } from "./nav-utils.js";

let ticking = false;
const TOP_GUARD = 18;

function isMessagesCenterPinned() {
  const body = document.body;
  return Boolean(body?.classList.contains("messages-page") && !body.classList.contains("messages-chat-active"));
}

export function atTopOfPage() {
  return (window.scrollY || 0) <= TOP_GUARD;
}

export function atBottomOfPage() {
  const bottom = (window.scrollY || 0) + window.innerHeight;
  const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  return bottom >= height - 4;
}

export function isCompact() {
  return !atTopOfPage()
    && !NAV_STATE.navPinnedOpen
    && !document.body.classList.contains("nav-menu-open")
    && !isMessagesCenterPinned();
}

function applyMode(compact = isCompact()) {
  const shell = getNavShell();
  if (!shell) return;

  const nextCompact = Boolean(compact)
    && !NAV_STATE.navPinnedOpen
    && !document.body.classList.contains("nav-menu-open");
  const progress = nextCompact ? 0 : 1;

  NAV_STATE.progress = progress;
  NAV_STATE.targetProgress = progress;
  NAV_STATE.motionMode = nextCompact ? "compact" : "expanded";
  NAV_STATE.lastY = window.scrollY || 0;

  shell.style.setProperty("--nav-progress", progress.toFixed(4));
  shell.dataset.navProgress = progress.toFixed(4);
  shell.dataset.navMode = nextCompact ? "compact" : "expanded";
  shell.dataset.navVisible = "true";
  shell.classList.toggle("compact", nextCompact);
  shell.classList.toggle("expanded", !nextCompact);
  shell.classList.remove("is-hidden", "quick-pressing");
  shell.classList.add("is-visible");

  document.body.classList.toggle("eva-nav-compact", nextCompact);
  document.body.classList.toggle("eva-nav-expanded", !nextCompact);
  document.body.classList.remove("eva-top-controls-hidden", "eva-pressing-nav");
  document.body.classList.add("eva-top-controls-visible");
}

export function applyProgress() {
  applyMode();
}

function requestScrollUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    applyProgress();
  });
}

export function setTarget() { applyProgress(); }
export function expandNav() { applyMode(false); }
export function compactNav() { applyMode(true); }
export function scheduleCompact() {}
export function clearCompactTimer() {}
export function clearScrollSettleTimer() {}
export function settleAfterScroll() { applyProgress(); }
export function hideQuickBubbles() {}
export function showQuickBubbles() { applyProgress(); }

export function bindScrollBehavior() {
  if (NAV_STATE.scrollBehaviorBound) return;
  NAV_STATE.scrollBehaviorBound = true;
  applyProgress();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  window.addEventListener("evara:menu-open", () => applyMode(false));
  window.addEventListener("evara:menu-close", requestScrollUpdate);
}

export function animateNav() { applyProgress(); }
