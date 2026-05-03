import { NAV_STATE } from "./nav-config.js";
import {
  getNavShell,
  getBrandBlock,
  getQuickBubbles
} from "./nav-utils.js";

const QUICK_HIDE_DELAY = 4200;
const SCROLL_IDLE_DELAY = 900;

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
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
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

  if (pin) NAV_STATE.navPinnedOpen = true;

  setTarget(1, mode);
}

export function compactNav(unpin = false, mode = "tap") {
  if (unpin) NAV_STATE.navPinnedOpen = false;

  setTarget(0, mode);
}

export function scheduleCompact(delay = 5000) {
  clearCompactTimer();

  if (document.body.classList.contains("nav-menu-open")) return;

  NAV_STATE.compactTimer = setTimeout(() => {
    if (!document.body.classList.contains("nav-menu-open")) {
      NAV_STATE.navPinnedOpen = false;
      compactNav(false, "idle");
    }
  }, delay);
}

export function hideQuickBubbles() {
  const bubbles = getQuickBubbles();
  const shell = getNavShell();

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
  pulseHaptic(12);

  shell.classList.add("quick-pressing");
  bubbles.classList.add("show");
  bubbles.setAttribute("aria-hidden", "false");

  clearTimeout(NAV_STATE.quickHideTimer);
  NAV_STATE.quickHideTimer = setTimeout(() => {
    hideQuickBubbles();
  }, QUICK_HIDE_DELAY);
}

export function settleAfterScroll() {
  clearScrollSettleTimer();

  NAV_STATE.scrollSettleTimer = setTimeout(() => {
    if (document.body.classList.contains("nav-menu-open")) return;
    scheduleCompact(SCROLL_IDLE_DELAY);
  }, 120);
}

export function bindScrollBehavior() {
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      const dy = y - NAV_STATE.lastY;

      if (Math.abs(dy) > 1) {
        NAV_STATE.lastScrollDirection = dy < 0 ? -1 : 1;
      }

      if (!document.body.classList.contains("nav-menu-open")) {
        hideQuickBubbles();

        if (Math.abs(dy) > 2) {
          if (dy > 0) {
            compactNav(true, "scroll");
          } else {
            expandNav(false, "scroll");
            scheduleCompact(SCROLL_IDLE_DELAY);
          }
        }
      }

      NAV_STATE.lastY = y;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    () => {
      if (!document.body.classList.contains("nav-menu-open")) settleAfterScroll();
    },
    { passive: true }
  );

  window.addEventListener(
    "wheel",
    () => {
      if (!document.body.classList.contains("nav-menu-open")) settleAfterScroll();
    },
    { passive: true }
  );
}

export function animateNav() {
  const diff = NAV_STATE.targetProgress - NAV_STATE.progress;
  const factor = NAV_STATE.motionMode === "scroll" ? 0.34 : NAV_STATE.motionMode === "idle" ? 0.28 : 0.38;
  const next = Math.abs(diff) < 0.0008 ? NAV_STATE.targetProgress : NAV_STATE.progress + diff * factor;

  applyProgress(next);
  NAV_STATE.rafId = requestAnimationFrame(animateNav);
}
