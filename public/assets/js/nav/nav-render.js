// Evaraos Control Center Renderer
// Single nav-v1 renderer: grouped rows, account tools, AI command prompt, and clean bottom controls.

import {
  getMount,
  getBasePath,
  buildHref,
  getVisibleLinks,
  isCurrentPage
} from "./nav-utils.js";

import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "nav-v1-ai-send-controls";

const CATEGORY_LABELS = Object.freeze({
  operations: { title: "Operations", subtitle: "Field Ops, Dispatch, Jobs & More", icon: "▣" },
  organizations: { title: "Organizations", subtitle: "Companies, Offices, Vendors & Teams", icon: "▥" },
  finance: { title: "Finance", subtitle: "Billing, Payroll, Revenue & Accounting", icon: "$" },
  customer: { title: "Customer", subtitle: "Customer Portal & Support Tools", icon: "♙" },
  intelligence: { title: "Executive", subtitle: "AI Command, Analytics & Intelligence", icon: "ϟ" },
  system: { title: "System", subtitle: "Administration & System Tools", icon: "♢" }
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

function activeAttrs(route = "") {
  return isCurrentPage(route) ? ' aria-current="page" data-active="true"' : "";
}

function normalizeRegistryRole(role = "customer") {
  const normalized = String(role || "customer").toLowerCase();
  if (["owner", "super_admin"].includes(normalized)) return "owner";
  if (["admin", "manager", "operations_manager"].includes(normalized)) return "admin";
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(normalized)) return "organization";
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(normalized)) return "vendor";
  if (["hr", "hr_manager"].includes(normalized)) return "hr";
  if (["staff", "sales", "sales_rep", "technician", "cleaner", "field_staff", "crew_lead"].includes(normalized)) return "staff";
  return "customer";
}

function routeData(apps = []) {
  return clean(JSON.stringify(apps.map((app) => ({ title: app.title, route: app.route, category: app.category, id: app.id }))));
}

function groupRow(category, apps = []) {
  if (!apps.length) return "";
  const copy = CATEGORY_LABELS[category] || { title: category, subtitle: "Apps", icon: "◈" };
  const active = apps.some((app) => isCurrentPage(app.route));
  return `
    <button type="button" class="eva-control-row eva-folder-${clean(category)}" data-nav-group="${clean(category)}" data-group-apps='${routeData(apps)}' ${active ? 'data-active="true" aria-current="page"' : ""} aria-label="Open ${clean(copy.title)} tools">
      <span class="eva-control-row-icon">${clean(copy.icon)}</span>
      <span class="eva-control-row-copy"><strong>${clean(copy.title)}</strong><small>${clean(copy.subtitle)}</small></span>
      <span class="eva-control-row-count">${apps.length}</span>
      <span class="eva-control-row-arrow">›</span>
    </button>`;
}

function registryRows(role = "customer") {
  const groups = appsByCategory(normalizeRegistryRole(role));
  return CATEGORY_ORDER.map((category) => groupRow(category, groups[category] || [])).join("");
}

function aiPromptBox(authed = false) {
  return `
    <div class="eva-menu-search eva-ai-prompt eva-menu-search-bottom" role="search">
      <label class="sr-only" for="evaSearchInput">Ask Evaraos AI</label>
      <div class="eva-ai-prompt-head"><span class="eva-ai-orb">AI</span><div><strong>Evaraos AI Command</strong><small>Ask, search, open pages, or route app actions.</small></div></div>
      <form class="eva-search-shell eva-ai-search-shell" id="evaAiPromptForm" autocomplete="off">
        <span class="eva-search-icon">✦</span>
        <input id="evaSearchInput" name="evaSearchInput" type="search" autocomplete="off" enterkeyhint="send" inputmode="search" placeholder="${authed ? "Ask Evaraos AI anything..." : "Ask about access, onboarding, or the platform..."}" />
        <button class="eva-ai-mic-btn" id="evaAiMicBtn" type="button" aria-label="Speak to Evaraos AI">Mic</button>
        <button class="eva-ai-send-btn" id="evaAiSendBtn" type="submit" aria-label="Send command to Evaraos AI">Send</button>
      </form>
      <div id="evaSearchResults" class="eva-search-results eva-ai-results" aria-live="polite"></div>
      <p class="eva-search-helper">Try: “open jobs”, “show companies”, “go to settings”, or “find leads”.</p>
    </div>`;
}

function navigationSection() {
  const homeHref = buildHref("index.html");
  const dashboardHref = buildHref("dashboard.html");
  const mapHref = buildHref("operations_map.html");
  return `
    <section class="eva-menu-top-block eva-navigation-block" data-nav-section="Navigation">
      <div class="eva-top-block-head"><span class="eva-top-block-icon">↗</span><div><p>NAVIGATION</p><h3>Go to dashboards & core areas</h3></div><span class="eva-top-block-arrow">›</span></div>
      <div class="eva-quick-strip">
        <a href="${homeHref}" data-menu-link="${homeHref}" data-label="home" data-group="navigation" data-page="index.html"${activeAttrs(homeHref)}><span>⌂</span><strong>Home</strong><small>Dashboard</small></a>
        <a href="${dashboardHref}" data-menu-link="${dashboardHref}" data-label="dashboards" data-group="navigation" data-page="dashboard.html"${activeAttrs(dashboardHref)}><span>▦</span><strong>Dashboards</strong><small>All Dashboards</small></a>
        <a href="${mapHref}" data-menu-link="${mapHref}" data-label="map view" data-group="navigation" data-page="operations_map.html"${activeAttrs(mapHref)}><span>◉</span><strong>Map View</strong><small>Live Operations</small></a>
        <a href="${dashboardHref}" data-menu-link="${dashboardHref}" data-label="bookmarks" data-group="navigation" data-page="bookmarks"><span>★</span><strong>Bookmarks</strong><small>Quick Access</small></a>
        <a href="${dashboardHref}" data-menu-link="${dashboardHref}" data-label="recent" data-group="navigation" data-page="recent"><span>◷</span><strong>Recent</strong><small>History</small></a>
      </div>
    </section>`;
}

