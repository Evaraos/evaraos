import { buildHref, isCurrentPage } from "./nav-utils.js";

const ITEMS = [
  { label: "Home", page: "index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5V21h-5.2v-6.1H8.7V21H3.5V10.5Z"/></svg>' },
  { label: "Dashboard", page: "dashboard.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>' },
  { label: "Leads", page: "leads.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.8-3.5 4.3-5.2 7.5-5.2S17.7 16.5 19.5 20"/></svg>' },
  { label: "Jobs", page: "jobs.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8.5 6V4.8A1.8 1.8 0 0 1 10.3 3h3.4a1.8 1.8 0 0 1 1.8 1.8V6M3 11h18"/></svg>' },
  { label: "Messages", page: "messages.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 10h8M8 13h5"/></svg>' }
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
    return `<a class="eva-bottom-link${active ? " is-active" : ""}" href="${href}" aria-label="${item.label}"${active ? ' aria-current="page"' : ""}><span class="eva-bottom-icon">${item.icon}</span><span class="eva-bottom-label">${item.label}</span></a>`;
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
