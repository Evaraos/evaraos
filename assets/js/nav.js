function getUniversalNavbarMarkup() {
  const isDashboard = document.body.classList.contains("dashboard-body");

  if (isDashboard) {
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

                <div class="menu-theme-block" data-theme-control>
                  <button
                    type="button"
                    class="theme-core-toggle"
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
                    <button type="button" class="theme-bubble light" data-theme-bubble data-theme-group="neutral" aria-label="Neutral theme"></button>
                    <button type="button" class="theme-bubble blue" data-theme-bubble data-theme-group="blue" aria-label="Blue theme"></button>
                    <button type="button" class="theme-bubble red" data-theme-bubble data-theme-group="red" aria-label="Red theme"></button>
                    <button type="button" class="theme-bubble pink" data-theme-bubble data-theme-group="pink" aria-label="Pink theme"></button>
                    <button type="button" class="theme-bubble green" data-theme-bubble data-theme-group="green" aria-label="Green theme"></button>
                    <button type="button" class="theme-bubble purple" data-theme-bubble data-theme-group="purple" aria-label="Purple theme"></button>
                    <button type="button" class="theme-bubble yellow" data-theme-bubble data-theme-group="yellow" aria-label="Yellow theme"></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    `;
  }

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
              class="nav-hamburger"
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

              <div class="menu-divider"></div>

              <div class="menu-theme-block" data-theme-control>
                <button
                  type="button"
                  class="theme-core-toggle"
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
                  <button type="button" class="theme-bubble light" data-theme-bubble data-theme-group="neutral" aria-label="Neutral theme"></button>
                  <button type="button" class="theme-bubble blue" data-theme-bubble data-theme-group="blue" aria-label="Blue theme"></button>
                  <button type="button" class="theme-bubble red" data-theme-bubble data-theme-group="red" aria-label="Red theme"></button>
                  <button type="button" class="theme-bubble pink" data-theme-bubble data-theme-group="pink" aria-label="Pink theme"></button>
                  <button type="button" class="theme-bubble green" data-theme-bubble data-theme-group="green" aria-label="Green theme"></button>
                  <button type="button" class="theme-bubble purple" data-theme-bubble data-theme-group="purple" aria-label="Purple theme"></button>
                  <button type="button" class="theme-bubble yellow" data-theme-bubble data-theme-group="yellow" aria-label="Yellow theme"></button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  `;
}

function injectUniversalNavbar() {
  const mount = document.getElementById("universalNav");
  if (!mount || mount.dataset.rendered === "true") return;
  mount.dataset.rendered = "true";
  mount.innerHTML = getUniversalNavbarMarkup();
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
      (currentPath.endsWith("/index.html") && normalizedHref.endsWith("/index.html")) ||
      (currentPath.endsWith("/") && normalizedHref.endsWith("/index.html"));

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

    menu.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        if (!item.classList.contains("dashboard-menu-button")) {
          closeAllNavDropdowns();
        }
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

      if (window.closeAllThemeMenus) {
        window.closeAllThemeMenus();
      }
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

function bindAuraGroups() {
  document.querySelectorAll(".glass-card, .dashboard-panel, .dashboard-overview, .dashboard-hero, .feature-card").forEach((group) => {
    if (group.dataset.auraBound === "true") return;
    group.dataset.auraBound = "true";

    const focusables = group.querySelectorAll(
      ".btn, .dashboard-nav-link, .dashboard-list-item, .dashboard-role-card, .dashboard-stat-card, .dashboard-portal-card, .dashboard-feed-item, .input-shell, .dashboard-inline-link, .menu-link"
    );

    focusables.forEach((item) => {
      item.addEventListener("pointerdown", () => {
        group.classList.add("active-glow");
        item.classList.add("active-glow");
      });

      item.addEventListener("mouseenter", () => {
        group.classList.add("active-glow");
      });

      item.addEventListener("mouseleave", () => {
        group.classList.remove("active-glow");
        item.classList.remove("active-glow");
      });

      item.addEventListener("focusin", () => {
        group.classList.add("active-glow");
        item.classList.add("active-glow");
      });

      item.addEventListener("focusout", () => {
        setTimeout(() => {
          if (!group.contains(document.activeElement)) {
            group.classList.remove("active-glow");
          }
          item.classList.remove("active-glow");
        }, 40);
      });
    });
  });
}

function initNav() {
  injectUniversalNavbar();
  bindNavDropdowns();
  bindGlobalNavClose();
  bindDashboardSidebar();
  bindAuraGroups();
  markActiveLinks();
}

window.closeAllNavDropdowns = closeAllNavDropdowns;
window.initNav = initNav;

document.addEventListener("DOMContentLoaded", initNav);