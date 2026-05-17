// Folder-based navigation architecture applied.
// Search now lives at the bottom like the Image 2 control center reference.

import {
  getMount,
  getBasePath,
  buildHref,
  getVisibleLinks
} from "./nav-utils.js";

import { iconSvg } from "./nav-icons.js";
import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "nav-render-folder-search-bottom-20260517";

const CATEGORY_LABELS = Object.freeze({
  operations: { title: "Operations", subtitle: "Field Ops, Dispatch, Jobs & More", icon: "◈" },
  organizations: { title: "Organizations", subtitle: "Companies, Offices, Vendors & Teams", icon: "◎" },
  finance: { title: "Finance", subtitle: "Billing, Payroll, Revenue & Accounting", icon: "$" },
  customer: { title: "Customer", subtitle: "Customer Portal & Support Tools", icon: "◉" },
  intelligence: { title: "Executive", subtitle: "AI Command, Analytics & Intelligence", icon: "✦" },
  system: { title: "System", subtitle: "Administration & System Tools", icon: "⚙" }
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
    <a href="${clean(href)}" class="eva-menu-app-launcher" data-menu-link="${clean(href)}" data-label="${clean(app.title || "")}" data-group="${clean(app.category || "")}" data-page="${clean(page)}" aria-label="${clean(app.title || "Application")}">
      <span class="eva-menu-app-square">${appIcon(app)}</span>
      <span class="eva-menu-app-name">${clean(app.title || "Application")}</span>
    </a>
  `;
}

function folderSection(category, apps = []) {
  if (!apps.length) return "";
  const copy = CATEGORY_LABELS[category] || { title: category, subtitle: "Apps", icon: "◈" };

  return `
    <section class="eva-menu-folder-shell eva-folder-${clean(category)}" data-nav-section="${clean(copy.title)}">
      <details class="eva-menu-folder">
        <summary class="eva-folder-summary">
          <div class="eva-folder-copy">
            <span class="eva-folder-icon">${clean(copy.icon)}</span>
            <div><p>${clean(copy.subtitle)}</p><h3>${clean(copy.title)}</h3></div>
          </div>
          <div class="eva-folder-meta"><span class="eva-folder-count">${apps.length}</span><span class="eva-folder-chevron">›</span></div>
        </summary>
        <div class="eva-folder-viewport"><div class="eva-app-grid">${apps.map(appTileFromApp).join("")}</div></div>
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
  return CATEGORY_ORDER.map((category) => folderSection(category, groups[category] || [])).join("");
}

function searchBox(authed = false) {
  return `
    <div class="eva-menu-search eva-menu-search-bottom" role="search">
      <label class="sr-only" for="evaSearchInput">Search Evaraos apps</label>
      <div class="eva-search-shell">
        <span class="eva-search-icon">⌕</span>
        <input id="evaSearchInput" type="search" autocomplete="off" placeholder="${authed ? "Search apps, groups, tools..." : "Search access & onboarding..."}" />
        <span class="eva-search-key">⌘ K</span>
      </div>
      <div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div>
      <p class="eva-search-helper">✦ Quick search across all systems</p>
    </div>
  `;
}

function navigationSection() {
  return `
    <section class="eva-menu-top-block eva-navigation-block" data-nav-section="Navigation">
      <div class="eva-top-block-head">
        <span class="eva-top-block-icon">⌁</span>
        <div><p>NAVIGATION</p><h3>Go to dashboards & core areas</h3></div>
        <span class="eva-top-block-arrow">›</span>
      </div>
      <div class="eva-quick-strip">
        <a href="${buildHref("index.html")}" data-menu-link="${buildHref("index.html")}" data-label="home" data-group="navigation" data-page="index.html"><span>⌂</span><strong>Home</strong><small>Dashboard</small></a>
        <a href="${buildHref("dashboard.html")}" data-menu-link="${buildHref("dashboard.html")}" data-label="dashboards" data-group="navigation" data-page="dashboard.html"><span>▦</span><strong>Dashboards</strong><small>All Dashboards</small></a>
        <a href="${buildHref("operations_map.html")}" data-menu-link="${buildHref("operations_map.html")}" data-label="map view" data-group="navigation" data-page="operations_map.html"><span>◉</span><strong>Map View</strong><small>Live Operations</small></a>
        <a href="#recent" data-menu-link="${buildHref("dashboard.html")}" data-label="recent" data-group="navigation" data-page="recent"><span>◷</span><strong>Recent</strong><small>History</small></a>
      </div>
    </section>
  `;
}

function accountSection(authed = false) {
  if (!authed) return "";
  return `
    <section class="eva-menu-top-block eva-account-tools-block" data-nav-section="Account Tools">
      <div class="eva-top-block-head">
        <span class="eva-top-block-icon">♙</span>
        <div><p>ACCOUNT TOOLS</p><h3>Profile, settings & preferences</h3></div>
        <span class="eva-top-block-arrow">›</span>
      </div>
      <div class="eva-account-strip">
        <a href="${buildHref("settings.html")}" data-menu-link="${buildHref("settings.html")}" data-label="profile" data-group="account" data-page="settings.html"><span>♙</span><strong>Profile</strong></a>
        <a href="${buildHref("settings.html")}" data-menu-link="${buildHref("settings.html")}" data-label="settings" data-group="account" data-page="settings.html"><span>⚙</span><strong>Settings</strong></a>
        <a href="${buildHref("settings.html")}" data-menu-link="${buildHref("settings.html")}" data-label="preferences" data-group="account" data-page="settings.html"><span>≛</span><strong>Preferences</strong></a>
        <a href="${buildHref("settings.html")}" data-menu-link="${buildHref("settings.html")}" data-label="security" data-group="account" data-page="settings.html"><span>♢</span><strong>Security</strong></a>
        <a href="#logout" id="evaLogoutBtn" data-action="logout" data-label="logout" data-group="account" data-page="logout"><span>⇥</span><strong>Logout</strong></a>
      </div>
    </section>
  `;
}

function accessSection() {
  return `
    <section class="eva-menu-top-block eva-account-tools-block" data-nav-section="Access">
      <div class="eva-top-block-head"><span class="eva-top-block-icon">◌</span><div><p>ACCESS</p><h3>Authentication & onboarding</h3></div><span class="eva-top-block-arrow">›</span></div>
      <div class="eva-account-strip">
        <a href="${buildHref("login.html")}" data-menu-link="${buildHref("login.html")}" data-label="login" data-group="access" data-page="login.html"><span>⇥</span><strong>Login</strong></a>
        <a href="${buildHref("signup.html")}" data-menu-link="${buildHref("signup.html")}" data-label="signup" data-group="access" data-page="signup.html"><span>＋</span><strong>Signup</strong></a>
        <a href="${buildHref("staff_application.html")}" data-menu-link="${buildHref("staff_application.html")}" data-label="apply" data-group="access" data-page="staff_application.html"><span>◐</span><strong>Apply</strong></a>
      </div>
    </section>
  `;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;
  const groups = getVisibleLinks();

  mount.innerHTML = `
    <div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}">
      <header class="eva-nav-shell" id="evaNavShell">
        <div class="eva-nav-pill glass-shell" id="evaNavPill">
          <div class="eva-left-spacer"></div><div class="eva-right-spacer"></div>
          <div class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" tabindex="0">
            <img src="${getBasePath()}/assets/img/evaraos_logo.png" alt="Evaraos logo" class="eva-logo" />
            <div class="eva-brand-copy"><strong>Evaraos Inc</strong><span>Subsidiaries Allocation SaaS</span></div>
          </div>
          <div class="eva-menu-zone" id="evaMenuZone">
            <button class="eva-theme-nav-btn" type="button" id="evaThemePillToggle" aria-label="Toggle theme"><span class="eva-theme-nav-icon"></span></button>
            <button class="eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open menu"><span class="eva-burger"><span class="eva-burger-line top"></span><span class="eva-burger-line mid"></span><span class="eva-burger-line bot"></span></span></button>
          </div>
        </div>
      </header>
      <div class="eva-backdrop" id="evaBackdrop"></div>
      <div class="eva-menu-panel eva-control-center-panel" id="evaMenuPanel">
        <nav class="eva-menu-apps" id="evaLinks">
          ${navigationSection()}
          ${groups.authed ? accountSection(true) : accessSection()}
          <p class="eva-section-label">OPERATIONS</p>
          ${groups.authed ? registrySections(groups.role) : ""}
        </nav>
        ${searchBox(groups.authed)}
      </div>
    </div>
  `;
  return true;
}
