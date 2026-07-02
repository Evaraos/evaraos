import { buildHref, isCurrentPage } from "./nav-utils.js";
import { iconSvg } from "../ui/icons.js";
import { navigateWithLoader } from "./nav-navigation.js";

const REGISTRY = {
  home: { label: "Home", page: "index.html", icon: "home" },
  dashboard: { label: "Dashboard", page: "dashboard.html", icon: "dashboard" },
  leads: { label: "Leads", page: "leads.html", icon: "leads" },
  jobs: { label: "Jobs", page: "jobs.html", icon: "jobs" },
  messages: { label: "Messages", page: "messages.html", icon: "messages" },
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

function openBottomRoute(event) {
  const link = event.target.closest(".eva-bottom-link");
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();

  const href = link.getAttribute("href") || "";
  const isMessages = /(?:^|\/)messages\.html(?:$|[?#])/.test(href);

  if (isMessages) {
    try {
      sessionStorage.removeItem("evaraos-active-conversation");
      sessionStorage.setItem("evaraos-messages-view", "center");
    } catch {}

    const target = new URL(href, window.location.origin);
    if (window.location.pathname === target.pathname) {
      document.body.classList.remove("messages-chat-active");
      document.querySelector(".messages-app")?.classList.add("show-list");
      document.documentElement.dataset.messagesView = "center";
      window.EvaraLoader?.markAppReady?.();
      return;
    }

    window.location.assign(target.href);
    return;
  }

  navigateWithLoader(href, {
    title: `Opening ${link.getAttribute("aria-label") || "page"}`,
    subtitle: "Loading your workspace."
  });
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
  nav.addEventListener("click", openBottomRoute);
  layer.appendChild(nav);
  return true;
}

function start() {
  if (!mountBottomNav()) {
    const observer = new MutationObserver(() => { if (mountBottomNav()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 4000);
  }
  window.addEventListener("evara:workspace-updated", () => mountBottomNav(true));
  window.addEventListener("storage", (event) => { if (event.key === "evaraos-workspace") mountBottomNav(true); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
