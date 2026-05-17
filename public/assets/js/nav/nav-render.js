import {
  getMount,
  getBasePath,
  buildHref,
  getVisibleLinks
} from "./nav-utils.js";

import { NAV_GROUP_ORDER } from "./nav-config.js";
import { iconSvg } from "./nav-icons.js";

const NAV_RENDER_BUILD = "nav-render-grouped-search-20260517";

function appTile(page, label, icon, options = {}) {
  const href = options.href || buildHref(page);
  const safeLabel = String(label || "").toLowerCase();
  const group = String(options.group || "").toLowerCase();
  const attrs = options.action
    ? `data-action="${options.action}" id="${options.id || ""}" role="button"`
    : `data-menu-link="${href}"`;

  return `
    <a
      href="${href}"
      class="eva-menu-app-launcher"
      ${attrs}
      data-label="${safeLabel}"
      data-group="${group}"
      data-page="${page}"
      aria-label="${label}"
    >
      <span class="eva-menu-app-square">${iconSvg(icon)}</span>
      <span class="eva-menu-app-name">${label}</span>
    </a>
  `;
}

function groupedSections(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const group = item.group || "Other";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(item);
  });

  return [...grouped.entries()].sort(([a], [b]) => {
    const ai = NAV_GROUP_ORDER.indexOf(a);
    const bi = NAV_GROUP_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function menuSection(title, subtitle, items, className = "") {
  if (!items || !items.length) return "";

  return `
    <section class="eva-menu-section ${className}" data-nav-section="${title}">
      <details class="eva-menu-folder" open>
        <summary class="eva-section-head eva-folder-summary">
          <span><p>${subtitle}</p><h3>${title}</h3></span>
          <span class="eva-folder-count">${items.length}</span>
        </summary>
        <div class="eva-app-grid">
          ${items.map((item) => appTile(item.page, item.label, item.icon, { group: item.group })).join("")}
        </div>
      </details>
    </section>
  `;
}

function searchBox() {
  return `
    <div class="eva-menu-search" role="search">
      <label class="sr-only" for="evaSearchInput">Search Evaraos pages</label>
      <input id="evaSearchInput" type="search" autocomplete="off" placeholder="Search pages, tools, finance, jobs..." />
      <div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div>
    </div>
  `;
}

export function navLink(page, label, icon) {
  return appTile(page, label, icon);
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();
  const accountAccess = groups.main.filter((item) => ["login.html", "signup.html", "reset.html", "staff_application.html"].includes(item.page));
  const publicNavigation = groups.main.filter((item) => ["index.html"].includes(item.page));
  const authedItems = groups.main.filter((item) => !["index.html", "staff_application.html", "login.html", "signup.html", "reset.html"].includes(item.page));
  const grouped = groupedSections(groups.authed ? authedItems : [...publicNavigation, ...accountAccess]);

  const accountTools = groups.authed
    ? `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks" data-render-build="${NAV_RENDER_BUILD}">
        <details class="eva-menu-folder" open>
          <summary class="eva-section-head eva-folder-summary"><span><p>Session</p><h3>Account Tools</h3></span><span class="eva-folder-count">1</span></summary>
          <div class="eva-app-grid eva-account-grid">
            ${appTile("login.html", "Logout", "logout", { href: "#logout", action: "logout", id: "evaLogoutBtn", group: "Account" })}
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
          <div class="eva-menu-actions"><span class="eva-menu-badge">${groups.authed ? groups.role : "Guest"}</span></div>
        </div>
        ${searchBox()}
        <nav class="eva-menu-apps" id="evaLinks" aria-label="Main navigation">
          ${grouped.map(([group, items]) => menuSection(group, group === "Core" ? "Start" : "Apps", items, `eva-${group.toLowerCase().replace(/\s+/g, "-")}-section`)).join("")}
        </nav>
        ${accountTools}
      </div>
    </div>
  `;

  return true;
}
