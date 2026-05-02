import { NAV_STATE } from "./nav-config.js";
import {
  getNavShell,
  getBrandBlock,
  getQuickBubbles
} from "./nav-utils.js";

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
    if (compact) {
      brand.setAttribute("aria-disabled", "true");
      brand.setAttribute("tabindex", "-1");
      brand.style.pointerEvents = "none";
    } else {
      brand.removeAttribute("aria-disabled");
      brand.setAttribute("tabindex", "0");
      brand.style.pointerEvents = "auto";
    }
  }
}

export function setTarget(value, mode = "scroll") {
  NAV_STATE.targetProgress = Math.max(0, Math.min(1, value));
  NAV_STATE.motionMode = mode;
}

export function expandNav(pin = false, mode = "tap") {
  clearCompactTimer();

  if (pin) {
    NAV_STATE.navPinnedOpen = true;
  }

  setTarget(1, mode);
}

export function compactNav(unpin = false, mode = "scroll") {
  if (unpin) {
    NAV_STATE.navPinnedOpen = false;
  }

  if (atTopOfPage() && !document.body.classList.contains("nav-menu-open")) {
    setTarget(1, mode);
    return;
  }

  setTarget(0, mode);
}

export function scheduleCompact(delay = 2000) {
  clearCompactTimer();

  if (document.body.classList.contains("nav-menu-open")) return;
  if (atTopOfPage()) return;

  NAV_STATE.compactTimer = setTimeout(() => {
    if (!document.body.classList.contains("nav-menu-open") && !atTopOfPage()) {
      NAV_STATE.navPinnedOpen = false;
      compactNav(false, "tap");
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

  if (shell) {
    shell.classList.remove("quick-pressing");
  }
}

export function showQuickBubbles() {
  const bubbles = getQuickBubbles();
  const shell = getNavShell();

  if (!bubbles || !shell || !isCompact()) return;

  shell.classList.add("quick-pressing");
  bubbles.classList.add("show");
  bubbles.setAttribute("aria-hidden", "false");
}

export function settleAfterScroll() {
  clearScrollSettleTimer();

  NAV_STATE.scrollSettleTimer = setTimeout(() => {
    if (document.body.classList.contains("nav-menu-open")) return;

    if (atTopOfPage()) {
      NAV_STATE.navPinnedOpen = false;
      setTarget(1, "scroll");
      return;
    }

    if (atBottomOfPage()) {
      NAV_STATE.navPinnedOpen = false;
      setTarget(0, "scroll");
      return;
    }

    if (NAV_STATE.lastScrollDirection < 0) {
      NAV_STATE.navPinnedOpen = true;
      setTarget(1, "scroll");
      scheduleCompact(1800);
      return;
    }

    NAV_STATE.navPinnedOpen = false;
    setTarget(0, "scroll");
  }, 42);
}

export function bindScrollBehavior() {
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      const dy = y - NAV_STATE.lastY;

      if (!document.body.classList.contains("nav-menu-open")) {
        clearCompactTimer();

        if (Math.abs(dy) > 0.05) {
          NAV_STATE.lastScrollDirection = dy < 0 ? -1 : 1;
        }

        if (atTopOfPage()) {
          NAV_STATE.navPinnedOpen = false;
          setTarget(1, "scroll");
        } else if (atBottomOfPage()) {
          NAV_STATE.navPinnedOpen = false;
          setTarget(0, "scroll");
        } else {
          const sensitivity = 0.0105;
          const next = Math.max(0, Math.min(1, NAV_STATE.targetProgress - dy * sensitivity));
          setTarget(next, "scroll");
        }

        settleAfterScroll();
        hideQuickBubbles();
      }

      NAV_STATE.lastY = y;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    () => {
      if (!document.body.classList.contains("nav-menu-open")) {
        settleAfterScroll();
      }
    },
    { passive: true }
  );
}

export function animateNav() {
  const diff = NAV_STATE.targetProgress - NAV_STATE.progress;
  const factor = NAV_STATE.motionMode === "tap" ? 0.2 : 0.14;
  const next = Math.abs(diff) < 0.0006
    ? NAV_STATE.targetProgress
    : NAV_STATE.progress + diff * factor;

  applyProgress(next);
  NAV_STATE.rafId = requestAnimationFrame(animateNav);
}
