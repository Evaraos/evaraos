function themeMarkup() {
  return `
    <div class="menu-theme-block">
      <button
        type="button"
        class="theme-core-toggle aurora-card"
        data-theme-pill
        aria-label="Toggle light and dark mode"
      >
        <span class="theme-core-dot"></span>
        <span class="theme-core-label" data-theme-mode-text>Dark</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-group" data-theme-group-text>Neutral</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-hint">tap</span>
      </button>

      <div class="theme-slider-shell aurora-card">
        <button
          type="button"
          class="theme-slider-arrow"
          data-theme-scroll="left"
          aria-label="Scroll theme colors left"
        >‹</button>

        <div class="theme-bubbles-scroll" data-theme-bubbles-scroll>
          <button type="button" class="theme-bubble light" data-theme-bubble data-theme-family="neutral" aria-label="Neutral theme"></button>
          <button type="button" class="theme-bubble blue" data-theme-bubble data-theme-family="blue" aria-label="Blue theme"></button>
          <button type="button" class="theme-bubble red" data-theme-bubble data-theme-family="red" aria-label="Red theme"></button>
          <button type="button" class="theme-bubble pink" data-theme-bubble data-theme-family="pink" aria-label="Pink theme"></button>
          <button type="button" class="theme-bubble green" data-theme-bubble data-theme-family="green" aria-label="Green theme"></button>
          <button type="button" class="theme-bubble purple" data-theme-bubble data-theme-family="purple" aria-label="Purple theme"></button>
          <button type="button" class="theme-bubble yellow" data-theme-bubble data-theme-family="yellow" aria-label="Yellow theme"></button>
        </div>

        <button
          type="button"
          class="theme-slider-arrow"
          data-theme-scroll="right"
          aria-label="Scroll theme colors right"
        >›</button>
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

function getCurrentPath() {
  return window.location.pathname.replace(/\/+$/, "");
}

function isCurrentPage(path) {
  const current = getCurrentPath();
  return current === path || current.endsWith(path);
}

function navLink(path, label) {
  const active = isCurrentPage(path) ? " active" : "";
  return `<a href="${path}" class="menu-link${active}" data-menu-link>${label}</a>`;
}

function universalNavMarkup() {
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

          <div class="nav-dropdown-menu glass-card aurora-card" id="siteNavMenu">
            <nav class="nav-dropdown-links" aria-label="Main navigation">
              ${navLink("/evaraos/index.html", "Home")}
              ${navLink("/evaraos/login.html", "Login")}
              ${navLink("/evaraos/signup.html", "Sign Up")}
              ${navLink("/evaraos/reset.html", "Reset")}
              ${navLink("/evaraos/dashboard.html", "Dashboard")}
              ${navLink("/evaraos/companies.html", "Companies")}
              ${navLink("/evaraos/users.html", "Users")}
              ${navLink("/evaraos/leads.html", "Leads")}
              ${navLink("/evaraos/jobs.html", "Jobs")}
              ${navLink("/evaraos/qa.html", "QA")}
            </nav>
            <div class="menu-divider"></div>
            ${themeMarkup()}
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
  setTimeout(() => el.classList.remove("shine-flash"), 540);
}

function pulseAndShine(el) {
  pulse(el);
  shine(el);
}

function bindThemeArrows() {
  document.querySelectorAll("[data-theme-scroll]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const direction = button.getAttribute("data-theme-scroll");
      const shell = button.closest(".theme-slider-shell");
      const strip = shell?.querySelector("[data-theme-bubbles-scroll]");
      if (!strip) return;

      pulseAndShine(button);

      setTimeout(() => {
        strip.scrollBy({
          left: direction === "left" ? -120 : 120,
          behavior: "smooth"
        });
      }, 90);
    };
  });
}

function bindNavLinks() {
  document.querySelectorAll(".menu-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      pulseAndShine(link);
      const href = link.getAttribute("href");
      if (!href) return;

      event.preventDefault();
      setTimeout(() => {
        window.location.href = href;
      }, 120);
    });
  });
}

function bindNav() {
  const dropdown = document.getElementById("siteNavDropdown");
  const toggle = document.getElementById("siteNavToggle");
  const menu = document.getElementById("siteNavMenu");

  if (!dropdown || !toggle || !menu) return;

  toggle.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const opening = !dropdown.classList.contains("open");
    dropdown.classList.toggle("open", opening);
    toggle.setAttribute("aria-expanded", opening ? "true" : "false");
    pulseAndShine(toggle);

    if (window.EvaraTheme?.bindThemeControls) {
      window.EvaraTheme.bindThemeControls();
    }

    if (window.EvaraTheme?.syncThemeUi) {
      window.EvaraTheme.syncThemeUi();
    }

    bindThemeArrows();
    bindNavLinks();
  };

  menu.onclick = (event) => {
    event.stopPropagation();
  };

  document.addEventListener("click", (event) => {
    const clickedInside = dropdown.contains(event.target);
    if (!clickedInside) {
      dropdown.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function bindInteractiveShine() {
  document
    .querySelectorAll(".btn, .feature-card, .theme-core-toggle, .theme-bubble, .theme-slider-arrow, .nav-hamburger, .password-toggle")
    .forEach((el) => {
      el.addEventListener("click", () => {
        pulseAndShine(el);
      });
    });

  document
    .querySelectorAll(".input-shell, .password-wrap, .dashboard-search-shell")
    .forEach((el) => {
      const input = el.querySelector("input, textarea");
      if (!input) return;

      input.addEventListener("focus", () => shine(el));
      input.addEventListener("input", () => shine(el));
    });
}

function initNav() {
  renderNav();
  renderFooter();
  bindNav();
  bindThemeArrows();
  bindNavLinks();

  if (window.EvaraTheme?.bindThemeControls) {
    window.EvaraTheme.bindThemeControls();
  }

  if (window.EvaraTheme?.syncThemeUi) {
    window.EvaraTheme.syncThemeUi();
  }

  bindInteractiveShine();
}

document.addEventListener("DOMContentLoaded", initNav);