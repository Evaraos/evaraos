function footerMarkup() {
  return `
    <footer class="site-footer">
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

function getCurrentPath() {
  return window.location.pathname.replace(/\/+$/, "");
}

function normalizePage(path) {
  return path.split("/").pop() || "index.html";
}

function isCurrentPage(path) {
  const current = normalizePage(getCurrentPath());
  const target = normalizePage(path);
  return current === target || (current === "" && target === "index.html");
}

function getBasePath() {
  const path = window.location.pathname;
  const marker = "/evaraos/";
  const index = path.indexOf(marker);
  return index >= 0 ? path.slice(0, index + marker.length - 1) : "/evaraos";
}

function buildHref(page) {
  return `${getBasePath()}/${page}`;
}

function getRole() {
  try {
    const raw =
      localStorage.getItem("evaraos-user") ||
      sessionStorage.getItem("evaraos-user");
    if (!raw) return "guest";
    const parsed = JSON.parse(raw);
    return String(parsed?.role || "guest").toLowerCase();
  } catch {
    return "guest";
  }
}

function getVisibleLinks() {
  const role = getRole();

  const common = [
    { page: "index.html", label: "Home" },
    { page: "settings.html", label: "Settings" }
  ];

  const guestOnly = [
    { page: "login.html", label: "Login" },
    { page: "signup.html", label: "Sign Up" },
    { page: "reset.html", label: "Reset" }
  ];

  const ownerOnly = [
    { page: "dashboard.html", label: "Dashboard" },
    { page: "companies.html", label: "Companies" },
    { page: "users.html", label: "Users" },
    { page: "leads.html", label: "Leads" },
    { page: "jobs.html", label: "Jobs" },
    { page: "qa.html", label: "QA" }
  ];

  return role === "owner" ? [...common, ...ownerOnly] : [...common, ...guestOnly];
}

function navLink(page, label) {
  const href = buildHref(page);
  const active = isCurrentPage(page) ? " active" : "";
  return `<a href="${href}" class="menu-link${active}" data-menu-link="${href}" data-menu-label="${label.toLowerCase()}">${label}</a>`;
}

function getTheme() {
  return localStorage.getItem("evaraos-theme") || "dark";
}

function setTheme(theme) {
  localStorage.setItem("evaraos-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  syncQuickUi();
}

function getThemeProfile() {
  return localStorage.getItem("evaraos-theme-profile") || "1";
}

function setThemeProfile(profile) {
  localStorage.setItem("evaraos-theme-profile", profile);
  document.documentElement.setAttribute("data-theme-profile", profile);
  syncQuickUi();
}

function getBorderFx() {
  return localStorage.getItem("evaraos-border-fx") || "custom";
}

function setBorderFx(mode) {
  localStorage.setItem("evaraos-border-fx", mode);
  document.documentElement.setAttribute("data-border-fx", mode);
  syncQuickUi();
}

function syncQuickUi() {
  const theme = getTheme();
  const isLight = theme.includes("light");

  document.querySelectorAll("[data-theme-quick-label]").forEach((el) => {
    el.textContent = isLight ? "Light mode" : "Dark mode";
  });

  const profile = getThemeProfile();
  document.querySelectorAll("[data-theme-bubble]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-theme-bubble") === profile);
  });

  const fx = getBorderFx();
  document.querySelectorAll("[data-fx-quick-label]").forEach((el) => {
    el.textContent = fx.charAt(0).toUpperCase() + fx.slice(1);
  });

  document.querySelectorAll("[data-fx-pill]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-fx-pill") === fx);
  });
}

function themePaletteMarkup() {
  return `
    <div class="theme-palette-row">
      <div class="theme-row-title">Theme color</div>
      <div class="theme-bubbles-scroll">
        <button class="theme-bubble light" data-theme-bubble="1" aria-label="Theme 1"></button>
        <button class="theme-bubble blue" data-theme-bubble="2" aria-label="Theme 2"></button>
        <button class="theme-bubble red" data-theme-bubble="3" aria-label="Theme 3"></button>
        <button class="theme-bubble green" data-theme-bubble="4" aria-label="Theme 4"></button>
      </div>
    </div>
  `;
}

function borderFxMarkup() {
  return `
    <div class="border-fx-row">
      <div class="fx-row-title">Border beam</div>
      <div class="fx-pills">
        <button class="fx-pill" data-fx-pill="off">Off</button>
        <button class="fx-pill" data-fx-pill="rainbow">Rainbow</button>
        <button class="fx-pill" data-fx-pill="custom">Custom</button>
      </div>
    </div>
  `;
}

function universalNavMarkup() {
  const links = getVisibleLinks().map((item) => navLink(item.page, item.label)).join("");

  return `
    <header class="landing-header universal-nav-shell" id="universalNavShell">
      <div class="landing-header-inner glass-shell" id="universalNavInner">
        <a href="${buildHref("index.html")}" class="brand-link" aria-label="Go home">
          <img
            src="${getBasePath()}/assets/img/evaraos_logo.png"
            alt="Evaraos logo"
            class="brand-logo"
            onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
          />
          <div class="brand-copy">
            <strong>Evaraos Inc</strong>
            <span>Subsidiaries Allocation SaaS</span>
          </div>
        </a>

        <div class="nav-dropdown" id="siteNavDropdown">
          <button
            class="nav-hamburger"
            type="button"
            id="siteNavToggle"
            aria-expanded="false"
            aria-label="Open menu"
          >
            <span class="hamburger-orb">
              <span class="hamburger-bar top"></span>
              <span class="hamburger-bar mid"></span>
              <span class="hamburger-bar bot"></span>
            </span>
          </button>

          <div class="nav-menu-backdrop" id="siteNavBackdrop"></div>

          <div class="nav-dropdown-menu" id="siteNavMenu">
            <label class="menu-search">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M10 4a6 6 0 1 0 3.874 10.582l4.272 4.272 1.414-1.414-4.272-4.272A6 6 0 0 0 10 4m0 2a4 4 0 1 1 0 8a4 4 0 0 1 0-8"/>
              </svg>
              <input type="search" id="menuSearchInput" placeholder="Search pages" />
            </label>

            <nav class="nav-dropdown-links" id="menuLinksWrap" aria-label="Main navigation">
              ${links}
            </nav>

            <div class="menu-divider"></div>

            <div class="menu-quick-row">
              <button type="button" class="quick-chip" id="quickThemeToggle">
                <span class="quick-chip-text">
                  <span class="quick-chip-dot"></span>
                  <span data-theme-quick-label>Dark mode</span>
                </span>
              </button>

              <button type="button" class="quick-chip" id="quickFxToggle">
                <span class="quick-chip-text">
                  <span class="quick-chip-dot"></span>
                  <span data-fx-quick-label>Custom</span>
                </span>
              </button>

              ${themePaletteMarkup()}
              ${borderFxMarkup()}

              <a href="${buildHref("settings.html")}" class="menu-link" data-menu-link="${buildHref("settings.html")}" data-menu-label="advanced settings">
                Advanced settings
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function footerAlreadyExists() {
  return document.querySelector(".site-footer");
}

function renderNav() {
  const mount = document.getElementById("universalNav");
  if (!mount) return;
  mount.innerHTML = universalNavMarkup();
}

function renderFooter() {
  if (footerAlreadyExists()) return;
  document.body.insertAdjacentHTML("beforeend", footerMarkup());
  const year = document.getElementById("footerYear");
  if (year) year.textContent = String(new Date().getFullYear());
}

function closeMenu() {
  const dropdown = document.getElementById("siteNavDropdown");
  const toggle = document.getElementById("siteNavToggle");
  if (!dropdown || !toggle) return;
  dropdown.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
}

function bindNavLinks() {
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const href = link.getAttribute("data-menu-link");
      if (!href) return;

      closeMenu();
      window.location.assign(href);
    });
  });
}

