const THRESHOLD = 86;
const MAX_PULL = 132;

let startY = 0;
let pullY = 0;
let dragging = false;
let refreshing = false;
let indicator = null;
let label = null;
let hasVibrated = false;
let slowLoaderTimer = null;

function menuIsOpen() {
  return document.body.classList.contains("nav-menu-open") || document.documentElement.classList.contains("nav-menu-open");
}

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
  if (label) label.textContent = refreshing ? "Refreshing" : distance >= THRESHOLD ? "Release to refresh" : "Pull to refresh";
}

function resetIndicator() {
  if (refreshing) return;
  pullY = 0;
  dragging = false;
  hasVibrated = false;
  window.clearTimeout(slowLoaderTimer);
  setIndicator(0, "idle");
}

function hardRefreshCurrentPage() {
  const url = new URL(window.location.href);
  url.searchParams.set("_eva_refresh", String(Date.now()));
  window.location.replace(url.toString());
}

function refreshCurrentPage() {
  if (refreshing) return;
  refreshing = true;
  setIndicator(THRESHOLD, "refreshing");
  document.body.classList.add("eva-pull-refreshing");
  try { navigator.vibrate?.([12, 18, 12]); } catch {}
  try { sessionStorage.setItem("evaraos-hard-refresh", String(Date.now())); } catch {}
  slowLoaderTimer = window.setTimeout(() => {
    window.EvaraLoader?.show?.({ variant: "page", title: "Refreshing", subtitle: "Reopening this screen fresh." });
  }, 650);
  window.setTimeout(hardRefreshCurrentPage, 240);
}

function onTouchStart(event) {
  if (refreshing || menuIsOpen()) return;
  if (getScrollTop() > 0) return;
  if (!event.touches || event.touches.length !== 1) return;
  startY = event.touches[0].clientY;
  pullY = 0;
  dragging = true;
  hasVibrated = false;
  ensureIndicator();
}

function onTouchMove(event) {
  if (!dragging || refreshing || menuIsOpen()) { if (menuIsOpen()) resetIndicator(); return; }
  if (!event.touches || event.touches.length !== 1) return;
  const delta = event.touches[0].clientY - startY;
  if (delta <= 0 || getScrollTop() > 0) { resetIndicator(); return; }
  pullY = Math.min(MAX_PULL, delta * 0.58);
  if (pullY > 8) event.preventDefault();
  if (pullY >= THRESHOLD && !hasVibrated) { hasVibrated = true; try { navigator.vibrate?.(16); } catch {} }
  setIndicator(pullY, pullY >= THRESHOLD ? "release" : "pulling");
}

function onTouchEnd() {
  if (!dragging || refreshing || menuIsOpen()) { if (menuIsOpen()) resetIndicator(); return; }
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
