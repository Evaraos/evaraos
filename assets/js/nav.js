import {
  auth,
  logoutAndRedirect,
  getSavedUserProfile,
  applyUserToUi
} from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function themeMarkup() {
  return `
    <div class="menu-theme-block">
      <button type="button" class="theme-core-toggle aurora-card" data-theme-pill>
        <span class="theme-core-dot"></span>
        <span class="theme-core-label" data-theme-mode-text>Dark</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-group" data-theme-group-text>Neutral</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-hint">tap</span>
      </button>

      <div class="theme-slider-shell aurora-card">
        <button type="button" class="theme-slider-arrow" data-theme-scroll="left">‹</button>

        <div class="theme-bubbles-scroll" data-theme-bubbles-scroll>
          <button type="button" class="theme-bubble light" data-theme-bubble data-theme-family="neutral"></button>
          <button type="button" class="theme-bubble blue" data-theme-bubble data-theme-family="blue"></button>
          <button type="button" class="theme-bubble red" data-theme-bubble data-theme-family="red"></button>
          <button type="button" class="theme-bubble pink" data-theme-bubble data-theme-family="pink"></button>
          <button type="button" class="theme-bubble green" data-theme-bubble data-theme-family="green"></button>
          <button type="button" class="theme-bubble purple" data-theme-bubble data-theme-family="purple"></button>
          <button type="button" class="theme-bubble yellow" data-theme-bubble data-theme-family="yellow"></button>
        </div>

        <button type="button" class="theme-slider-arrow" data-theme-scroll="right">›</button>
      </div>
    </div>
  `;
}

function footerMarkup() {
  return `
    <footer class="site-footer glass-card aurora-card">
      <div class="site-footer-inner">
        <div class="site-footer-left">
          <strong>© <span id="footerYear"></span> Evaraos Inc</strong>
          <span>All rights reserved.</span>
        </div>
        <div class="site-footer-right">
          <a href="https://instagram.com/evaraos" target="_blank" rel="noopener noreferrer">@evaraos</a>
          <a href="https://x.com/evaraos" target="_blank" rel="noopener noreferrer">@evaraos</a>
          <a href="https://tiktok.com/@evaraos" target="_blank" rel="noopener noreferrer">@evaraos</a>
        </div>
      </div>
    </footer>
  `;
}

function publicNavMarkup() {
  return `
    <header class="landing-header universal-nav-shell">
      <div class="landing-header-inner glass-shell aurora-card">
        <a href="/evaraos/index.html" class="brand-link" aria-label="Go home">
          <img src="/evaraos/assets/img/evaraos_logo.png" alt="Evaraos logo" class="brand-logo" />
          <div class="brand-copy">
            <strong>Evaraos Inc</strong>
            <span>Subsidiaries Allocation SaaS</span>
          </div>
        </a>

        <div class="nav-dropdown" data-nav-dropdown>
          <button class="nav-hamburger aurora-card" type="button" data-nav-toggle aria-expanded="false" aria-label="Open menu">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>

          <div class="nav-dropdown-menu glass-card aurora-card" data-nav-menu>
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
            ${themeMarkup()}
          </div>
        </div>
      </div>
    </header>
  `;
}

function dashboardNavMarkup() {
  return `
    <header class="dashboard-topbar universal-nav-shell">
      <div class="dashboard-topbar-inner glass-shell aurora-card">
        <a href="/evaraos/index.html" class="brand-link" aria-label="Go home">
          <img src="/evaraos/assets/img/evaraos_logo.png" alt="Evaraos logo" class="brand-logo" />
          <div class="brand-copy">
            <strong>Evaraos Inc</strong>
            <span>Executive Control Center</span>
          </div>
        </a>

        <div class="nav-dropdown" data-nav-dropdown>
          <button class="nav-hamburger aurora-card" type="button" data-nav-toggle aria-expanded="false" aria-label="Open menu">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>

          <div class="nav-dropdown-menu glass-card aurora-card" data-nav-menu>
            <div class="menu-link" style="pointer-events:none; opacity:0.92;">
              <strong id="dashboardProfileName">Owner Account</strong>
            </div>
            <div class="menu-link" style="pointer-events:none; opacity:0.72;">
              <span id="dashboardProfileRole">Executive Access</span>
            </div>
            <div class="menu-divider"></div>
            <a href="/evaraos/profile.html" class="menu-link" data-nav-link>Edit Profile</a>
            <a href="/evaraos/settings.html" class="menu-link" data-nav-link>Settings</a>
            <a href="/evaraos/security.html" class="menu-link" data-nav-link>Account Security</a>
            <button type="button" id="logoutBtn" class="dashboard-menu-button">Logout</button>
            <div class="menu-divider"></div>
            ${themeMarkup()}
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderNav() {
  const mount = document.getElementById("universalNav");
  if (!mount || mount.dataset.rendered === "true") return;

  const isDashboard = document.body.classList.contains("dashboard-body");
  mount.innerHTML = isDashboard ? dashboardNavMarkup() : publicNavMarkup();
  mount.dataset.rendered = "true";
}

function renderFooter() {
  if (document.querySelector(".site-footer")) return;
  document.body.insertAdjacentHTML("beforeend", footerMarkup());
  const year = document.getElementById("footerYear");
  if (year) year.textContent = String(new Date().getFullYear());
}

function pulse(el) {
  if (!el) return;
  el.classList.remove("active-glow");
  void el.offsetWidth;
  el.classList.add("active-glow");
  setTimeout(() => el.classList.remove("active-glow"), 220);
}

function closeMenus(except = null) {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    if (except && dropdown === except) return;
    dropdown.classList.remove("open");
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
}

function bindMenus() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    if (dropdown.dataset.bound === "true") return;
    dropdown.dataset.bound = "true";

    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = !dropdown.classList.contains("open");
      closeMenus(dropdown);
      dropdown.classList.toggle("open", opening);
      toggle.setAttribute("aria-expanded", opening ? "true" : "false");
      pulse(toggle);

      if (window.EvaraTheme?.bindThemeControls) {
        window.EvaraTheme.bindThemeControls();
      }
      bindThemeArrows();
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.addEventListener("click", () => closeMenus());
}

function bindThemeArrows() {
  document.querySelectorAll("[data-theme-scroll]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const direction = button.getAttribute("data-theme-scroll");
      const shell = button.closest(".theme-slider-shell");
      const strip = shell?.querySelector("[data-theme-bubbles-scroll]");
      if (!strip) return;
      strip.scrollBy({
        left: direction === "left" ? -120 : 120,
        behavior: "smooth"
      });
      pulse(button);
    });
  });
}

function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn || logoutBtn.dataset.bound === "true") return;
  logoutBtn.dataset.bound = "true";

  logoutBtn.addEventListener("click", async () => {
    try {
      await logoutAndRedirect("/evaraos/login.html");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
}

function hydrateProfile() {
  const profile = getSavedUserProfile();
  if (profile) applyUserToUi(profile);
}

let watchingAuth = false;

function watchAuth() {
  if (watchingAuth) return;
  watchingAuth = true;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      hydrateProfile();
      bindLogout();
    }
  });
}

function initNav() {
  renderNav();
  renderFooter();
  bindMenus();
  bindThemeArrows();
  bindLogout();
  hydrateProfile();
  watchAuth();

  if (window.EvaraTheme?.bindThemeControls) {
    window.EvaraTheme.bindThemeControls();
  }
  if (window.EvaraTheme?.syncThemeUi) {
    window.EvaraTheme.syncThemeUi();
  }
}

document.addEventListener("DOMContentLoaded", initNav);