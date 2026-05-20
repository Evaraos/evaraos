import { getMount, getBasePath, buildHref, getVisibleLinks, isCurrentPage } from "./nav-utils.js";
import { APP_CATEGORIES, appsByCategory, normalizeRole } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "evaraos-clean-shell-20260520";

const CATEGORIES = [
  [APP_CATEGORIES.operations, "Operations", "Jobs, leads, dispatch", "operations"],
  [APP_CATEGORIES.organizations, "Organizations", "Companies, offices, vendors", "organizations"],
  [APP_CATEGORIES.finance, "Finance", "Billing, payouts, payroll", "finance"],
  [APP_CATEGORIES.customer, "Customer", "Portal, support, history", "customer"],
  [APP_CATEGORIES.intelligence, "Executive", "AI, analytics, command", "executive"],
  [APP_CATEGORIES.system, "System", "Admin, settings, QA", "system"]
];

const CATEGORY_FALLBACK_ROUTES = Object.freeze({
  [APP_CATEGORIES.operations]: "/jobs.html",
  [APP_CATEGORIES.organizations]: "/companies.html",
  [APP_CATEGORIES.finance]: "/revenue.html",
  [APP_CATEGORIES.customer]: "/customer_dashboard.html",
  [APP_CATEGORIES.intelligence]: "/dashboard.html",
  [APP_CATEGORIES.system]: "/settings.html"
});

const ICONS = Object.freeze({
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.2Z"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1-1h6v7H4V5Zm9-1h6a1 1 0 0 1 1 1v4h-7V4ZM4 13h7v7H5a1 1 0 0 1-1-1v-6Zm9-2h7v8a1 1 0 0 1-1 1h-6v-9Z"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 4 6.2v14L9 18l6 2 5-2.2v-14L15 6 9 4Zm1.2 2.7 3.6 1.2v9.4l-3.6-1.2V6.7Z"/></svg>',
  leads: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6V3Zm1 0v10h8A9 9 0 0 0 13 3Z"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l1 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3l1-3Zm2 3h4l-.4-1.2h-3.2L10 7Z"/></svg>',
  operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z"/></svg>',
  organizations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V5a1 1 0 0 1 1-1h9v17H4Zm12 0V9h3a1 1 0 0 1 1 1v11h-4ZM7 8h2v2H7V8Zm0 4h2v2H7v-2Zm0 4h2v2H7v-2Zm4-8h2v2h-2V8Zm0 4h2v2h-2v-2Z"/></svg>',
  finance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 3v2.1c1.5.2 2.7 1 3.3 2.2l-1.8.9c-.4-.8-1.2-1.2-2.2-1.2-1 0-1.7.4-1.7 1.1 0 .8.9 1 2.3 1.3 1.9.4 3.6 1 3.6 3 0 1.6-1.2 2.7-3.2 3V21h-2v-2.4c-1.9-.3-3.2-1.2-3.9-2.7l1.9-.9c.5 1 1.5 1.6 2.8 1.6 1.2 0 2-.4 2-1.2 0-.7-.8-1-2.4-1.3-1.8-.4-3.5-1-3.5-3 0-1.5 1.1-2.6 3-2.9V6h1.8Z"/></svg>',
  customer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 9a8 8 0 0 1 16 0H4Z"/></svg>',
  executive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9L12 2Zm6 12 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 14Z"/></svg>',
  system: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>',
  login: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17v-3H3v-4h7V7l5 5-5 5Zm5 4h5a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-5v2h4v14h-4v2Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 7V4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9v-3H7V7h7Zm3 10v-3h-7v-4h7V7l5 5-5 5Z"/></svg>',
  apply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm8 1.5V7h2.5L14 4.5ZM8 10h8v2H8v-2Zm0 4h8v2H8v-2Z"/></svg>'
});

