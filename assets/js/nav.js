function themeMarkup() {
  return `
    <div class="menu-theme-block">
      <button type="button" class="theme-core-toggle aurora-card" data-theme-pill aria-label="Toggle light and dark mode">
        <span class="theme-core-dot"></span>
        <span class="theme-core-label" data-theme-mode-text>Dark</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-group" data-theme-group-text>Neutral</span>
        <span class="theme-core-sep">•</span>
        <span class="theme-core-hint">tap</span>
      </button>

      <div class="theme-slider-shell aurora-card">
        <button type="button" class="theme-slider-arrow" data-theme-scroll="left" aria-label="Scroll theme colors left">‹</button>

        <div class="theme-bubbles-scroll" data-theme-bubbles-scroll>
          <button type="button" class="theme-bubble light" data-theme-bubble data-theme-family="neutral" aria-label="Neutral theme"></button>
          <button type="button" class="theme-bubble blue" data-theme-bubble data-theme-family="blue" aria-label="Blue theme"></button>
          <button type="button" class="theme-bubble red" data-theme-bubble data-theme-family="red" aria-label="Red theme"></button>
          <button type="button" class="theme-bubble pink" data-theme-bubble data-theme-family="pink" aria-label="Pink theme"></button>
          <button type="button" class="theme-bubble green" data-theme-bubble data-theme-family="green" aria-label="Green theme"></button>
          <button type="button" class="theme-bubble purple" data-theme-bubble data-theme-family="purple" aria-label="Purple theme"></button>
          <button type="button" class="theme-bubble yellow" data-theme-bubble data-theme-family="yellow" aria-label="Yellow theme"></button>
        </div>

        <button type="button" class="theme-slider-arrow" data-theme-scroll="right" aria-label="Scroll theme colors right">›</button>
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

function renderNav() {
  const mount = document.getElementById("universalNav");
  if (!mount) return;
  mount.innerHTML = publicNavMarkup();
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

function bindThemeArrows() {
  document.querySelectorAll("[data-theme-scroll]").forEach((button) => {
    button.onclick = (event) => {
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
    };
  });
}

function bindMenus() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");
    if (!toggle || !menu) return;

    toggle.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const opening = !dropdown.classList.contains("open");
      closeMenus(dropdown);
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
  });

  document.addEventListener("click", () => closeMenus(), { once: false });
}

function initNav() {
  renderNav();
  renderFooter();
  bindMenus();
  bindThemeArrows();

  if (window.EvaraTheme?.bindThemeControls) {
    window.EvaraTheme.bindThemeControls();
  }

  if (window.EvaraTheme?.syncThemeUi) {
    window.EvaraTheme.syncThemeUi();
  }
}

document.addEventListener("DOMContentLoaded", initNav);