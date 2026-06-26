// Evaraos App Launcher UI
// Renders categorized, role-aware app launcher and command-search recommendations from the centralized app registry.

import { APP_CATEGORIES, appsByCategory, searchApps } from "./app-registry.js";
import { iconSvg, iconNameForApp, iconNameForCategory } from "../ui/icons.js";

export const APP_LAUNCHER_UI_VERSION = "2026.06.26-icon-system";

const CATEGORY_LABELS = Object.freeze({
  operations: "Operations",
  organizations: "Organizations",
  finance: "Finance",
  customer: "Customer",
  intelligence: "Intelligence",
  system: "System"
});

const CATEGORY_ORDER = Object.freeze([
  APP_CATEGORIES.operations,
  APP_CATEGORIES.organizations,
  APP_CATEGORIES.finance,
  APP_CATEGORIES.customer,
  APP_CATEGORIES.intelligence,
  APP_CATEGORIES.system
]);

function clean(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appTile(app = {}) {
  return `
    <a class="eva-app-launcher-tile" href="${clean(app.route)}" data-app-id="${clean(app.id)}" data-app-route="${clean(app.route)}">
      <span class="eva-app-launcher-icon">${iconSvg(iconNameForApp(app.id))}</span>
      <span class="eva-app-launcher-copy">
        <strong>${clean(app.title)}</strong>
        <small>${clean((app.category || "app").replaceAll("_", " "))}</small>
      </span>
    </a>
  `;
}

function categorySection(category, apps = []) {
  if (!apps.length) return "";
  return `
    <section class="eva-app-launcher-section" data-app-category="${clean(category)}">
      <button class="eva-app-launcher-section-head" type="button" data-toggle-category="${clean(category)}" aria-expanded="true">
        <span class="eva-app-launcher-section-title">${iconSvg(iconNameForCategory(category))}<strong>${clean(CATEGORY_LABELS[category] || category)}</strong></span>
        <b>${apps.length}</b>
      </button>
      <div class="eva-app-launcher-grid">${apps.map(appTile).join("")}</div>
    </section>
  `;
}

export function renderAppLauncher(role = "customer") {
  const groups = appsByCategory(role);
  return `
    <div class="eva-app-launcher" data-app-launcher-version="${APP_LAUNCHER_UI_VERSION}" data-app-launcher-role="${clean(role)}">
      <div class="eva-app-launcher-top">
        <div><p>APP LIBRARY</p><h3>Evaraos Command Apps</h3></div>
        <span>${Object.values(groups).flat().length} apps</span>
      </div>
      ${CATEGORY_ORDER.map((category) => categorySection(category, groups[category] || [])).join("")}
    </div>
  `;
}

export function renderAppSearchResults(query = "", role = "customer") {
  const results = searchApps(query, role).slice(0, 8);
  if (!String(query || "").trim()) return `<div class="eva-app-search-empty">Search apps, pages, tools, and dashboards.</div>`;
  if (!results.length) return `<div class="eva-app-search-empty">No matching Evaraos apps found.</div>`;
  return results.map((app) => `
    <a class="eva-app-search-result" href="${clean(app.route)}" data-app-route="${clean(app.route)}">
      <span>${iconSvg(iconNameForApp(app.id))}</span>
      <strong>${clean(app.title)}</strong>
      <small>${clean(CATEGORY_LABELS[app.category] || app.category)}</small>
    </a>
  `).join("");
}

export function mountAppLauncher(target, role = "customer") {
  const mount = typeof target === "string" ? document.querySelector(target) : target;
  if (!mount) return false;
  mount.innerHTML = renderAppLauncher(role);
  mount.dataset.appLauncherMounted = "true";
  return true;
}

export function bindAppLauncherInteractions(root = document) {
  root.querySelectorAll("[data-toggle-category]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const section = button.closest(".eva-app-launcher-section");
      const expanded = button.getAttribute("aria-expanded") !== "false";
      button.setAttribute("aria-expanded", String(!expanded));
      section?.classList.toggle("is-collapsed", expanded);
    });
  });
}

export function injectAppLauncherStyles() {
  if (document.getElementById("evaAppLauncherStyles")) return;
  const style = document.createElement("style");
  style.id = "evaAppLauncherStyles";
  style.textContent = `
    .eva-app-launcher{display:grid;gap:14px}.eva-app-launcher-top{display:flex;align-items:end;justify-content:space-between;gap:14px;padding:14px 14px 6px}.eva-app-launcher-top p{margin:0 0 3px;font-size:.68rem;font-weight:900;letter-spacing:.14em;opacity:.58}.eva-app-launcher-top h3{margin:0;font-size:1rem}.eva-app-launcher-top span{font-size:.75rem;font-weight:900;opacity:.62}.eva-app-launcher-section{border-radius:24px;border:1px solid var(--liquid-border-outer);background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom));overflow:hidden}.eva-app-launcher-section-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border:0;background:transparent;color:inherit;font:inherit;font-weight:900;cursor:pointer}.eva-app-launcher-section-title{display:flex;align-items:center;gap:9px}.eva-app-launcher-section-title .eva-icon{width:20px;height:20px}.eva-app-launcher-section-head b{display:grid;place-items:center;min-width:26px;height:26px;border-radius:999px;background:var(--liquid-bg-bottom);font-size:.75rem}.eva-app-launcher-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;padding:0 12px 12px}.eva-app-launcher-section.is-collapsed .eva-app-launcher-grid{display:none}.eva-app-launcher-tile,.eva-app-search-result{text-decoration:none;color:inherit}.eva-app-launcher-tile{display:flex;align-items:center;gap:10px;padding:12px;border-radius:18px;background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom));border:1px solid var(--liquid-border-outer);transition:transform .16s ease,background .16s ease}.eva-app-launcher-tile:hover,.eva-app-search-result:hover{transform:translateY(-1px)}.eva-app-launcher-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:14px;background:var(--liquid-bg-bottom);border:1px solid var(--liquid-border-soft)}.eva-app-launcher-icon .eva-icon{width:21px;height:21px}.eva-app-launcher-copy{display:grid;gap:2px;min-width:0}.eva-app-launcher-copy strong{font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eva-app-launcher-copy small{font-size:.7rem;opacity:.62;text-transform:capitalize}.eva-app-search-empty{padding:12px 14px;opacity:.66;font-size:.86rem}.eva-app-search-result{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:linear-gradient(180deg,var(--liquid-bg-top),var(--liquid-bg-bottom));border:1px solid var(--liquid-border-outer);margin:7px 0}.eva-app-search-result .eva-icon{width:19px;height:19px}.eva-app-search-result small{opacity:.62;text-transform:capitalize}
  `;
  document.head.appendChild(style);
}

window.EvaraAppLauncherUI = { version: APP_LAUNCHER_UI_VERSION, renderAppLauncher, renderAppSearchResults, mountAppLauncher, bindAppLauncherInteractions, injectAppLauncherStyles };
