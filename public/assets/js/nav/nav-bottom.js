import { buildHref, isCurrentPage } from "./nav-utils.js";
import { iconSvg } from "../ui/icons.js";

const ITEMS = [
  { label: "Home", page: "index.html", icon: "home" },
  { label: "Dashboard", page: "dashboard.html", icon: "dashboard" },
  { label: "Leads", page: "leads.html", icon: "leads" },
  { label: "Jobs", page: "jobs.html", icon: "jobs" },
  { label: "Messages", page: "messages.html", icon: "messages" }
];

export function mountBottomNav() {
  const layer = document.querySelector(".eva-nav-layer");
  if (!layer || layer.querySelector(".eva-bottom-nav")) return false;
  const nav = document.createElement("nav");
  nav.className = "eva-bottom-nav";
  nav.setAttribute("aria-label", "Primary navigation");
  nav.innerHTML = ITEMS.map((item) => {
    const href = buildHref(item.page);
    const active = isCurrentPage(href);
    return `<a class="eva-bottom-link${active ? " is-active" : ""}" href="${href}" aria-label="${item.label}"${active ? ' aria-current="page"' : ""}><span class="eva-bottom-icon">${iconSvg(item.icon, "eva-icon")}</span><span class="eva-bottom-label">${item.label}</span></a>`;
  }).join("");
  layer.appendChild(nav);
  return true;
}

function start() {
  if (mountBottomNav()) return;
  const observer = new MutationObserver(() => { if (mountBottomNav()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 12000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
