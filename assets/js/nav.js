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
  return `<a href="${href}" class="menu-link${active}" data-menu-link="${href}">${label}</a>`;
}

function getTheme() {
  return localStorage.getItem("evaraos-theme") || "dark";
}

function setTheme(theme) {
  localStorage.setItem("evaraos-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  syncQuickUi();
}

function syncQuickUi() {
  const theme = getTheme();
  const isLight = theme.includes("light");
  document.querySelectorAll("[data-theme-quick-label]").forEach((el) => {
    el.textContent = isLight ? "Light mode" : "Dark mode";
  });
}

function universalNavMarkup() {
  const links = getVisibleLinks().map((item) => navLink(item.page, item.label)).join("");

  return `
    <header class="landing-header universal-nav-shell">
      <div class="landing-header-inner glass-shell aurora-card">
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
            class="nav-hamburger aurora-card"
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

          <div class="nav-dropdown-menu glass-card aurora-card" id="siteNavMenu">
            <nav class="nav-dropdown-links" aria-label="Main navigation">
              ${links}
            </nav>

            <div class="menu-divider"></div>

            <div class="menu-quick-row">
              <button type="button" class="quick-chip aurora-card" id="quickThemeToggle">
                <span class="quick-chip-text">
                  <span class="quick-chip-dot"></span>
                  <span data-theme-quick-label>Dark mode</span>
                </span>
              </button>

              <a href="${buildHref("settings.html")}" class="menu-link" data-menu-link="${buildHref("settings.html")}">
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

function pulse(el) {
  if (!el) return;
  el.classList.remove("pop-click");
  void el.offsetWidth;
  el.classList.add("pop-click");
  setTimeout(() => el.classList.remove("pop-click"), 240);
}

function shine(el) {
  if (!el) return;
  el.classList.remove("shine-flash");
  void el.offsetWidth;
  el.classList.add("shine-flash");
  setTimeout(() => el.classList.remove("shine-flash"), 560);
}

function activateCardGlow(el) {
  if (!el) return;
  el.classList.add("active-card-glow");
  setTimeout(() => el.classList.remove("active-card-glow"), 650);
}

function pulseShineGlow(el) {
  pulse(el);
  shine(el);
  activateCardGlow(el);
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

      pulseShineGlow(link);
      closeMenu();

      setTimeout(() => {
        window.location.assign(href);
      }, 120);
    });
  });
}

function bindQuickControls() {
  const quickThemeToggle = document.getElementById("quickThemeToggle");
  if (!quickThemeToggle) return;

  quickThemeToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const current = getTheme();
    const next = current.includes("light") ? "dark" : "light";
    setTheme(next);
    pulseShineGlow(quickThemeToggle);
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
    pulseShineGlow(toggle);
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

function bindInteractiveShine() {
  document.querySelectorAll(".btn, .feature-card, .nav-hamburger, .menu-link, .quick-chip").forEach((el) => {
    el.addEventListener("click", () => {
      pulseShineGlow(el);
    });
  });
}

function initNav() {
  document.documentElement.setAttribute("data-theme", getTheme());
  renderNav();
  renderFooter();
  bindNav();
  bindNavLinks();
  bindQuickControls();
  bindInteractiveShine();
  syncQuickUi();
}

document.addEventListener("DOMContentLoaded", initNav);