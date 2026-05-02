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
  const shell = getNavShell();
  return !shell || shell.classList.contains("compact");
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

export function hideQuickBubbles() {
  const shell = getNavShell();
  const bubbles = document.getElementById("evaQuickBubbles");

  if (shell) shell.classList.remove("quick-pressing");

  if (bubbles) {
    bubbles.classList.remove("show");
    bubbles.setAttribute("aria-hidden", "true");
  }

  document.body.classList.remove("eva-pressing-nav");
}

export function showQuickBubbles() {
  hideQuickBubbles();
}

export function applyProgress(value = 0) {
  const shell = getNavShell();
  if (!shell) return;

  const next = value >= 0.5 ? 1 : 0;

  NAV_STATE.progress = next;
  NAV_STATE.targetProgress = next;

  shell.style.setProperty("--nav-progress", next.toFixed(4));

  document.body.classList.toggle("eva-nav-expanded-mode", next === 1);
  document.body.classList.toggle("eva-nav-compact-mode", next === 0);

  if (next === 1) {
    shell.classList.add("expanded");
    shell.classList.remove("compact", "is-compact", "island", "is-island");
  } else {
    shell.classList.add("compact", "is-compact", "island", "is-island");
    shell.classList.remove("expanded");
  }
}

export function setTarget(value = 0, mode = "tap") {
  NAV_STATE.targetProgress = value >= 0.5 ? 1 : 0;
  NAV_STATE.motionMode = mode;
  applyProgress(NAV_STATE.targetProgress);
}

export function expandNav(pin = false, mode = "tap") {
  if (pin) NAV_STATE.navPinnedOpen = true;
  setTarget(1, mode);
}

export function compactNav(unpin = false, mode = "tap") {
  if (unpin) NAV_STATE.navPinnedOpen = false;
  setTarget(0, mode);
}

export function scheduleCompact() {
  clearCompactTimer();
}

export function settleAfterScroll() {
  hideQuickBubbles();
}

export function bindScrollBehavior() {
  window.addEventListener(
    "scroll",
    () => {
      NAV_STATE.lastY = window.scrollY || 0;
      hideQuickBubbles();
    },
    { passive: true }
  );
}

export function animateNav() {
  applyProgress(NAV_STATE.targetProgress || 0);
}
