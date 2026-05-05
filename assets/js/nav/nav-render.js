import {
  getMount,
  getBasePath,
  buildHref,
  getVisibleLinks
} from "./nav-utils.js";

import { iconSvg } from "./nav-icons.js";

const NAV_RENDER_BUILD = "nav-render-no-logout-20260504";

function appTile(page, label, icon) {
  const href = buildHref(page);
  const safeLabel = String(label || "").toLowerCase();

  return `
    <a
      href="${href}"
      class="eva-menu-app-launcher"
      data-menu-link="${href}"
      data-label="${safeLabel}"
      aria-label="${label}"
    >
      <span class="eva-menu-app-square">${iconSvg(icon)}</span>
      <span class="eva-menu-app-name">${label}</span>
    </a>
  `;
}

function menuSection(title, subtitle, items, className = "") {
  if (!items || !items.length) return "";

  return `
    <section class="eva-menu-section ${className}">
      <div class="eva-section-head">
        <p>${subtitle}</p>
        <h3>${title}</h3>
      </div>
      <div class="eva-app-grid">
        ${items.map((item) => appTile(item.page, item.label, item.icon)).join("")}
      </div>
    </section>
  `;
}

export function navLink(page, label, icon) {
  return appTile(page, label, icon);
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();

  const publicNavigation = groups.main.filter((item) => ["index.html"].includes(item.page));
  const accountAccess = groups.main.filter((item) => ["login.html", "signup.html", "staff_application.html"].includes(item.page));
  const executiveControl = groups.main.filter((item) => !["index.html", "staff_application.html", "login.html", "signup.html", "reset.html"].includes(item.page));

  const accountTools = groups.authed
    ? `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks" data-render-build="${NAV_RENDER_BUILD}">
        <div class="eva-section-head"><p>Session</p><h3>Account Tools</h3></div>
      </section>
    `
    : `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks" data-render-build="${NAV_RENDER_BUILD}">
        <div class="eva-section-head"><p>Access</p><h3>Account</h3></div>
        <div class="eva-app-grid">
          ${accountAccess.map((item) => appTile(item.page, item.label, item.icon)).join("")}
        </div>
      </section>
    `;

  mount.innerHTML = `
    <div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}">
      <header class="eva-nav-shell" id="evaNavShell">
        <div class="eva-nav-pill glass-shell" id="evaNavPill">
          <div class="eva-left-spacer" aria-hidden="true"></div>
          <div class="eva-right-spacer" aria-hidden="true"></div>
          <div class="eva-brand" id="evaBrandBlock" aria-label="Evaraos brand">
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
          <div><p>EVARAOS</p><h2>${groups.authed ? "Executive Control" : "Control Center"}</h2></div>
          <div class="eva-menu-actions"><span class="eva-menu-badge">${groups.authed ? groups.role : "Guest"}</span></div>
        </div>
        <nav class="eva-menu-apps" id="evaLinks" aria-label="Main navigation">
          ${menuSection(groups.authed ? "Executive Control" : "Command Navigation", groups.authed ? "Operate" : "Launch", groups.authed ? executiveControl : [], "eva-exec-section")}
          ${menuSection("Navigation", "Explore", publicNavigation, "eva-nav-section")}
        </nav>
        ${accountTools}
      </div>
    </div>
  `;

  return true;
}
