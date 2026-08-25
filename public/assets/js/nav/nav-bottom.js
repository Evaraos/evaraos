import { buildHref, isAuthenticated, isCurrentPage } from "./nav-utils.js";
import { canAccessPageName, normalizeAccessRole } from "../access-control.js";
import { iconSvg } from "../ui/icons.js";

const REGISTRY = {
  home: { label: "Home", page: "index.html", href: "/", icon: "home" },
  signup: { label: "Sign Up", page: "signup.html", icon: "signup" },
  apply: { label: "Apply", page: "staff_application.html", icon: "applications" },
  dashboard: { label: "Dashboard", page: "dashboard.html", icon: "dashboard" },
  customerHome: { label: "Home", page: "customer_dashboard.html", icon: "dashboard" },
  marketplace: { label: "Order", page: "customer-commerce.html", icon: "payments" },
  customerMap: { label: "Map", page: "customer-service-history.html", icon: "map" },
  bookings: { label: "Bookings", page: "customer-service-history.html", icon: "history" },
  leads: { label: "Leads", page: "leads.html", icon: "leads" },
  jobs: { label: "Jobs", page: "jobs.html", icon: "jobs" },
  messages: { label: "Messages", page: "messages.html", icon: "messages" },
  customerMessages: { label: "Messages", page: "customer-messaging.html", icon: "messages" },
  schedule: { label: "Schedule", page: "schedule.html", icon: "schedule" },
  map: { label: "Map", page: "operations_map.html", icon: "map" },
  settings: { label: "Settings", page: "settings-v2.html", icon: "settings" }
};

const GUEST_DEFAULT_ITEMS = ["home", "signup", "apply"];
const BOTTOM_SCROLL_THRESHOLD = 36;
const BOTTOM_SCROLL_TOP_EPSILON = 4;

let bottomScrollBound = false;
let bottomScrollFrame = 0;
let bottomScrollDirection = "";
let bottomScrollDistance = 0;
let bottomScrollLastY = 0;
let bottomNavCompact = false;

function storedRole() {
  try {
    const raw = localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user") || "{}";
    const user = JSON.parse(raw);
    return String(user.role || localStorage.getItem("evaraos-role") || sessionStorage.getItem("evaraos-role") || "guest").toLowerCase();
  } catch {
    return "guest";
  }
}

function canonicalRole() {
  return normalizeAccessRole(storedRole());
}

function isGuestPublicNavigation() {
  return canAccessPageName(window.location.pathname, "guest") && !isAuthenticated();
}

function roleGroup() {
  if (isGuestPublicNavigation()) return "guest";
  const role = canonicalRole();
  if (role === "customer") return "customer";
  if (["sales", "technician", "cleaner"].includes(role)) return "staff";
  return "ops";
}

function defaultItems() {
  const role = canonicalRole();
  if (role === "customer") return ["customerHome", "marketplace", "bookings", "customerMessages", "settings"];
  if (role === "sales") return ["dashboard", "leads", "map", "messages", "settings"];
  if (["technician", "cleaner"].includes(role)) return ["dashboard", "jobs", "schedule", "map", "messages"];
  return ["home", "dashboard", "leads", "jobs", "messages"];
}

function allowedItemIds(ids, role) {
  return ids.filter((id) => REGISTRY[id] && canAccessPageName(REGISTRY[id].page, role));
}

function scrollY() {
  return Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
}

function applyBottomNavScrollState(nav = document.querySelector(".eva-bottom-nav")) {
  if (!nav) return;
  nav.classList.toggle("is-compact", bottomNavCompact);
  nav.dataset.evaScrollState = bottomNavCompact ? "compact" : "expanded";
}

function setBottomNavCompact(compact) {
  const nextCompact = Boolean(compact);
  if (bottomNavCompact === nextCompact) {
    applyBottomNavScrollState();
    return;
  }
  bottomNavCompact = nextCompact;
  applyBottomNavScrollState();
}

