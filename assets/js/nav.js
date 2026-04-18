// assets/js/nav.js

import { auth, logout } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const NAV_LOGIN_LINKS = `
  <a href="/evaraos/login.html" class="nav-dropdown-link">
    <span class="nav-dropdown-icon">→</span>
    <span>Login</span>
  </a>
  <a href="/evaraos/signup.html" class="nav-dropdown-link">
    <span class="nav-dropdown-icon">+</span>
    <span>Sign Up</span>
  </a>
`;

const NAV_APP_LINKS = `
  <a href="/evaraos/dashboard.html" class="nav-dropdown-link">
    <span class="nav-dropdown-icon">⌂</span>
    <span>Dashboard</span>
  </a>
  <a href="/evaraos/profile.html" class="nav-dropdown-link">
    <span class="nav-dropdown-icon">◉</span>
    <span>Profile</span>
  </a>
  <a href="/evaraos/settings.html" class="nav-dropdown-link">
    <span class="nav-dropdown-icon">⚙</span>
    <span>Settings</span>
  </a>
`;

function renderUniversalNav() {
  const host = document.getElementById("universalNav") || document.getElementById("universalNavRoot");
  if (!host) return;

  host.innerHTML = `
    <div class="nav-pill-shell" id="navPillShell">
      <div class="nav-pill nav-pill-compact" id="navPill">
        <button class="nav-brand-button" id="navBrandButton" type="button" aria-label="Open navigation">
          <img src="/evaraos/assets/img/evaraos_logo.png" alt="Evaraos" class="nav-logo" />
          <span class="nav-brand-text">Evaraos Inc</span>
        </button>

        <button class="nav-menu-button" id="navMenuButton" type="button" aria-label="Toggle menu">
          <span class="nav-menu-dot"></span>
          <span class="nav-menu-dot"></span>
          <span class="nav-menu-dot"></span>
        </button>
      </div>

      <div class="nav-dropdown glass-card aurora-card" id="navDropdown" hidden>
        <div class="nav-dropdown-group">
          <p class="nav-dropdown-label">Navigate</p>
          <div class="nav-dropdown-links" id="navPrimaryLinks"></div>
        </div>

        <div class="nav-dropdown-group">
          <p class="nav-dropdown-label">Access</p>
          <div class="nav-dropdown-links" id="navAccessLinks"></div>
        </div>

        <div class="nav-dropdown-group">
          <p class="nav-dropdown-label">Appearance</p>
          <div class="nav-dropdown-links">
            <button class="nav-dropdown-link nav-theme-btn" data-theme-target="dark" type="button">
              <span class="nav-dropdown-icon">◐</span>
              <span>Dark Mode</span>
            </button>
            <button class="nav-dropdown-link nav-theme-btn" data-theme-target="light" type="button">
              <span class="nav-dropdown-icon">◑</span>
              <span>Light Mode</span>
            </button>
          </div>
        </div>

        <div class="nav-dropdown-group" id="navLogoutGroup" hidden>
          <p class="nav-dropdown-label">Session</p>
          <div class="nav-dropdown-links">
            <button class="nav-dropdown-link nav-logout-btn" id="navLogoutBtn" type="button">
              <span class="nav-dropdown-icon">⎋</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupUniversalNav();
}

function setupUniversalNav() {
  const pill = document.getElementById("navPill");
  const dropdown = document.getElementById("navDropdown");
  const brandButton = document.getElementById("navBrandButton");
  const menuButton = document.getElementById("navMenuButton");
  const primaryLinks = document.getElementById("navPrimaryLinks");
  const accessLinks = document.getElementById("navAccessLinks");
  const logoutGroup = document.getElementById("navLogoutGroup");

  if (!pill || !dropdown || !brandButton || !menuButton || !primaryLinks || !accessLinks || !logoutGroup) return;

  const currentPath = window.location.pathname;
  const isAuthPage =
    currentPath.endsWith("/login.html") ||
    currentPath.endsWith("/signup.html") ||
    currentPath.endsWith("/reset.html");

  let isOpen = false;
  let closeTimer = null;

  primaryLinks.innerHTML = `
    <a href="/evaraos/index.html" class="nav-dropdown-link">
      <span class="nav-dropdown-icon">⌂</span>
      <span>Home</span>
    </a>
    <a href="/evaraos/dashboard.html" class="nav-dropdown-link">
      <span class="nav-dropdown-icon">◈</span>
      <span>Dashboard</span>
    </a>
    <a href="/evaraos/companies.html" class="nav-dropdown-link">
      <span class="nav-dropdown-icon">◎</span>
      <span>Companies</span>
    </a>
    <a href="/evaraos/users.html" class="nav-dropdown-link">
      <span class="nav-dropdown-icon">◌</span>
      <span>Users</span>
    </a>
    <a href="/evaraos/leads.html" class="nav-dropdown-link">
      <span class="nav-dropdown-icon">◍</span>
      <span>Leads</span>
    </a>
    <a href="/evaraos/jobs.html" class="nav-dropdown-link">
      <span class="nav-dropdown-icon">◒</span>
      <span>Jobs</span>
    </a>
  `;

  function clearCloseTimer() {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      closeDropdown();
    }, 7000);
  }

  function openDropdown() {
    isOpen = true;
    pill.classList.add("is-open");
    dropdown.hidden = false;
    dropdown.classList.add("is-open");
    scheduleClose();

    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }

  function closeDropdown() {
    isOpen = false;
    pill.classList.remove("is-open");
    dropdown.classList.remove("is-open");
    clearCloseTimer();

    window.setTimeout(() => {
      if (!isOpen) {
        dropdown.hidden = true;
      }
    }, 180);

    if (navigator.vibrate) {
      navigator.vibrate(6);
    }
  }

  function toggleDropdown() {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  brandButton.addEventListener("click", (event) => {
    event.preventDefault();

    if (window.location.pathname.endsWith("/index.html") || window.location.pathname === "/evaraos/" || window.location.pathname === "/evaraos") {
      toggleDropdown();
      return;
    }

    window.location.href = "/evaraos/index.html";
  });

  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target) && !pill.contains(event.target)) {
      closeDropdown();
    }
  });

  dropdown.addEventListener("mouseenter", () => {
    clearCloseTimer();
  });

  dropdown.addEventListener("mouseleave", () => {
    if (isOpen) scheduleClose();
  });

  document.querySelectorAll(".nav-theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.themeTarget || "dark";
      document.documentElement.setAttribute("data-theme", target);
      localStorage.setItem("evaraos-theme", target);
      scheduleClose();
    });
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      accessLinks.innerHTML = NAV_APP_LINKS;
      logoutGroup.hidden = false;
    } else {
      accessLinks.innerHTML = isAuthPage ? "" : NAV_LOGIN_LINKS;
      logoutGroup.hidden = true;
    }

    const logoutBtn = document.getElementById("navLogoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await logout();
      };
    }
  });

  let lastScrollY = window.scrollY;
  let scrollTimeout = null;

  function applyCompact() {
    pill.classList.remove("is-expanded-by-scroll");
  }

  function applyExpanded() {
    pill.classList.add("is-expanded-by-scroll");
    clearCloseTimer();
    window.clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
      if (!isOpen) applyCompact();
    }, 4000);
  }

  window.addEventListener("scroll", () => {
    const currentY = window.scrollY;

    if (currentY <= 6) {
      pill.classList.add("is-at-top");
      applyExpanded();
      lastScrollY = currentY;
      return;
    } else {
      pill.classList.remove("is-at-top");
    }

    if (currentY > lastScrollY) {
      applyCompact();
    } else if (currentY < lastScrollY) {
      applyExpanded();
    }

    lastScrollY = currentY;
  });

  if (window.scrollY <= 6) {
    pill.classList.add("is-at-top");
    applyExpanded();
  } else {
    applyCompact();
  }
}

document.addEventListener("DOMContentLoaded", renderUniversalNav);