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
    <button
      type="button"
      class="eva-quick-bubble beam-target ${tone ? `bubble-${tone}` : ""}"
      data-quick-link="${href}"
      aria-label="${label}"
      title="${label}"
    >
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

  const publicNavigation = groups.main.filter((item) =>
    ["index.html"].includes(item.page)
  );

  const accountAccess = groups.main.filter((item) =>
    ["login.html", "signup.html", "staff_application.html"].includes(item.page)
  );

  const executiveControl = groups.main.filter((item) =>
    !["index.html", "staff_application.html", "login.html", "signup.html", "reset.html"].includes(item.page)
  );

  const accountTools = groups.authed
    ? `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks">
        <div class="eva-section-head">
          <p>Session</p>
          <h3>Account Tools</h3>
        </div>

        <div class="eva-app-grid eva-account-grid">
          <button type="button" class="eva-link eva-app-tile eva-account-tile" id="evaLogoutBtn" data-label="logout" aria-label="Logout">
            <span class="eva-link-icon eva-app-icon">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M10 7V5.5A2.5 2.5 0 0 1 12.5 3h5A2.5 2.5 0 0 1 20 5.5v13A2.5 2.5 0 0 1 17.5 21h-5A2.5 2.5 0 0 1 10 18.5V17"/>
                <path d="M4 12h10"/>
                <path d="m7.5 8.5-3.5 3.5 3.5 3.5"/>
              </svg>
            </span>
            <span class="eva-link-label eva-app-label">Logout</span>
          </button>

          <button type="button" class="eva-link eva-app-tile eva-account-tile" id="evaThemeToggle" data-label="theme mode" aria-label="Toggle theme">
            <span class="eva-link-icon eva-app-icon">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 3v2"/>
                <path d="M12 19v2"/>
                <path d="M4.22 4.22l1.42 1.42"/>
                <path d="M18.36 18.36l1.42 1.42"/>
                <path d="M3 12h2"/>
                <path d="M19 12h2"/>
                <path d="M4.22 19.78l1.42-1.42"/>
                <path d="M18.36 5.64l1.42-1.42"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </span>
            <span class="eva-link-label eva-app-label" data-theme-label>Dark mode</span>
          </button>

        </div>

        <div class="eva-install-pill" id="evaInstallPill" hidden aria-label="Install Evaraos app">
          <button type="button" class="eva-install-segment eva-install-ios" id="evaInstallApple" aria-label="Install Evaraos on iPhone">
            <span class="eva-install-os-mark eva-install-apple-mark" aria-hidden="true"></span>
            <span class="eva-install-copy">
              <strong>iPhone</strong>
              <small>Tap Share</small>
            </span>
          </button>
          <button type="button" class="eva-install-segment eva-install-android" id="evaInstallAndroid" aria-label="Install Evaraos on Android">
            <span class="eva-install-os-mark eva-install-android-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false">
                <path fill="currentColor" d="M14.8 18.2h18.4c1.9 0 3.4 1.5 3.4 3.4v10.8c0 1.9-1.5 3.4-3.4 3.4H14.8c-1.9 0-3.4-1.5-3.4-3.4V21.6c0-1.9 1.5-3.4 3.4-3.4Z"/>
                <path fill="currentColor" d="M9 21.7c1 0 1.8.8 1.8 1.8v8.3c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-8.3c0-1 .8-1.8 1.8-1.8Zm30 0c1 0 1.8.8 1.8 1.8v8.3c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-8.3c0-1 .8-1.8 1.8-1.8ZM17 35.3c1 0 1.8.8 1.8 1.8v4.2c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-4.2c0-1 .8-1.8 1.8-1.8Zm14 0c1 0 1.8.8 1.8 1.8v4.2c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-4.2c0-1 .8-1.8 1.8-1.8Z"/>
                <path fill="currentColor" d="M14.1 16.5c.9-4.1 4.9-7.2 9.9-7.2s9 3.1 9.9 7.2H14.1Z"/>
                <path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M18 9.8 15.7 5.7M30 9.8l2.3-4.1"/>
                <circle cx="19.2" cy="13.7" r="1.15" fill="#fff"/>
                <circle cx="28.8" cy="13.7" r="1.15" fill="#fff"/>
              </svg>
            </span>
            <span class="eva-install-copy">
              <strong>Android</strong>
              <small>Install</small>
            </span>
          </button>
        </div>
      </section>
    `
    : `
      <section class="eva-menu-section eva-account-section" id="evaAuthLinks">
        <div class="eva-section-head">
          <p>Access</p>
          <h3>Account</h3>
        </div>
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

          <a
            href="${buildHref("index.html")}"
            class="eva-brand"
            id="evaBrandBlock"
            data-home-link="${buildHref("index.html")}"
            aria-label="Go to Home"
          >
            <img
              src="${getBasePath()}/assets/img/evaraos_logo.png"
              alt="Evaraos logo"
              class="eva-logo"
              onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
            />
            <div class="eva-brand-copy">
              <strong>Evaraos Inc</strong>
              <span>Subsidiaries Allocation SaaS</span>
            </div>
          </a>

          <div class="eva-menu-zone" id="evaMenuZone">
            <button
              class="eva-theme-nav-btn"
              type="button"
              id="evaThemePillToggle"
              aria-label="Toggle light and dark mode"
              title="Toggle theme"
            >
              <span class="eva-theme-nav-icon" aria-hidden="true"></span>
            </button>

            <button
              class="eva-menu-btn"
              type="button"
              id="evaMenuBtn"
              aria-expanded="false"
              aria-label="Open Control Center"
            >
              <span class="eva-burger">
                <span class="eva-burger-line top"></span>
                <span class="eva-burger-line mid"></span>
                <span class="eva-burger-line bot"></span>
              </span>
            </button>
          </div>
        </div>

        <div class="eva-quick-bubbles" id="evaQuickBubbles" aria-hidden="true">
          ${quickBubbles}
        </div>
      </header>

      <div class="eva-backdrop" id="evaBackdrop"></div>

      <div class="eva-menu-panel eva-control-center-panel" id="evaMenuPanel">
        <div class="eva-menu-titlebar">
          <div>
            <p>EVARAOS</p>
            <h2>${groups.authed ? "Executive Control" : "Control Center"}</h2>
          </div>
          <div class="eva-menu-actions">
            <span class="eva-menu-badge">${groups.authed ? groups.role : "Guest"}</span>
            <button type="button" class="eva-menu-close-btn" id="evaMenuCloseBtn" aria-label="Close Control Center">
              <span></span>
              <span></span>
            </button>
          </div>
        </div>

        <label class="eva-search">
          <span>🔎</span>
          <input type="text" id="evaSearchInput" placeholder="Search apps" />
        </label>

        <nav class="eva-links eva-menu-apps" id="evaLinks" aria-label="Main navigation">
          ${menuSection(groups.authed ? "Executive Control" : "Command Navigation", groups.authed ? "Operate" : "Launch", groups.authed ? executiveControl : [], "eva-exec-section")}
          ${menuSection("Navigation", "Explore", publicNavigation, "eva-nav-section")}
          ${!groups.authed ? "" : ""}
        </nav>

        ${accountTools}
      </div>
    </div>
  `;

  return true;
}
