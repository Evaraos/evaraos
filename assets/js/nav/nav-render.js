import {
  getMount,
  getBasePath,
  buildHref,
  isCurrentPage,
  getVisibleLinks
} from "./nav-utils.js";

import { iconSvg } from "./nav-icons.js";

function appTile(page, label, icon, tone = "") {
  const href = buildHref(page);
  const active = isCurrentPage(page) ? " active" : "";
  const safeLabel = String(label || "").toLowerCase();

  return `
    <a
      href="${href}"
      class="eva-link eva-app-tile${active} ${tone ? `tile-${tone}` : ""}"
      data-menu-link="${href}"
      data-label="${safeLabel}"
      aria-label="${label}"
    >
      <span class="eva-link-icon eva-app-icon">${iconSvg(icon)}</span>
      <span class="eva-link-label eva-app-label">${label}</span>
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
        ${items.map((item) => appTile(item.page, item.label, item.icon, item.bubble || "")).join("")}
      </div>
    </section>
  `;
}

export function navLink(page, label, icon) {
  return appTile(page, label, icon);
}

export function bubbleLink(page, label, icon, tone = "") {
  const href = buildHref(page);

  return `
    <button type="button" class="eva-quick-bubble beam-target ${tone ? `bubble-${tone}` : ""}" data-quick-link="${href}" aria-label="${label}" title="${label}">
      <span class="eva-quick-bubble-orbit"></span>
      <span class="eva-quick-bubble-core"></span>
      <span class="eva-quick-bubble-icon">${iconSvg(icon)}</span>
      <span class="eva-quick-bubble-label">${label}</span>
    </button>
  `;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();
  const quickBubbles = groups.quick.map((item) => bubbleLink(item.page, item.label, item.icon, item.bubble)).join("");

  const publicNavigation = groups.main.filter((item) => ["index.html"].includes(item.page));
  const accountAccess = groups.main.filter((item) => ["login.html", "signup.html", "staff_application.html"].includes(item.page));
  const executiveControl = groups.main.filter((item) => !["index.html", "staff_application.html", "login.html", "signup.html", "reset.html"].includes(item.page));

  const accountTools = groups.authed
    ? `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks">
        <div class="eva-section-head"><p>Session</p><h3>Account Tools</h3></div>
        <div class="eva-app-grid eva-account-grid">
          <button type="button" class="eva-link eva-app-tile eva-account-tile" id="evaLogoutBtn" data-label="logout" aria-label="Logout">
            <span class="eva-link-icon eva-app-icon">${iconSvg("logout")}</span>
            <span class="eva-link-label eva-app-label">Logout</span>
          </button>
          <button type="button" class="eva-link eva-app-tile eva-account-tile" id="evaThemeToggle" data-label="theme mode" aria-label="Toggle theme">
            <span class="eva-link-icon eva-app-icon">${iconSvg("theme")}</span>
            <span class="eva-link-label eva-app-label" data-theme-label>Dark mode</span>
          </button>
        </div>
      </section>
    `
    : `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks">
        <div class="eva-section-head"><p>Access</p><h3>Account</h3></div>
        <div class="eva-app-grid">
          ${accountAccess.map((item) => appTile(item.page, item.label, item.icon, item.bubble || "")).join("")}
        </div>
      </section>
    `;

  mount.innerHTML = `
    <div class="eva-nav-layer">
      <header class="eva-nav-shell" id="evaNavShell">
        <div class="eva-nav-pill glass-shell" id="evaNavPill">
          <div class="eva-left-spacer" aria-hidden="true"></div>
          <div class="eva-right-spacer" aria-hidden="true"></div>
          <a href="${buildHref("index.html")}" class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" aria-label="Go to Home">
            <img src="${getBasePath()}/assets/img/evaraos_logo.png" alt="Evaraos logo" class="eva-logo" onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';" />
            <div class="eva-brand-copy"><strong>Evaraos Inc</strong><span>Subsidiaries Allocation SaaS</span></div>
          </a>
          <div class="eva-menu-zone" id="evaMenuZone">
            <button class="eva-theme-nav-btn" type="button" id="evaThemePillToggle" aria-label="Toggle light and dark mode" title="Toggle theme">
              <span class="eva-theme-nav-icon" aria-hidden="true"></span>
            </button>
            <button class="eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open Control Center">
              <span class="eva-burger"><span class="eva-burger-line top"></span><span class="eva-burger-line mid"></span><span class="eva-burger-line bot"></span></span>
            </button>
          </div>
        </div>
        <div class="eva-quick-bubbles" id="evaQuickBubbles" aria-hidden="true">${quickBubbles}</div>
      </header>
      <div class="eva-backdrop" id="evaBackdrop"></div>
      <div class="eva-menu-panel eva-control-center-panel" id="evaMenuPanel">
        <div class="eva-menu-titlebar">
          <div><p>EVARAOS</p><h2>${groups.authed ? "Executive Control" : "Control Center"}</h2></div>
          <div class="eva-menu-actions"><span class="eva-menu-badge">${groups.authed ? groups.role : "Guest"}</span></div>
        </div>
        <nav class="eva-links eva-menu-apps" id="evaLinks" aria-label="Main navigation">
          ${menuSection(groups.authed ? "Executive Control" : "Command Navigation", groups.authed ? "Operate" : "Launch", groups.authed ? executiveControl : [], "eva-exec-section")}
          ${menuSection("Navigation", "Explore", publicNavigation, "eva-nav-section")}
        </nav>
        ${accountTools}
      </div>
    </div>
  `;

  return true;
}