function bindThemeControls() {
  const quickThemeToggle = document.getElementById("quickThemeToggle");
  if (quickThemeToggle) {
    quickThemeToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const current = getTheme();
      const next = current.includes("light") ? "dark" : "light";
      setTheme(next);
    });
  }

  document.querySelectorAll("[data-theme-bubble]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const profile = button.getAttribute("data-theme-bubble");
      if (!profile) return;
      setThemeProfile(profile);
    });
  });
}

function bindBorderFxControls() {
  const quickFxToggle = document.getElementById("quickFxToggle");
  if (quickFxToggle) {
    quickFxToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const current = getBorderFx();
      const next = current === "off" ? "rainbow" : current === "rainbow" ? "custom" : "off";
      setBorderFx(next);
    });
  }

  document.querySelectorAll("[data-fx-pill]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const fx = button.getAttribute("data-fx-pill");
      if (!fx) return;
      setBorderFx(fx);
    });
  });
}

function bindSearch() {
  const input = document.getElementById("menuSearchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll("[data-menu-label]").forEach((item) => {
      const label = item.getAttribute("data-menu-label") || "";
      item.style.display = !q || label.includes(q) ? "" : "none";
    });
  });
}

function bindNav() {
  const dropdown = document.getElementById("siteNavDropdown");
  const toggle = document.getElementById("siteNavToggle");
  const menu = document.getElementById("siteNavMenu");
  const backdrop = document.getElementById("siteNavBackdrop");

  if (!dropdown || !toggle || !menu || !backdrop) return;

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const opening = !dropdown.classList.contains("open");
    dropdown.classList.toggle("open", opening);
    toggle.setAttribute("aria-expanded", opening ? "true" : "false");
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  backdrop.addEventListener("click", () => {
    closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      closeMenu();
    }
  });
}

function bindNavShrink() {
  const shell = document.getElementById("universalNavShell");
  if (!shell) return;

  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    const goingDown = y > lastY;
    const compact = y > 36 && goingDown;

    shell.classList.toggle("nav-compact", compact);
    lastY = y;
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener("touchend", () => {
    shell.classList.remove("nav-compact");
  });

  shell.addEventListener("click", () => {
    shell.classList.remove("nav-compact");
  });
}

function initNav() {
  document.documentElement.setAttribute("data-theme", getTheme());
  document.documentElement.setAttribute("data-theme-profile", getThemeProfile());
  document.documentElement.setAttribute("data-border-fx", getBorderFx());

  renderNav();
  renderFooter();
  bindNav();
  bindNavLinks();
  bindThemeControls();
  bindBorderFxControls();
  bindSearch();
  bindNavShrink();
  syncQuickUi();
}

document.addEventListener("DOMContentLoaded", initNav);