function esc(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function active(route = "") {
  return isCurrentPage(route) ? ' data-active="true" aria-current="page"' : "";
}

function currentPageName() {
  const page = (window.location.pathname || "/").split("/").filter(Boolean).pop() || "index.html";
  return page.replace(".html", "").replaceAll("_", "-").replaceAll(" ", "-").toLowerCase();
}

function firstAvailableRoute(category, apps = []) {
  const fallback = CATEGORY_FALLBACK_ROUTES[category] || "";
  return apps.find((app) => app.route === fallback)?.route || apps[0]?.route || fallback || "/dashboard.html";
}

function activeCategory(groups = {}) {
  for (const [category] of CATEGORIES) {
    if ((groups[category] || []).some((app) => isCurrentPage(app.route))) return category;
  }
  if (isCurrentPage("settings.html")) return APP_CATEGORIES.system;
  if (isCurrentPage("customer_dashboard.html")) return APP_CATEGORIES.customer;
  if (isCurrentPage("dashboard.html")) return APP_CATEGORIES.intelligence;
  if (isCurrentPage("companies.html") || isCurrentPage("users.html") || isCurrentPage("applications.html") || isCurrentPage("org.html")) return APP_CATEGORIES.organizations;
  if (isCurrentPage("jobs.html") || isCurrentPage("leads.html") || isCurrentPage("operations_map.html")) return APP_CATEGORIES.operations;
  return "home";
}

function activeTitle(groups = {}) {
  for (const apps of Object.values(groups)) {
    const hit = (apps || []).find((app) => isCurrentPage(app.route));
    if (hit?.title) return hit.title;
  }
  const fallback = currentPageName().replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return fallback || "Home";
}

function linkCard(route, icon, title, subtitle, label = title) {
  return `<a class="eva-nav-card" href="${route}" data-menu-link="${route}" data-label="${esc(label)}"${active(route)}><span class="eva-svg-icon">${icon}</span><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></a>`;
}

function groupRow(category, title, subtitle, iconKey, apps = []) {
  if (!apps.length) return "";
  const route = firstAvailableRoute(category, apps);
  const isActive = apps.some((app) => isCurrentPage(app.route));
  const data = esc(JSON.stringify(apps.map((app) => ({ title: app.title, route: app.route, category: app.category, id: app.id }))));
  return `<a class="eva-group-row eva-folder-${esc(category)}" href="${esc(route)}" data-menu-link="${esc(route)}" data-nav-group="${esc(category)}" data-group-apps='${data}'${isActive ? ' data-active="true" aria-current="page"' : ""}>
    <span class="eva-group-icon eva-svg-icon">${ICONS[iconKey] || ICONS.dashboard}</span>
    <span class="eva-group-copy"><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span>
    <span class="eva-group-count">${apps.length}</span>
    <span class="eva-group-arrow">›</span>
  </a>`;
}

function quickNavigation() {
  return `<section class="eva-menu-section">
    <div class="eva-section-head"><span class="eva-svg-icon">${ICONS.dashboard}</span><div><p>Navigation</p><h3>Move through Evaraos</h3></div></div>
    <div class="eva-card-grid">
      ${linkCard(buildHref("index.html"), ICONS.home, "Home", "Start")}
      ${linkCard(buildHref("dashboard.html"), ICONS.dashboard, "Dashboard", "Command")}
      ${linkCard(buildHref("operations_map.html"), ICONS.map, "Map", "Live ops")}
      ${linkCard(buildHref("leads.html"), ICONS.leads, "Leads", "Pipeline")}
      ${linkCard(buildHref("jobs.html"), ICONS.jobs, "Jobs", "Work")}
    </div>
  </section>`;
}

function accountTools(authed) {
  if (!authed) {
    return `<section class="eva-menu-section">
      <div class="eva-section-head"><span class="eva-svg-icon">${ICONS.login}</span><div><p>Access</p><h3>Sign in or apply</h3></div></div>
      <div class="eva-card-grid eva-card-grid-three">
        ${linkCard(buildHref("login.html"), ICONS.login, "Login", "Access")}
        ${linkCard(buildHref("signup.html"), ICONS.customer, "Signup", "Create")}
        ${linkCard(buildHref("staff_application.html"), ICONS.apply, "Apply", "Staff")}
      </div>
    </section>`;
  }

  return `<section class="eva-menu-section">
    <div class="eva-section-head"><span class="eva-svg-icon">${ICONS.customer}</span><div><p>Account</p><h3>Profile, alerts, security</h3></div></div>
    <div class="eva-card-grid">
      ${linkCard(buildHref("settings.html"), ICONS.customer, "Profile", "Account")}
      ${linkCard(buildHref("settings.html"), ICONS.system, "Settings", "System")}
      ${linkCard(buildHref("notifications.html"), ICONS.dashboard, "Alerts", "Inbox")}
      ${linkCard(buildHref("settings.html"), ICONS.system, "Security", "Access")}
      <a class="eva-nav-card" href="#logout" id="evaLogoutBtn" data-action="logout"><span class="eva-svg-icon">${ICONS.logout}</span><strong>Logout</strong><small>Exit</small></a>
    </div>
  </section>`;
}

function operationGroups(role) {
  const groups = appsByCategory(normalizeRole(role));
  const rows = CATEGORIES.map(([category, title, subtitle, iconKey]) => groupRow(category, title, subtitle, iconKey, groups[category] || [])).join("");
  if (!rows) return { html: "", groups };
  return { html: `<section class="eva-menu-section eva-groups-section"><p class="eva-section-label">Operating System</p><div class="eva-group-stack">${rows}</div></section>`, groups };
}

function aiBox(authed) {
  return `<section class="eva-menu-section eva-ai-section">
    <div class="eva-section-head"><span class="eva-svg-icon">${ICONS.executive}</span><div><p>Evaraos AI</p><h3>Command your workspace</h3></div></div>
    <form class="eva-ai-form" id="evaAiPromptForm" autocomplete="off">
      <span class="eva-ai-spark eva-svg-icon">${ICONS.executive}</span>
      <input id="evaSearchInput" name="evaSearchInput" type="search" autocomplete="off" enterkeyhint="send" inputmode="search" placeholder="${authed ? "Ask Evaraos or open an app..." : "Ask about Evaraos..."}" />
      <button class="eva-ai-send-btn" id="evaAiSendBtn" type="submit" aria-label="Send">Ask</button>
    </form>
    <div id="evaSearchResults" class="eva-ai-results" aria-live="polite"></div>
    <p class="eva-ai-helper">Try “open jobs”, “show leads”, or “go to settings”.</p>
  </section>`;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const session = getVisibleLinks();
  const role = normalizeRole(session.role);
  const logo = `${getBasePath()}/assets/img/evaraos_logo.png`;
  const operating = session.authed ? operationGroups(role) : { html: "", groups: {} };
  const category = activeCategory(operating.groups);
  const pageTitle = activeTitle(operating.groups);

  document.documentElement.dataset.evaActivePage = currentPageName();
  document.documentElement.dataset.evaActiveCategory = category;

  mount.innerHTML = `<div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}" data-active-category="${esc(category)}" data-active-page="${esc(currentPageName())}">
    <header class="eva-nav-shell" id="evaNavShell">
      <div class="eva-nav-pill" id="evaNavPill" data-active-category="${esc(category)}">
        <button class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" type="button">
          <img src="${logo}" alt="Evaraos" class="eva-logo" />
          <span class="eva-brand-copy"><strong>Evaraos Inc</strong><small>${esc(pageTitle)} • ${esc(category === "home" ? "Home" : category)}</small></span>
        </button>
        <div class="eva-menu-zone" id="evaMenuZone">
          <button class="eva-nav-action-btn eva-theme-nav-btn" type="button" id="evaThemeToggle" data-theme-label="true" aria-label="Toggle theme"><span class="eva-theme-nav-icon">◐</span></button>
          <button class="eva-nav-action-btn eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open menu"><span class="eva-burger"><i></i><i></i><i></i></span></button>
        </div>
      </div>
    </header>
    <button class="eva-backdrop" id="evaBackdrop" type="button" aria-label="Close menu"></button>
    <aside class="eva-menu-panel" id="evaMenuPanel" aria-label="Evaraos menu">
      <nav class="eva-menu-content" id="evaLinks" data-nav-role="${esc(role)}">
        ${quickNavigation()}
        ${accountTools(session.authed)}
        ${operating.html}
        ${aiBox(session.authed)}
      </nav>
    </aside>
  </div>`;

  return true;
}
