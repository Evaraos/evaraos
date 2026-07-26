import { buildHref, isCurrentPage } from "./nav-utils.js";
import { iconSvg } from "../ui/icons.js";

const REGISTRY = {
  home: { label: "Home", page: "index.html", icon: "home" },
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

function storedRole() {
  try {
    const raw = localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user") || "{}";
    const user = JSON.parse(raw);
    return String(user.role || localStorage.getItem("evaraos-role") || sessionStorage.getItem("evaraos-role") || "guest").toLowerCase();
  } catch {
    return "guest";
  }
}

function roleGroup() {
  const role = storedRole();
  if (role === "customer") return "customer";
  if (["sales", "sales_rep", "technician", "tech", "cleaner", "staff", "field_staff", "crew_lead"].includes(role)) return "staff";
  return "ops";
}

function defaultItems() {
  const group = roleGroup();
  if (group === "customer") return ["customerHome", "marketplace", "bookings", "customerMessages", "settings"];
  if (group === "staff") return ["dashboard", "jobs", "schedule", "messages", "settings"];
  return ["home", "dashboard", "leads", "jobs", "messages"];
}

function workspaceItems() {
  const defaults = defaultItems();
  if (roleGroup() === "customer") return defaults.map((id) => REGISTRY[id]);
  try {
    const saved = JSON.parse(localStorage.getItem("evaraos-workspace") || "{}");
    const ids = Array.isArray(saved.navItems) ? saved.navItems.filter((id) => REGISTRY[id]) : [];
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

  const nav = document.createElement("nav");
  nav.className = `eva-bottom-nav eva-bottom-nav--${roleGroup()}`;
  nav.setAttribute("aria-label", "Primary navigation");
  nav.innerHTML = workspaceItems().map((item) => {
    const href = buildHref(item.page);
    const active = isCurrentPage(href);
    return `<a class="eva-bottom-link${active ? " is-active" : ""}" href="${href}" aria-label="${item.label}"${active ? ' aria-current="page"' : ""}><span class="eva-bottom-icon">${iconSvg(item.icon, "eva-icon")}</span><span class="eva-bottom-label">${item.label}</span></a>`;
  }).join("");
  layer.appendChild(nav);
  return true;
}

function start() {
  if (!mountBottomNav()) {
    const observer = new MutationObserver(() => { if (mountBottomNav()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 12000);
  }
  window.addEventListener("evara:nav-rendered", () => mountBottomNav(true));
  window.addEventListener("evara:session-ready", () => mountBottomNav(true));
  window.addEventListener("evara:workspace-updated", () => mountBottomNav(true));
  window.addEventListener("storage", (event) => { if (["evaraos-workspace", "evaraos-user", "evaraos-role"].includes(event.key)) mountBottomNav(true); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
