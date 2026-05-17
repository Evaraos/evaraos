import {
  getMount,
  getBasePath,
  buildHref,
  getVisibleLinks
} from "./nav-utils.js";

import { iconSvg } from "./nav-icons.js";
import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "nav-render-registry-clean-20260517";

const CATEGORY_LABELS = Object.freeze({
  operations: { title: "Operations", subtitle: "Jobs, dispatch, field & schedule" },
  organizations: { title: "Organizations", subtitle: "Companies, users, offices & people" },
  finance: { title: "Finance", subtitle: "Revenue, payroll, ledger & payments" },
  customer: { title: "Customer", subtitle: "Portal, messages & service history" },
  intelligence: { title: "Intelligence", subtitle: "AI, analytics & predictions" },
  system: { title: "System", subtitle: "Settings & account control" },
  access: { title: "Access", subtitle: "Login, signup & applications" },
  core: { title: "Core", subtitle: "Start here" }
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

function routeToPage(route = "/") {
  return String(route || "/").replace(/^\//, "");
}

function appIcon(app = {}) {
  const icon = String(app.icon || "");
  if (/^[a-z0-9_-]+$/i.test(icon)) return iconSvg(icon);
  return clean(icon || "◈");
}

function appTileFromApp(app = {}) {
  const href = app.route || "/";
  const page = routeToPage(href);
  const safeLabel = String(app.title || "").toLowerCase();
  const group = String(app.category || "app").toLowerCase();

  return `
    <a
      href="${clean(href)}"
      class="eva-menu-app-launcher"
      data-menu-link="${clean(href)}"
      data-label="${clean(safeLabel)}"
      data-group="${clean(group)}"
      data-page="${clean(page)}"
      aria-label="${clean(app.title)}"
    >
      <span class="eva-menu-app-square">${appIcon(app)}</span>
      <span class="eva-menu-app-name">${clean(app.title)}</span>
    </a>
  `;
}

function legacyAppTile(page, label, icon, options = {}) {
  const href = options.href || buildHref(page);
  const safeLabel = String(label || "").toLowerCase();
  const group = String(options.group || "").toLowerCase();
  const attrs = options.action
    ? `data-action="${clean(options.action)}" id="${clean(options.id || "")}" role="button"`
    : `data-menu-link="${clean(href)}"`;

  return `
    <a
      href="${clean(href)}"
      class="eva-menu-app-launcher"
      ${attrs}
      data-label="${clean(safeLabel)}"
      data-group="${clean(group)}"
      data-page="${clean(page)}"
      aria-label="${clean(label)}"
    >
      <span class="eva-menu-app-square">${iconSvg(icon)}</span>
      <span class="eva-menu-app-name">${clean(label)}</span>
    </a>
  `;
}

function menuSection(category, apps = [], className = "") {
  if (!apps.length) return "";
  const copy = CATEGORY_LABELS[category] || { title: category, subtitle: "Apps" };

  return `
    <section class="eva-menu-section ${className}" data-nav-section="${clean(copy.title)}">
      <details class="eva-menu-folder" open>
        <summary class="eva-section-head eva-folder-summary">
          <span><p>${clean(copy.subtitle)}</p><h3>${clean(copy.title)}</h3></span>
          <span class="eva-folder-count">${apps.length}</span>
        </summary>
        <div class="eva-app-grid">
          ${apps.map(appTileFromApp).join("")}
        </div>
      </details>
    </section>
  `;
}

function legacySection(category, items = []) {
  if (!items.length) return "";
  const copy = CATEGORY_LABELS[category] || { title: category, subtitle: "Access" };

  return `
    <section class="eva-menu-section" data-nav-section="${clean(copy.title)}">
      <details class="eva-menu-folder" open>
        <summary class="eva-section-head eva-folder-summary">
          <span><p>${clean(copy.subtitle)}</p><h3>${clean(copy.title)}</h3></span>
          <span class="eva-folder-count">${items.length}</span>
        </summary>
        <div class="eva-app-grid">
          ${items.map((item) => legacyAppTile(item.page, item.label, item.icon, { group: category })).join("")}
        </div>
      </details>
    </section>
  `;
}

function searchBox(authed = false) {
  return `
    <div class="eva-menu-search" role="search">
      <label class="sr-only" for="evaSearchInput">Search Evaraos apps</label>
      <input id="evaSearchInput" type="search" autocomplete="off" placeholder="${authed ? "Search apps, tools, finance, jobs..." : "Search access, login, staff application..."}" />
      <div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div>
    </div>
  `;
}

function normalizeRegistryRole(role = "customer") {
  const normalized = String(role || "customer").toLowerCase();
  if (["owner", "super_admin"].includes(normalized)) return "owner";
  if (["admin", "manager", "operations_manager", "operations_coordinator"].includes(normalized)) return "admin";
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(normalized)) return "organization";
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(normalized)) return "vendor";
  if (["hr", "hr_manager"].includes(normalized)) return "hr";
  if (["sales", "sales_rep", "technician", "cleaner", "staff", "field_staff", "crew_lead", "customer_support", "quality_control"].includes(normalized)) return "staff";
  return "customer";
}

function registrySections(role = "customer") {
  const groups = appsByCategory(normalizeRegistryRole(role));
  return CATEGORY_ORDER
    .map((category) => menuSection(category, groups[category] || [], `eva-${category}-section`))
    .join("");
}

export function navLink(page, label, icon) {
  return legacyAppTile(page, label, icon);
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();
  const publicNavigation = groups.main.filter((item) => ["index.html"].includes(item.page));
  const accountAccess = groups.main.filter((item) => ["login.html", "signup.html", "reset.html", "staff_application.html"].includes(item.page));

  const bodySections = groups.authed
    ? registrySections(groups.role)
    : legacySection("core", publicNavigation) + legacySection("access", accountAccess);

  const accountTools = groups.authed
    ? `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks" data-render-build="${NAV_RENDER_BUILD}">
        <details class="eva-menu-folder" open>
          <summary class="eva-section-head eva-folder-summary"><span><p>Session</p><h3>Account Tools</h3></span><span class="eva-folder-count">1</span></summary>
          <div class="eva-app-grid eva-account-grid">
            ${legacyAppTile("login.html", "Logout", "logout", { href: "#logout", action: "logout", id: "evaLogoutBtn", group: "account" })}
          </div>
        </details>
      </section>
    `
    : "";

  mount.innerHTML = `
    <div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}">
      <header class="eva-nav-shell" id="evaNavShell">
        <div class="eva-nav-pill glass-shell" id="evaNavPill">
          <div class="eva-left-spacer" aria-hidden="true"></div>
          <div class="eva-right-spacer" aria-hidden="true"></div>
          <div class="eva-brand" id="evaBrandBlock" aria-label="Evaraos brand" data-home-link="${buildHref("index.html")}" tabindex="0">
            <img src="${getBasePath()}/assets/img/evaraos_logo.png" alt="Evaraos logo" class="eva-logo" />
            <div class="eva-brand-copy"><strong>Evaraos Inc</strong><span>Subsidiaries Allocation SaaS</span></div>
          </div>
          <div class="eva-menu-zone" id="evaMenuZone">
            <button class="eva-theme-nav-btn" type="button" id="evaThemePillToggle" aria-label="Toggle light and dark mode" title="Toggle theme">
              <span class="eva-theme-nav-icon" aria-hidden="true"></span>
            </button>
            <button class="eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open Control Center">
              <span class="eva-burger"><span class="eva-burger-line top"></span><span class="eva-burger-line mid"></span><span class="eva-burger-line bot"></span></span>
            </button>
          </div>
        </div>
      </header>
      <div class="eva-backdrop" id="evaBackdrop"></div>
      <div class="eva-menu-panel eva-control-center-panel" id="evaMenuPanel">
        <div class="eva-menu-titlebar">
          <div><p>EVARAOS</p><h2>${groups.authed ? "App Library" : "Control Center"}</h2></div>
          <div class="eva-menu-actions"><span class="eva-menu-badge">${groups.authed ? clean(normalizeRegistryRole(groups.role)) : "Guest"}</span></div>
        </div>
        ${searchBox(groups.authed)}
        <nav class="eva-menu-apps" id="evaLinks" aria-label="Main navigation">
          ${bodySections}
        </nav>
        ${accountTools}
      </div>
    </div>
  `;

  return true;
}
