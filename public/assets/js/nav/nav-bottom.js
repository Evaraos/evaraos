import { buildHref, isCurrentPage } from "./nav-utils.js";
import { iconSvg } from "../ui/icons.js";

const REGISTRY = {
  home: { label: "Home", page: "index.html", icon: "home" },
  dashboard: { label: "Dashboard", page: "dashboard.html", icon: "dashboard" },
  leads: { label: "Leads", page: "leads.html", icon: "leads" },
  jobs: { label: "Jobs", page: "jobs.html", icon: "jobs" },
  messages: { label: "Messages", page: "messages.html?view=center", icon: "messages" },
  schedule: { label: "Schedule", page: "schedule.html", icon: "schedule" },
  map: { label: "Map", page: "operations_map.html", icon: "map" },
  settings: { label: "Settings", page: "settings-v2.html", icon: "settings" }
};

function workspaceItems() {
  try {
    const saved = JSON.parse(localStorage.getItem("evaraos-workspace") || "{}");
    const ids = Array.isArray(saved.navItems) ? saved.navItems.filter((id) => REGISTRY[id]) : [];
    const selected = ids.length === 5 ? ids : ["home", "dashboard", "leads", "jobs", "messages"];
    return selected.map((id) => REGISTRY[id]);
  } catch {
    return [REGISTRY.home, REGISTRY.dashboard, REGISTRY.leads, REGISTRY.jobs, REGISTRY.messages];
  }
}

export function mountBottomNav(force = false) {
  const layer = document.querySelector(".eva-nav-layer");
  if (!layer) return false;
  if (force) layer.querySelector(".eva-bottom-nav")?.remove();
  if (layer.querySelector(".eva-bottom-nav")) return false;

  const nav = document.createElement("nav");
  nav.className = "eva-bottom-nav";
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
    window.setTimeout(() => observer.disconnect(), 2500);
  }
  window.addEventListener("evara:workspace-updated", () => mountBottomNav(true));
  window.addEventListener("storage", (event) => { if (event.key === "evaraos-workspace") mountBottomNav(true); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
