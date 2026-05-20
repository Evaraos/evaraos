const THRESHOLD = 86;
const MAX_PULL = 132;

let startY = 0;
let pullY = 0;
let dragging = false;
let refreshing = false;
let indicator = null;
let spinner = null;
let label = null;

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function ensureIndicator() {
  if (indicator) return indicator;

  indicator = document.createElement("div");
  indicator.id = "evaPullRefresh";
  indicator.className = "eva-pull-refresh";
  indicator.innerHTML = '<span class="eva-pull-spinner" aria-hidden="true"></span><span class="eva-pull-label">Pull to refresh</span>';
  document.body.appendChild(indicator);
  spinner = indicator.querySelector(".eva-pull-spinner");
  label = indicator.querySelector(".eva-pull-label");
  return indicator;
}

function setIndicator(distance = 0, state = "idle") {
  ensureIndicator();
  const progress = Math.min(1, distance / THRESHOLD);
  const translate = Math.min(MAX_PULL, distance) - 44;
  indicator.style.setProperty("--pull-progress", progress.toFixed(3));
  indicator.style.transform = `translate3d(-50%, ${translate}px, 0) scale(${0.82 + progress * 0.18})`;
  indicator.dataset.state = state;
  indicator.classList.toggle("active", distance > 4 || refreshing);

  if (label) {
    if (refreshing) label.textContent = "Refreshing";
    else label.textContent = distance >= THRESHOLD ? "Release to refresh" : "Pull to refresh";
  }
}

function resetIndicator() {
  if (refreshing) return;
  pullY = 0;
  dragging = false;
  setIndicator(0, "idle");
}

function refreshCurrentPage() {
  if (refreshing) return;
  refreshing = true;
  setIndicator(THRESHOLD, "refreshing");
  document.body.classList.add("eva-pull-refreshing");
  window.setTimeout(() => {
    window.location.reload();
  }, 360);
}

function onTouchStart(event) {
  if (refreshing) return;
  if (getScrollTop() > 0) return;
  if (!event.touches || event.touches.length !== 1) return;
  startY = event.touches[0].clientY;
  pullY = 0;
  dragging = true;
  ensureIndicator();
}

function onTouchMove(event) {
  if (!dragging || refreshing) return;
  if (!event.touches || event.touches.length !== 1) return;

  const currentY = event.touches[0].clientY;
  const delta = currentY - startY;

  if (delta <= 0) {
    resetIndicator();
    return;
  }

  if (getScrollTop() > 0) {
    resetIndicator();
    return;
  }

  pullY = Math.min(MAX_PULL, delta * 0.58);
  if (pullY > 8) event.preventDefault();
  setIndicator(pullY, pullY >= THRESHOLD ? "release" : "pulling");
}

function onTouchEnd() {
  if (!dragging || refreshing) return;
  const shouldRefresh = pullY >= THRESHOLD;
  dragging = false;
  if (shouldRefresh) refreshCurrentPage();
  else resetIndicator();
}

export function bindPullToRefresh() {
  if (window.__evaraPullRefreshBound) return;
  window.__evaraPullRefreshBound = true;
  ensureIndicator();
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", resetIndicator, { passive: true });
}
