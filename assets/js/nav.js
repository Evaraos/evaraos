import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function getThemeControlMarkup() {
  return `
    <div class="menu-theme-block" data-theme-control>
      <button
        type="button"
        class="theme-core-toggle aurora-card"
        data-theme-core-toggle
        aria-label="Toggle light and dark mode"
        title="Tap to switch light and dark"
      >
        <span class="theme-core-dot"></span>
        <span class="theme-core-label" data-theme-mode-text>Dark</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-group" data-theme-group-text>Neutral</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-hint" data-theme-hint-text>tap</span>
      </button>

      <div class="theme-bubbles" data-theme-bubbles>
        <button type="button" class="theme-bubble light aurora-card" data-theme-bubble data-theme-group="neutral" aria-label="Neutral theme"></button>
        <button type="button" class="theme-bubble blue aurora-card" data-theme-bubble data-theme-group="blue" aria-label="Blue theme"></button>
        <button type="button" class="theme-bubble red aurora-card" data-theme-bubble data-theme-group="red" aria-label="Red theme"></button>
        <button type="button" class="theme-bubble pink aurora-card" data-theme-bubble data-theme-group="pink" aria-label="Pink theme"></button>
        <button type="button" class="theme-bubble green aurora-card" data-theme-bubble data-theme-group="green" aria-label="Green theme"></button>
        <button type="button" class="theme-bubble purple aurora-card" data-theme-bubble data-theme-group="purple" aria-label="Purple theme"></button>
        <button type="button" class="theme-bubble yellow aurora-card" data-theme-bubble data-theme-group="yellow" aria-label="Yellow theme"></button>
      </div>
    </div>
  `;
}

function getLandingNavMarkup() {
  return `
    <header class="landing-header universal-nav-shell">
      <div class="landing-header-inner glass-shell aurora-card">
        <a href="/evaraos/index.html" class="brand-link" aria-label="Go home">
          <img
            src="/evaraos/assets/img/evaraos_logo.png"
            alt="Evaraos logo"
            class="brand-logo"
          />
          <div class="brand-copy">
            <strong>Evaraos Inc</strong>
            <span>Subsidiaries Allocation SaaS</span>
          </div>
        </a>

        <nav class="landing-nav" aria-label="Main navigation">
          <div class="nav-dropdown" data-nav-dropdown>
            <button
              class="nav-hamburger aurora-card"
              type="button"
              data-nav-toggle
              aria-label="Open menu"
              aria-expanded="false"
            >
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
            </button>

            <div class="nav-dropdown-menu glass-popover aurora-card" data-nav-menu>
              <a href="/evaraos/index.html" class="menu-link" data-nav-link>Home</a>
              <a href="/evaraos/login.html" class="menu-link" data-nav-link>Login</a>
              <a href="/evaraos/signup.html" class="menu-link" data-nav-link>Sign Up</a>
              <a href="/evaraos/dashboard.html" class="menu-link" data-nav-link>Dashboard</a>
              <a href="/evaraos/companies.html" class="menu-link" data-nav-link>Companies</a>
              <a href="/evaraos/users.html" class="menu-link" data-nav-link>Users</a>
              <a href="/evaraos/leads.html" class="menu-link" data-nav-link>Leads</a>
              <a href="/evaraos/jobs.html" class="menu-link" data-nav-link>Jobs</a>
              <a href="/evaraos/qa.html" class="menu-link" data-nav-link>QA</a>

              <div class="menu-divider"></div>

              ${getThemeControlMarkup()}
            </div>
          </div>
        </nav>
      </div>
    </header>
  `;
}

