import {
  getMount,
  getBasePath,
  buildHref,
  isCurrentPage,
  getVisibleLinks
} from "./nav-utils.js";

import { iconSvg } from "./nav-icons.js";

export function navLink(page, label, icon) {
  const href = buildHref(page);
  const active = isCurrentPage(page) ? " active" : "";

  return `
    <a href="${href}" class="eva-link${active}" data-menu-link="${href}" data-label="${label.toLowerCase()}">
      <span class="eva-link-icon">${iconSvg(icon)}</span>
      <span class="eva-link-label">${label}</span>
    </a>
  `;
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
  const mainLinks = groups.main.map((item) => navLink(item.page, item.label, item.icon)).join("");
  const quickBubbles = groups.quick.map((item) => bubbleLink(item.page, item.label, item.icon, item.bubble)).join("");

  const utilityLinks = groups.authed
    ? `
      <button type="button" class="eva-chip" id="evaLogoutBtn">
        <span class="eva-chip-row">
          <span class="eva-chip-dot"></span>
          <span>Logout</span>
        </span>
      </button>
    `
    : "";

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
              class="eva-menu-btn"
              type="button"
              id="evaMenuBtn"
              aria-expanded="false"
              aria-label="Open menu"
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

      <div class="eva-menu-panel" id="evaMenuPanel">
        <label class="eva-search">
          <span>🔎</span>
          <input type="text" id="evaSearchInput" placeholder="Search pages" />
        </label>

        <nav class="eva-links" id="evaLinks" aria-label="Main navigation">
          ${mainLinks}
        </nav>

        <div class="eva-divider"></div>

        <div class="eva-quick" id="evaAuthLinks">
          ${utilityLinks}
        </div>

        <div class="eva-divider"></div>

        <div class="eva-quick eva-utility-row">
          <div class="eva-install-pill" id="evaInstallPill" hidden aria-label="Install Evaraos app">
            <button type="button" class="eva-install-segment eva-install-ios" id="evaInstallApple" aria-label="Install Evaraos on iPhone">
              <span class="eva-install-brand" aria-hidden="true">iOS</span>
              <span class="eva-install-text">iPhone</span>
            </button>
            <button type="button" class="eva-install-segment eva-install-android" id="evaInstallAndroid" aria-label="Install Evaraos on Android">
              <span class="eva-install-brand eva-android-mark" aria-hidden="true">A</span>
              <span class="eva-install-text">Android</span>
            </button>
          </div>

          <button type="button" class="eva-chip" id="evaThemeToggle">
            <span class="eva-chip-row">
              <span class="eva-chip-dot"></span>
              <span data-theme-label>Dark mode</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  `;

  return true;
}
