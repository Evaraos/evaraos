import { buildHref, isCurrentPage } from "./nav-utils.js";

const ITEMS = [
  { label: "Home", page: "index.html", icon: "⌂" },
  { label: "Dashboard", page: "dashboard.html", icon: "◫" },
  { label: "Leads", page: "leads.html", icon: "◎" },
  { label: "Jobs", page: "jobs.html", icon: "◇" },
  { label: "Settings", page: "settings.html", icon: "⚙" }
];

export function mountEssentialNav() {
  const pill = document.getElementById("evaNavPill");
  const menuZone = document.getElementById("evaMenuZone");
  if (!pill || !menuZone || pill.querySelector(".eva-essential-nav")) return;

  const nav = document.createElement("nav");
  nav.className = "eva-essential-nav";
  nav.setAttribute("aria-label", "Essential navigation");
  nav.innerHTML = ITEMS.map((item) => {
    const href = buildHref(item.page);
    const active = isCurrentPage(href);
    return `<a class="eva-essential-link${active ? " is-active" : ""}" href="${href}" aria-label="${item.label}"${active ? ' aria-current="page"' : ""}><span class="eva-essential-icon" aria-hidden="true">${item.icon}</span><span class="eva-essential-label">${item.label}</span></a>`;
  }).join("");

  pill.insertBefore(nav, menuZone);
}