function accountSection(authed = false) {
  if (!authed) return "";
  const settingsHref = buildHref("settings.html");
  const notificationsHref = buildHref("notifications.html");
  return `
    <section class="eva-menu-top-block eva-account-tools-block" data-nav-section="Account Tools">
      <div class="eva-top-block-head"><span class="eva-top-block-icon">♙</span><div><p>ACCOUNT TOOLS</p><h3>Profile, settings & preferences</h3></div><span class="eva-top-block-arrow">›</span></div>
      <div class="eva-account-strip">
        <a href="${settingsHref}" data-menu-link="${settingsHref}" data-label="profile" data-group="account" data-page="settings.html"${activeAttrs(settingsHref)}><span>♙</span><strong>Profile</strong></a>
        <a href="${settingsHref}" data-menu-link="${settingsHref}" data-label="settings" data-group="account" data-page="settings.html"${activeAttrs(settingsHref)}><span>⚙</span><strong>Settings</strong></a>
        <a href="${notificationsHref}" data-menu-link="${notificationsHref}" data-label="notifications" data-group="account" data-page="notifications.html"${activeAttrs(notificationsHref)}><span>♧</span><strong>Alerts</strong></a>
        <a href="${settingsHref}" data-menu-link="${settingsHref}" data-label="security" data-group="account" data-page="settings.html"${activeAttrs(settingsHref)}><span>♢</span><strong>Security</strong></a>
        <a href="#logout" id="evaLogoutBtn" data-action="logout" data-label="logout" data-group="account" data-page="logout"><span>⇥</span><strong>Logout</strong></a>
      </div>
    </section>`;
}

function accessSection() {
  const loginHref = buildHref("login.html");
  const signupHref = buildHref("signup.html");
  const applyHref = buildHref("staff_application.html");
  return `
    <section class="eva-menu-top-block eva-account-tools-block" data-nav-section="Access">
      <div class="eva-top-block-head"><span class="eva-top-block-icon">◌</span><div><p>ACCESS</p><h3>Authentication & onboarding</h3></div><span class="eva-top-block-arrow">›</span></div>
      <div class="eva-account-strip eva-access-strip">
        <a href="${loginHref}" data-menu-link="${loginHref}" data-label="login" data-group="access" data-page="login.html"${activeAttrs(loginHref)}><span>⇥</span><strong>Login</strong></a>
        <a href="${signupHref}" data-menu-link="${signupHref}" data-label="signup" data-group="access" data-page="signup.html"${activeAttrs(signupHref)}><span>＋</span><strong>Signup</strong></a>
        <a href="${applyHref}" data-menu-link="${applyHref}" data-label="apply" data-group="access" data-page="staff_application.html"${activeAttrs(applyHref)}><span>◐</span><strong>Apply</strong></a>
      </div>
    </section>`;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;
  const groups = getVisibleLinks();
  const role = normalizeRegistryRole(groups.role);
  mount.innerHTML = `
    <div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}">
      <header class="eva-nav-shell" id="evaNavShell"><div class="eva-nav-pill glass-shell" id="evaNavPill">
        <div class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" tabindex="0"><img src="${getBasePath()}/assets/img/evaraos_logo.png" alt="Evaraos logo" class="eva-logo" /><div class="eva-brand-copy"><strong>Evaraos Inc</strong><span>Subsidiaries Allocation SaaS</span></div></div>
        <div class="eva-menu-zone" id="evaMenuZone">
          <button class="eva-nav-action-btn eva-theme-nav-btn" type="button" id="evaThemeToggle" data-theme-label="true" aria-label="Toggle light or dark mode"><span class="eva-theme-nav-icon" aria-hidden="true">◐</span></button>
          <button class="eva-nav-action-btn eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open menu"><span class="eva-burger" aria-hidden="true"><span class="eva-burger-line"></span><span class="eva-burger-line"></span><span class="eva-burger-line"></span></span></button>
        </div>
      </div></header>
      <div class="eva-backdrop" id="evaBackdrop"></div>
      <div class="eva-menu-panel eva-control-center-panel" id="evaMenuPanel"><nav class="eva-menu-apps" id="evaLinks" data-nav-role="${clean(role)}">
        ${navigationSection()}
        ${groups.authed ? accountSection(true) : accessSection()}
        ${groups.authed ? `<p class="eva-section-label">OPERATIONS</p><div class="eva-control-row-stack">${registryRows(groups.role)}</div>` : ""}
      </nav>${aiPromptBox(groups.authed)}</div>
    </div>`;
  return true;
}