function getDashboardNavMarkup() {
  return `
    <header class="dashboard-topbar universal-nav-shell">
      <div class="dashboard-topbar-inner glass-shell aurora-card">
        <div class="dashboard-topbar-left">
          <button
            type="button"
            class="nav-hamburger dashboard-sidebar-toggle"
            id="dashboardSidebarToggle"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="dashboardSidebar"
          >
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>

          <a href="/evaraos/index.html" class="brand-link dashboard-brand" aria-label="Go home">
            <img
              src="/evaraos/assets/img/evaraos_logo.png"
              alt="Evaraos logo"
              class="brand-logo"
            />
            <div class="brand-copy">
              <strong>Evaraos Inc</strong>
              <span id="dashboardBrandSubline">Executive Control Center</span>
            </div>
          </a>
        </div>

        <div class="dashboard-topbar-right">
          <div class="nav-dropdown dashboard-profile-menu" data-nav-dropdown>
            <button
              class="dashboard-avatar-btn aurora-card"
              type="button"
              data-nav-toggle
              aria-label="Open profile menu"
              aria-expanded="false"
            >
              <span class="dashboard-avatar" id="dashboardAvatar">G</span>
            </button>

            <div class="nav-dropdown-menu glass-popover aurora-card dashboard-profile-dropdown" data-nav-menu>
              <div class="dashboard-profile-card">
                <div class="dashboard-profile-main">
                  <span class="dashboard-avatar dashboard-avatar-large" id="dashboardAvatarLarge">G</span>
                  <div>
                    <strong id="dashboardProfileName">Owner Account</strong>
                    <span id="dashboardProfileRole">Executive Access</span>
                  </div>
                </div>
              </div>

              <div class="menu-divider"></div>

              <a href="/evaraos/profile.html" class="menu-link" data-nav-link>Edit Profile</a>
              <a href="/evaraos/settings.html" class="menu-link" data-nav-link>Settings</a>
              <a href="/evaraos/security.html" class="menu-link" data-nav-link>Account Security</a>
              <button type="button" id="logoutBtn" class="menu-link dashboard-menu-button">Logout</button>

              <div class="menu-divider"></div>

              ${getThemeControlMarkup()}
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function getUniversalNavbarMarkup() {
  const isDashboard = document.body.classList.contains("dashboard-body");
  return isDashboard ? getDashboardNavMarkup() : getLandingNavMarkup();
}

function injectUniversalNavbar() {
  const mount = document.getElementById("universalNav");
  if (!mount || mount.dataset.rendered === "true") return false;

  mount.dataset.rendered = "true";
  mount.innerHTML = getUniversalNavbarMarkup();
  return true;
}

function closeAllNavDropdowns(except = null) {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    if (except && dropdown === except) return;
    dropdown.classList.remove("open");

    const toggle = dropdown.querySelector("[data-nav-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
}

function toggleNavDropdown(dropdown) {
  if (!dropdown) return;

  const isOpen = dropdown.classList.contains("open");
  const toggle = dropdown.querySelector("[data-nav-toggle]");

  closeAllNavDropdowns(dropdown);

  if (!isOpen) {
    dropdown.classList.add("open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");

    if (window.EvaraTheme?.syncThemeControls) {
      window.EvaraTheme.syncThemeControls(window.EvaraTheme.getStoredTheme());
    }
  } else {
    dropdown.classList.remove("open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
}

function markActiveLinks() {
  const currentPath = window.location.pathname;

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const normalizedHref = new URL(href, window.location.origin).pathname;

    const isActive =
      currentPath === normalizedHref ||
      (currentPath.endsWith("/") && normalizedHref.endsWith("/index.html")) ||
      (currentPath.endsWith("/index.html") && normalizedHref.endsWith("/index.html"));

    link.classList.toggle("active", isActive);
  });
}

function bindNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    if (dropdown.dataset.navBound === "true") return;
    dropdown.dataset.navBound = "true";

    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleNavDropdown(dropdown);
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    menu.querySelectorAll("a").forEach((item) => {
      item.addEventListener("click", () => {
        closeAllNavDropdowns();
      });
    });
  });
}

function bindGlobalNavClose() {
  if (document.body.dataset.globalNavCloseBound === "true") return;
  document.body.dataset.globalNavCloseBound = "true";

  document.addEventListener("click", () => {
    closeAllNavDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllNavDropdowns();

      const sidebar = document.getElementById("dashboardSidebar");
      const sidebarToggle = document.getElementById("dashboardSidebarToggle");

      if (sidebar) sidebar.classList.remove("open");
      if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function bindDashboardSidebar() {
  const sidebar = document.getElementById("dashboardSidebar");
  const sidebarToggle = document.getElementById("dashboardSidebarToggle");

  if (!sidebar || !sidebarToggle || sidebar.dataset.sidebarBound === "true") return;
  sidebar.dataset.sidebarBound = "true";

  sidebarToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const isOpen = sidebar.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    sidebarToggle.classList.add("active-glow");
    setTimeout(() => sidebarToggle.classList.remove("active-glow"), 220);
  });

  document.addEventListener("click", (event) => {
    const clickedInsideSidebar = sidebar.contains(event.target);
    const clickedToggle = sidebarToggle.contains(event.target);

    if (!clickedInsideSidebar && !clickedToggle && window.innerWidth <= 980) {
      sidebar.classList.remove("open");
      sidebarToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function syncThemeAfterNavRender() {
  if (window.EvaraTheme?.bindAllThemeControls) {
    window.EvaraTheme.bindAllThemeControls();
  }

  if (window.EvaraTheme?.syncThemeControls) {
    window.EvaraTheme.syncThemeControls(window.EvaraTheme.getStoredTheme());
  }
}

function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn || logoutBtn.dataset.bound === "true") return;

  logoutBtn.dataset.bound = "true";
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "/evaraos/login.html";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
}

function getRoleLabel(email = "") {
  const value = String(email || "").toLowerCase();

  if (value.includes("admin")) return "Admin Access";
  if (value.includes("manager")) return "Manager Access";
  if (value.includes("sales")) return "Sales Access";
  if (value.includes("tech")) return "Technician Access";
  if (value.includes("customer")) return "Customer Access";

  return "Executive Access";
}

function syncAuthUi() {
  onAuthStateChanged(auth, (user) => {
    const avatar = document.getElementById("dashboardAvatar");
    const avatarLarge = document.getElementById("dashboardAvatarLarge");
    const profileName = document.getElementById("dashboardProfileName");
    const profileRole = document.getElementById("dashboardProfileRole");

    if (!user) return;

    const displayName = user.displayName || user.email || "Owner Account";
    const initial = displayName.trim().charAt(0).toUpperCase() || "U";
    const role = getRoleLabel(user.email || "");

    if (avatar) avatar.textContent = initial;
    if (avatarLarge) avatarLarge.textContent = initial;
    if (profileName) profileName.textContent = displayName;
    if (profileRole) profileRole.textContent = role;

    bindLogout();
  });
}

function initNav() {
  injectUniversalNavbar();
  bindNavDropdowns();
  bindGlobalNavClose();
  bindDashboardSidebar();
  markActiveLinks();
  syncThemeAfterNavRender();
  syncAuthUi();
  bindLogout();
}

window.closeAllNavDropdowns = closeAllNavDropdowns;
window.initNav = initNav;

document.addEventListener("DOMContentLoaded", initNav);