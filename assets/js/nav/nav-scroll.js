import { NAV_STATE } from "./nav-config.js";
import { getNavShell, getBrandBlock, getQuickBubbles } from "./nav-utils.js";

let lastY = window.scrollY;
let intentionalScrollDistance = 0;

const QUICK_HIDE_DELAY = 5200;
const SCROLL_THRESHOLD = 1;
const INTENTIONAL_SCROLL_UNLOCK = 18;

export function atTopOfPage() {
  return window.scrollY <= 4;
}

export function atBottomOfPage() {
  const scrollBottom = window.scrollY + window.innerHeight;
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  return scrollBottom >= docHeight - 4;
}

export function isCompact() {
  return NAV_STATE.progress <= 0.08;
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

function pulseHaptic(ms = 10) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {}
}

export function applyProgress(value) {
  const shell = getNavShell();
  const brand = getBrandBlock();
  if (!shell) return;

  NAV_STATE.progress = Math.max(0, Math.min(1, value));
  shell.style.setProperty("--nav-progress", NAV_STATE.progress.toFixed(4));

  const compact = NAV_STATE.progress <= 0.08;
  shell.classList.toggle("compact", compact);
  shell.classList.toggle("expanded", !compact);
  document.body.classList.toggle("eva-nav-compact", compact);
  document.body.classList.toggle("eva-nav-expanded", !compact);

  if (brand) {
    brand.removeAttribute("aria-disabled");
    brand.setAttribute("tabindex", "0");
    brand.style.pointerEvents = "auto";
  }
}

export function setTarget(value, mode = "tap") {
  NAV_STATE.targetProgress = Math.max(0, Math.min(1, value));
  NAV_STATE.motionMode = mode;
}

export function expandNav(pin = false, mode = "tap") {
  clearCompactTimer();
  if (pin) {
    NAV_STATE.navPinnedOpen = true;
    NAV_STATE.lastPinnedAt = Date.now();
    intentionalScrollDistance = 0;
  }
  setTarget(1, mode);
}

export function compactNav(unpin = false, mode = "tap") {
  if (unpin) NAV_STATE.navPinnedOpen = false;
  if (NAV_STATE.navPinnedOpen && mode !== "force" && mode !== "scroll") return;
  setTarget(0, mode);
}

export function scheduleCompact(delay = 5000) {
  clearCompactTimer();
  if (document.body.classList.contains("nav-menu-open")) return;
  if (NAV_STATE.quickLocked) return;
  if (NAV_STATE.navPinnedOpen) return;

  NAV_STATE.compactTimer = setTimeout(() => {
    if (!document.body.classList.contains("nav-menu-open") && !NAV_STATE.quickLocked && !NAV_STATE.navPinnedOpen) {
      compactNav(false, "idle");
    }
  }, delay);
}

export function hideQuickBubbles(force = false) {
  if (!force && NAV_STATE.quickLocked) return;

  const bubbles = getQuickBubbles();
  const shell = getNavShell();
  NAV_STATE.quickLocked = false;

  if (NAV_STATE.quickHideTimer) {
    clearTimeout(NAV_STATE.quickHideTimer);
    NAV_STATE.quickHideTimer = null;
  }

  if (bubbles) {
    bubbles.classList.remove("show");
    bubbles.setAttribute("aria-hidden", "true");
  }
  if (shell) shell.classList.remove("quick-pressing");
}

export function showQuickBubbles() {
  const bubbles = getQuickBubbles();
  const shell = getNavShell();
  if (!bubbles || !shell || !isCompact()) return;

  clearCompactTimer();
  pulseHaptic(15);
  NAV_STATE.quickLocked = true;
  shell.classList.add("quick-pressing");
  bubbles.classList.add("show");
  bubbles.setAttribute("aria-hidden", "false");

  clearTimeout(NAV_STATE.quickHideTimer);
  NAV_STATE.quickHideTimer = setTimeout(() => hideQuickBubbles(true), QUICK_HIDE_DELAY);
}

export function settleAfterScroll() {
  clearScrollSettleTimer();
}

export function bindScrollBehavior() {
  lastY = window.scrollY;
  NAV_STATE.lastY = lastY;
  intentionalScrollDistance = 0;

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) <= SCROLL_THRESHOLD) return;

    NAV_STATE.lastScrollDirection = dy < 0 ? -1 : 1;

    if (document.body.classList.contains("nav-menu-open") || NAV_STATE.quickLocked) {
      lastY = y;
      NAV_STATE.lastY = y;
      return;
    }

    intentionalScrollDistance += Math.abs(dy);

    if (NAV_STATE.navPinnedOpen && intentionalScrollDistance < INTENTIONAL_SCROLL_UNLOCK) {
      setTarget(1, "tap");
      lastY = y;
      NAV_STATE.lastY = y;
      return;
    }

    if (intentionalScrollDistance >= INTENTIONAL_SCROLL_UNLOCK) {
      NAV_STATE.navPinnedOpen = false;
    }

    if (dy > 0 && y > 8) setTarget(0, "scroll");
    if (dy < 0) setTarget(1, "scroll");

    lastY = y;
    NAV_STATE.lastY = y;
  }, { passive: true });
}

export function animateNav() {
  const diff = NAV_STATE.targetProgress - NAV_STATE.progress;
  const factor = NAV_STATE.motionMode === "scroll" ? 0.74 : NAV_STATE.motionMode === "idle" ? 0.42 : 0.60;
  const next = Math.abs(diff) < 0.001 ? NAV_STATE.targetProgress : NAV_STATE.progress + diff * factor;
  applyProgress(next);
  NAV_STATE.rafId = requestAnimationFrame(animateNav);
}
