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
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>

          <div class="nav-dropdown-menu glass-card aurora-card" id="siteNavMenu">
            <a href="/evaraos/index.html" class="menu-link">Home</a>
            <a href="/evaraos/login.html" class="menu-link">Login</a>
            <a href="/evaraos/signup.html" class="menu-link">Sign Up</a>
            <a href="/evaraos/reset.html" class="menu-link">Reset</a>
            <a href="/evaraos/dashboard.html" class="menu-link">Dashboard</a>
            <a href="/evaraos/companies.html" class="menu-link">Companies</a>
            <a href="/evaraos/users.html" class="menu-link">Users</a>
            <a href="/evaraos/leads.html" class="menu-link">Leads</a>
            <a href="/evaraos/jobs.html" class="menu-link">Jobs</a>
            <a href="/evaraos/qa.html" class="menu-link">QA</a>
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

function bindThemeArrows() {
  document.querySelectorAll("[data-theme-scroll]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const direction = button.getAttribute("data-theme-scroll");
      const shell = button.closest(".theme-slider-shell");
      const strip = shell?.querySelector("[data-theme-bubbles-scroll]");
      if (!strip) return;

      pulse(button);

      setTimeout(() => {
        strip.scrollBy({
          left: direction === "left" ? -120 : 120,
          behavior: "smooth"
        });
      }, 80);
    };
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
    pulse(toggle);

    if (window.EvaraTheme?.bindThemeControls) {
      window.EvaraTheme.bindThemeControls();
    }

    if (window.EvaraTheme?.syncThemeUi) {
      window.EvaraTheme.syncThemeUi();
    }

    bindThemeArrows();
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

function bindPopFeedback() {
  document.querySelectorAll(".btn, .feature-card, .theme-core-toggle, .theme-bubble, .theme-slider-arrow").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.currentTarget.matches(".btn") || event.currentTarget.matches(".feature-card")) {
        pulse(event.currentTarget);
      }
    });
  });
}

function initNav() {
  renderNav();
  renderFooter();
  bindNav();
  bindThemeArrows();

  if (window.EvaraTheme?.bindThemeControls) {
    window.EvaraTheme.bindThemeControls();
  }

  if (window.EvaraTheme?.syncThemeUi) {
    window.EvaraTheme.syncThemeUi();
  }

  bindPopFeedback();
}

document.addEventListener("DOMContentLoaded", initNav);