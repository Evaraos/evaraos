import { getMount, getBasePath, buildHref, getVisibleLinks, isCurrentPage } from "./nav-utils.js";
import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "evaraos-clean-nav-20260519";

const CATEGORIES = [
  [APP_CATEGORIES.operations, "Operations", "Jobs, leads, dispatch", "▣"],
  [APP_CATEGORIES.organizations, "Organizations", "Companies, offices, vendors", "▥"],
  [APP_CATEGORIES.finance, "Finance", "Billing, payouts, payroll", "$"],
  [APP_CATEGORIES.customer, "Customer", "Portal, support, history", "♙"],
  [APP_CATEGORIES.intelligence, "Executive", "AI, analytics, command", "✦"],
  [APP_CATEGORIES.system, "System", "Admin, settings, QA", "⚙"]
];

function esc(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function roleForRegistry(role = "customer") {
  const value = String(role || "customer").toLowerCase();
  if (["owner", "super_admin"].includes(value)) return "owner";
  if (["admin", "manager", "operations_manager"].includes(value)) return "admin";
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(value)) return "organization";
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(value)) return "vendor";
  if (["hr", "hr_manager"].includes(value)) return "hr";
  if (["staff", "sales", "sales_rep", "technician", "cleaner", "field_staff", "crew_lead"].includes(value)) return "staff";
  return "customer";
}

function active(route = "") {
  return isCurrentPage(route) ? ' data-active="true" aria-current="page"' : "";
}

function linkCard(route, icon, title, subtitle, label = title) {
  return `<a class="eva-nav-card" href="${route}" data-menu-link="${route}" data-label="${esc(label)}"${active(route)}><span>${icon}</span><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></a>`;
}

function groupRow(category, title, subtitle, icon, apps = []) {
  if (!apps.length) return "";
  const isActive = apps.some((app) => isCurrentPage(app.route));
  const data = esc(JSON.stringify(apps.map((app) => ({ title: app.title, route: app.route, category: app.category, id: app.id }))));
  return `<button class="eva-group-row eva-folder-${esc(category)}" type="button" data-nav-group="${esc(category)}" data-group-apps='${data}'${isActive ? ' data-active="true" aria-current="page"' : ""}>
    <span class="eva-group-icon">${icon}</span>
    <span class="eva-group-copy"><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span>
    <span class="eva-group-count">${apps.length}</span>
    <span class="eva-group-arrow">›</span>
  </button>`;
}

function quickNavigation() {
  return `<section class="eva-menu-section">
    <div class="eva-section-head"><span>↗</span><div><p>Navigation</p><h3>Move through Evaraos</h3></div></div>
    <div class="eva-card-grid">
      ${linkCard(buildHref("index.html"), "⌂", "Home", "Start")}
      ${linkCard(buildHref("dashboard.html"), "▦", "Dashboard", "Command")}
      ${linkCard(buildHref("operations_map.html"), "◉", "Map", "Live ops")}
      ${linkCard(buildHref("leads.html"), "◎", "Leads", "Pipeline")}
      ${linkCard(buildHref("jobs.html"), "▣", "Jobs", "Work")}
    </div>
  </section>`;
}

function accountTools(authed) {
  if (!authed) {
    return `<section class="eva-menu-section">
      <div class="eva-section-head"><span>◌</span><div><p>Access</p><h3>Sign in or apply</h3></div></div>
      <div class="eva-card-grid eva-card-grid-three">
        ${linkCard(buildHref("login.html"), "⇥", "Login", "Access")}
        ${linkCard(buildHref("signup.html"), "+", "Signup", "Create")}
        ${linkCard(buildHref("staff_application.html"), "◐", "Apply", "Staff")}
      </div>
    </section>`;
  }

  return `<section class="eva-menu-section">
    <div class="eva-section-head"><span>♙</span><div><p>Account</p><h3>Profile, alerts, security</h3></div></div>
    <div class="eva-card-grid">
      ${linkCard(buildHref("settings.html"), "♙", "Profile", "Account")}
      ${linkCard(buildHref("settings.html"), "⚙", "Settings", "System")}
      ${linkCard(buildHref("notifications.html"), "♧", "Alerts", "Inbox")}
      ${linkCard(buildHref("settings.html"), "♢", "Security", "Access")}
      <a class="eva-nav-card" href="#logout" id="evaLogoutBtn" data-action="logout"><span>⇥</span><strong>Logout</strong><small>Exit</small></a>
    </div>
  </section>`;
}

function operationGroups(role) {
  const groups = appsByCategory(roleForRegistry(role));
  const rows = CATEGORIES.map(([category, title, subtitle, icon]) => groupRow(category, title, subtitle, icon, groups[category] || [])).join("");
  if (!rows) return "";
  return `<section class="eva-menu-section eva-groups-section"><p class="eva-section-label">Operating System</p><div class="eva-group-stack">${rows}</div></section>`;
}

function aiBox(authed) {
  return `<section class="eva-menu-section eva-ai-section">
    <div class="eva-section-head"><span>AI</span><div><p>Evaraos AI</p><h3>Ask, search, or open tools</h3></div></div>
    <form class="eva-ai-form" id="evaAiPromptForm" autocomplete="off">
      <span class="eva-ai-spark">✦</span>
      <input id="evaSearchInput" name="evaSearchInput" type="search" autocomplete="off" enterkeyhint="send" inputmode="search" placeholder="${authed ? "Ask Evaraos AI..." : "Ask about Evaraos..."}" />
      <button class="eva-ai-icon-btn" id="evaAiMicBtn" type="button" aria-label="Speak">🎙</button>
      <button class="eva-ai-send-btn" id="evaAiSendBtn" type="submit" aria-label="Send">➜</button>
    </form>
    <div id="evaSearchResults" class="eva-ai-results" aria-live="polite"></div>
    <p class="eva-ai-helper">Try “open jobs”, “show leads”, or “go to settings”.</p>
  </section>`;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const session = getVisibleLinks();
  const role = roleForRegistry(session.role);
  const logo = `${getBasePath()}/assets/img/evaraos_logo.png`;

  mount.innerHTML = `<div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}">
    <header class="eva-nav-shell" id="evaNavShell">
      <div class="eva-nav-pill" id="evaNavPill">
        <button class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" type="button">
          <img src="${logo}" alt="Evaraos" class="eva-logo" />
          <span class="eva-brand-copy"><strong>Evaraos Inc</strong><small>Subsidiaries Allocation SaaS</small></span>
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
        ${session.authed ? operationGroups(session.role) : ""}
        ${aiBox(session.authed)}
      </nav>
    </aside>
  </div>`;

  return true;
}
