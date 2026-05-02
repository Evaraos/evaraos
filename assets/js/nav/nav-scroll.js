import { NAV_STATE } from "./nav-config.js";
import { getNavShell } from "./nav-utils.js";

export function atTopOfPage() {
  return window.scrollY <= 4;
}

export function atBottomOfPage() {
  const scrollBottom = window.scrollY + window.innerHeight;
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
  if (!shell) return;

  NAV_STATE.progress = 1;
  NAV_STATE.targetProgress = 1;

  shell.style.setProperty("--nav-progress", "1.0000");
  shell.classList.remove("compact", "is-compact", "island", "is-island");
  shell.classList.add("expanded");
}

export function setTarget(value = 1, mode = "tap") {
  NAV_STATE.targetProgress = 1;
  NAV_STATE.motionMode = mode;
  applyProgress(1);
}

export function expandNav(pin = false, mode = "tap") {
  if (pin) NAV_STATE.navPinnedOpen = true;
  setTarget(1, mode);
}

export function compactNav(unpin = false, mode = "tap") {
  if (unpin) NAV_STATE.navPinnedOpen = false;
  setTarget(1, mode);
}

export function scheduleCompact() {
  clearCompactTimer();
}

export function hideQuickBubbles() {
  const shell = getNavShell();
  if (shell) shell.classList.remove("quick-pressing");

  const bubbles = document.getElementById("evaQuickBubbles");
  if (bubbles) {
    bubbles.classList.remove("show");
    bubbles.setAttribute("aria-hidden", "true");
  }
}

export function showQuickBubbles() {
  return;
}

export function settleAfterScroll() {
  setTarget(1, "scroll");
}

export function bindScrollBehavior() {
  window.addEventListener(
    "scroll",
    () => {
      NAV_STATE.lastY = window.scrollY || 0;
      setTarget(1, "scroll");
      hideQuickBubbles();
    },
    { passive: true }
  );
}

export function animateNav() {
  applyProgress(1);
  NAV_STATE.rafId = requestAnimationFrame(animateNav);
}