function updateBottomNavOnScroll() {
  bottomScrollFrame = 0;
  const nextY = scrollY();
  const delta = nextY - bottomScrollLastY;
  bottomScrollLastY = nextY;

  if (document.body.classList.contains("nav-menu-open")) {
    bottomScrollDirection = "";
    bottomScrollDistance = 0;
    return;
  }
  if (nextY <= BOTTOM_SCROLL_TOP_EPSILON) {
    bottomScrollDirection = "";
    bottomScrollDistance = 0;
    setBottomNavCompact(false);
    return;
  }
  if (Math.abs(delta) < 1) return;

  const direction = delta > 0 ? "down" : "up";
  if (direction !== bottomScrollDirection) {
    bottomScrollDirection = direction;
    bottomScrollDistance = 0;
  }
  bottomScrollDistance += Math.abs(delta);
  if (bottomScrollDistance < BOTTOM_SCROLL_THRESHOLD) return;

  setBottomNavCompact(direction === "down");
  bottomScrollDistance = 0;
}

function scheduleBottomNavScrollUpdate() {
  if (bottomScrollFrame) return;
  bottomScrollFrame = window.requestAnimationFrame(updateBottomNavOnScroll);
}

function bindBottomNavScroll() {
  if (bottomScrollBound) return;
  bottomScrollBound = true;
  bottomScrollLastY = scrollY();
  window.addEventListener("scroll", scheduleBottomNavScrollUpdate, { passive: true });
}

function workspaceItems() {
  if (isGuestPublicNavigation()) {
    return allowedItemIds(GUEST_DEFAULT_ITEMS, "guest").map((id) => REGISTRY[id]);
  }

  const role = canonicalRole();
  const defaults = allowedItemIds(defaultItems(), role);
  if (role === "customer") return defaults.map((id) => REGISTRY[id]);
  try {
    const saved = JSON.parse(localStorage.getItem("evaraos-workspace") || "{}");
    const ids = Array.isArray(saved.navItems) ? allowedItemIds(saved.navItems, role) : [];
    const selected = ids.length === 5 ? ids : defaults;
    return selected.map((id) => REGISTRY[id]);
  } catch {
    return defaults.map((id) => REGISTRY[id]);
  }
}

export function mountBottomNav(force = false) {
  const layer = document.querySelector(".eva-nav-layer");
  if (!layer) return false;
  if (force) layer.querySelector(".eva-bottom-nav")?.remove();
  if (layer.querySelector(".eva-bottom-nav")) return false;

  const items = workspaceItems();
  const nav = document.createElement("nav");
  nav.className = `eva-bottom-nav eva-bottom-nav--${roleGroup()}`;
  nav.setAttribute("aria-label", "Primary navigation");
  nav.dataset.evaItemCount = String(items.length);
  nav.innerHTML = items.map((item) => {
    const href = item.href || buildHref(item.page);
    const active = isCurrentPage(href);
    return `<a class="eva-bottom-link${active ? " is-active" : ""}" href="${href}" aria-label="${item.label}"${active ? ' aria-current="page"' : ""}><span class="eva-bottom-icon">${iconSvg(item.icon, "eva-icon")}</span><span class="eva-bottom-label">${item.label}</span></a>`;
  }).join("");
  layer.appendChild(nav);
  bindBottomNavScroll();
  applyBottomNavScrollState(nav);
  return true;
}

function start() {
  if (!mountBottomNav()) {
    const observer = new MutationObserver(() => { if (mountBottomNav()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 12000);
  }
  window.addEventListener("evara:session-ready", () => mountBottomNav(true));
  window.addEventListener("evara:workspace-updated", () => mountBottomNav(true));
  window.addEventListener("storage", (event) => { if (["evaraos-workspace", "evaraos-user", "evaraos-role"].includes(event.key)) mountBottomNav(true); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
