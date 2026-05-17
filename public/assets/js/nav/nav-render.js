// Folder-based navigation architecture applied.
// Replaces cluttered flat launcher layout with expandable categorized viewport groups.

import {
  getMount,
  getBasePath,
  buildHref,
  getVisibleLinks
} from "./nav-utils.js";

import { iconSvg } from "./nav-icons.js";
import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "nav-render-folder-system-20260517";

const CATEGORY_LABELS = Object.freeze({
  operations: { title: "Operations", subtitle: "Dispatch, jobs & field systems", icon: "◈" },
  organizations: { title: "Organizations", subtitle: "Offices, vendors & leadership", icon: "◎" },
  finance: { title: "Finance", subtitle: "Payroll, revenue & payouts", icon: "$" },
  customer: { title: "Customer", subtitle: "CRM, messaging & history", icon: "◉" },
  intelligence: { title: "Executive", subtitle: "AI, analytics & command systems", icon: "✦" },
  system: { title: "System", subtitle: "Settings & controls", icon: "⚙" },
  access: { title: "Access", subtitle: "Authentication & onboarding", icon: "◌" },
  navigation: { title: "Navigation", subtitle: "Core platform routes", icon: "⬢" },
  account: { title: "Account Tools", subtitle: "Session & preferences", icon: "◍" }
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

  return `
    <a
      href="${clean(href)}"
      class="eva-menu-app-launcher"
      data-menu-link="${clean(href)}"
      data-label="${clean(app.title || "")}" 
      data-group="${clean(app.category || "")}" 
      data-page="${clean(page)}"
      aria-label="${clean(app.title || "Application")}" 
    >
      <span class="eva-menu-app-square">${appIcon(app)}</span>
      <span class="eva-menu-app-name">${clean(app.title || "Application")}</span>
    </a>
  `;
}

function folderSection(category, apps = []) {
  if (!apps.length) return "";

  const copy = CATEGORY_LABELS[category] || {
    title: category,
    subtitle: "Apps",
    icon: "◈"
  };

  return `
    <section class="eva-menu-folder-shell" data-nav-section="${clean(copy.title)}">
      <details class="eva-menu-folder">
        <summary class="eva-folder-summary">
          <div class="eva-folder-copy">
            <span class="eva-folder-icon">${clean(copy.icon)}</span>
            <div>
              <p>${clean(copy.subtitle)}</p>
              <h3>${clean(copy.title)}</h3>
            </div>
          </div>

          <div class="eva-folder-meta">
            <span class="eva-folder-count">${apps.length}</span>
            <span class="eva-folder-chevron">›</span>
          </div>
        </summary>

        <div class="eva-folder-viewport">
          <div class="eva-app-grid">
            ${apps.map(appTileFromApp).join("")}
          </div>
        </div>
      </details>
    </section>
  `;
}

function normalizeRegistryRole(role = "customer") {
  const normalized = String(role || "customer").toLowerCase();

  if (["owner", "super_admin"].includes(normalized)) return "owner";
  if (["admin", "manager", "operations_manager"].includes(normalized)) return "admin";
  if (["organization", "office_owner"].includes(normalized)) return "organization";
  if (["vendor", "service_vendor"].includes(normalized)) return "vendor";
  if (["hr", "hr_manager"].includes(normalized)) return "hr";
  if (["staff", "sales_rep", "technician", "cleaner"].includes(normalized)) return "staff";

  return "customer";
}

function registrySections(role = "customer") {
  const groups = appsByCategory(normalizeRegistryRole(role));

  return CATEGORY_ORDER
    .map((category) => folderSection(category, groups[category] || []))
    .join("");
}

function searchBox(authed = false) {
  return `
    <div class="eva-menu-search" role="search">
      <label class="sr-only" for="evaSearchInput">Search Evaraos apps</label>
      <input id="evaSearchInput" type="search" autocomplete="off" placeholder="${authed ? "Search applications, AI, finance, offices..." : "Search access & onboarding..."}" />
      <div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div>
    </div>
  `;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();

  const topNavigation = `
    <section class="eva-menu-folder-shell">
      <details class="eva-menu-folder" open>
        <summary class="eva-folder-summary">
          <div class="eva-folder-copy">
            <span class="eva-folder-icon">⬢</span>
            <div>
              <p>Core platform routes</p>
              <h3>Navigation</h3>
            </div>
          </div>
          <div class="eva-folder-meta">
            <span class="eva-folder-count">1</span>
            <span class="eva-folder-chevron">›</span>
          </div>
        </summary>

        <div class="eva-folder-viewport">
          <div class="eva-app-grid">
            <a href="${buildHref("index.html")}" class="eva-menu-app-launcher" data-menu-link="${buildHref("index.html")}" data-label="home" data-group="navigation" data-page="index.html">
              <span class="eva-menu-app-square">⌂</span>
              <span class="eva-menu-app-name">Home</span>
            </a>
          </div>
        </div>
      </details>
    </section>
  `;

  const accountTools = groups.authed
    ? `
      <section class="eva-menu-folder-shell eva-account-folder">
        <details class="eva-menu-folder">
          <summary class="eva-folder-summary">
            <div class="eva-folder-copy">
              <span class="eva-folder-icon">◍</span>
              <div>
                <p>Session & preferences</p>
                <h3>Account Tools</h3>
              </div>
            </div>
            <div class="eva-folder-meta">
              <span class="eva-folder-count">1</span>
              <span class="eva-folder-chevron">›</span>
            </div>
          </summary>

          <div class="eva-folder-viewport">
            <div class="eva-app-grid eva-account-grid">
              <a href="#logout" class="eva-menu-app-launcher" id="evaLogoutBtn" data-action="logout" data-label="logout" data-group="account" data-page="logout">
                <span class="eva-menu-app-square">${iconSvg("logout")}</span>
                <span class="eva-menu-app-name">Logout</span>
              </a>
            </div>
          </div>
        </details>
      </section>
    `
    : "";

  const accessFolders = !groups.authed
    ? `
      <section class="eva-menu-folder-shell">
        <details class="eva-menu-folder">
          <summary class="eva-folder-summary">
            <div class="eva-folder-copy">
              <span class="eva-folder-icon">◌</span>
              <div>
                <p>Authentication & onboarding</p>
                <h3>Access</h3>
              </div>
            </div>
            <div class="eva-folder-meta">
              <span class="eva-folder-count">3</span>
              <span class="eva-folder-chevron">›</span>
            </div>
          </summary>

          <div class="eva-folder-viewport">
            <div class="eva-app-grid">
              <a href="${buildHref("login.html")}" class="eva-menu-app-launcher" data-menu-link="${buildHref("login.html")}">
                <span class="eva-menu-app-square">⇥</span>
                <span class="eva-menu-app-name">Login</span>
              </a>

              <a href="${buildHref("signup.html")}" class="eva-menu-app-launcher" data-menu-link="${buildHref("signup.html")}">
                <span class="eva-menu-app-square">＋</span>
                <span class="eva-menu-app-name">Signup</span>
              </a>

              <a href="${buildHref("staff_application.html")}" class="eva-menu-app-launcher" data-menu-link="${buildHref("staff_application.html")}">
                <span class="eva-menu-app-square">◐</span>
                <span class="eva-menu-app-name">Apply</span>
              </a>
            </div>
          </div>
        </details>
      </section>
    `
    : "";

  mount.innerHTML = `
    <div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}">
      <header class="eva-nav-shell" id="evaNavShell">
        <div class="eva-nav-pill glass-shell" id="evaNavPill">
          <div class="eva-left-spacer"></div>
          <div class="eva-right-spacer"></div>

          <div class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" tabindex="0">
            <img src="${getBasePath()}/assets/img/evaraos_logo.png" alt="Evaraos logo" class="eva-logo" />
            <div class="eva-brand-copy">
              <strong>Evaraos Inc</strong>
              <span>Subsidiaries Allocation SaaS</span>
            </div>
          </div>

          <div class="eva-menu-zone" id="evaMenuZone">
            <button class="eva-theme-nav-btn" type="button" id="evaThemePillToggle">
              <span class="eva-theme-nav-icon"></span>
            </button>

            <button class="eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false">
              <span class="eva-burger">
                <span class="eva-burger-line top"></span>
                <span class="eva-burger-line mid"></span>
                <span class="eva-burger-line bot"></span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div class="eva-backdrop" id="evaBackdrop"></div>

      <div class="eva-menu-panel eva-control-center-panel" id="evaMenuPanel">
        <div class="eva-menu-titlebar">
          <div>
            <p>EVARAOS CONTROL CENTER</p>
            <h2>${groups.authed ? "Applications" : "Navigation"}</h2>
          </div>

          <div class="eva-menu-actions">
            <span class="eva-menu-badge">${groups.authed ? clean(normalizeRegistryRole(groups.role)) : "guest"}</span>
          </div>
        </div>

        ${searchBox(groups.authed)}

        <nav class="eva-menu-apps" id="evaLinks">
          ${topNavigation}
          ${accountTools}
          ${groups.authed ? registrySections(groups.role) : accessFolders}
        </nav>
      </div>
    </div>
  `;

  return true;
}
