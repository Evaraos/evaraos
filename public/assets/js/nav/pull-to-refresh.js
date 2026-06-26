const THRESHOLD = 92;
const MAX_PULL = 138;
let tracking = false;
let startY = 0;
let distance = 0;
let refreshing = false;

function indicator() {
  let node = document.getElementById("evaPullRefresh");
  if (node) return node;
  node = document.createElement("div");
  node.id = "evaPullRefresh";
  node.className = "eva-pull-refresh";
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = '<span class="eva-pull-spinner"></span><strong>Pull to refresh</strong>';
  document.body.appendChild(node);
  return node;
}

function setPull(value) {
  distance = Math.max(0, Math.min(MAX_PULL, value));
  const node = indicator();
  const progress = Math.min(1, distance / THRESHOLD);
  node.style.setProperty("--pull-progress", progress.toFixed(3));
  node.style.transform = `translate3d(-50%, ${Math.max(-60, -58 + distance * .72)}px, 0)`;
  node.classList.toggle("is-ready", distance >= THRESHOLD);
  node.querySelector("strong").textContent = distance >= THRESHOLD ? "Release to refresh" : "Pull to refresh";
  document.documentElement.style.setProperty("--eva-pull-offset", `${distance * .22}px`);
}

function reset() {
  tracking = false;
  distance = 0;
  const node = indicator();
  node.classList.remove("is-ready", "is-refreshing");
  node.style.transform = "translate3d(-50%,-60px,0)";
  document.documentElement.style.setProperty("--eva-pull-offset", "0px");
}

function hardRefresh() {
  if (refreshing) return;
  refreshing = true;
  const node = indicator();
  node.classList.add("is-refreshing");
  node.querySelector("strong").textContent = "Refreshing Evaraos…";
  document.documentElement.style.setProperty("--eva-pull-offset", "18px");
  window.setTimeout(() => window.location.reload(), 260);
}

function begin(clientY) {
  if ((window.scrollY || 0) > 0 || document.body.classList.contains("nav-menu-open")) return;
  tracking = true;
  startY = clientY;
  distance = 0;
}

function move(clientY, event) {
  if (!tracking || refreshing) return;
  const delta = clientY - startY;
  if (delta <= 0) return reset();
  if ((window.scrollY || 0) > 0) return reset();
  if (delta > 8) event?.preventDefault?.();
  setPull(delta * .62);
}

function end() {
  if (!tracking || refreshing) return;
  if (distance >= THRESHOLD) hardRefresh();
  else reset();
}

function bind() {
  indicator();
  window.addEventListener("touchstart", (event) => begin(event.touches?.[0]?.clientY || 0), { passive: true });
  window.addEventListener("touchmove", (event) => move(event.touches?.[0]?.clientY || 0, event), { passive: false });
  window.addEventListener("touchend", end, { passive: true });
  window.addEventListener("pointerdown", (event) => { if (event.pointerType !== "mouse") begin(event.clientY); });
  window.addEventListener("pointermove", (event) => { if (event.pointerType !== "mouse") move(event.clientY, event); });
  window.addEventListener("pointerup", (event) => { if (event.pointerType !== "mouse") end(); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
else bind();
