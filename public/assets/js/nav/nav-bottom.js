import { buildHref, isCurrentPage } from "./nav-utils.js";

const ITEMS = [
  { label: "Home", page: "index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5h-5.2v-6.2H8.7V21H3.5a.5.5 0 0 1-.5-.5v-9.7Z"/></svg>' },
  { label: "Dashboard", page: "dashboard.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6.5v6.5H4V4Zm9.5 0H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5Zm9.5 0H20V20h-6.5v-6.5Z"/></svg>' },
  { label: "Leads", page: "leads.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6ZM4.5 20.5c1.8-2.4 4.2-3.6 7.5-3.6s5.7 1.2 7.5 3.6"/></svg>' },
  { label: "Jobs", page: "jobs.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6V4.8A1.8 1.8 0 0 1 10.3 3h3.4a1.8 1.8 0 0 1 1.8 1.8V6H20a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h4.5Zm2 0h3V5h-3v1Zm-5.5 5h14"/></svg>' },
  { label: "Settings", page: "settings.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.1 5.1v-2.6l-2.2-.7a7.3 7.3 0 0 0-.8-1.9l1.1-2-1.9-1.9-2 1.1a7.3 7.3 0 0 0-1.9-.8L11.7 2H9.1l-.7 2.2a7.3 7.3 0 0 0-1.9.8l-2-1.1-1.9 1.9 1.1 2a7.3 7.3 0 0 0-.8 1.9l-2.2.7v2.6l2.2.7c.2.7.5 1.3.8 1.9l-1.1 2 1.9 1.9 2-1.1c.6.4 1.2.6 1.9.8l.7 2.2h2.6l.7-2.2c.7-.2 1.3-.5 1.9-.8l2 1.1 1.9-1.9-1.1-2c.4-.6.6-1.2.8-1.9l2.2-.7Z"/></svg>' }
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
  const observer = new MutationObserver(() => {
    if (mountBottomNav()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 12000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
