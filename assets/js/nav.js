(function () {
  let tripleTapCount = 0;
  let tripleTapTimer = null;
  let progress = 0;
  let lastY = window.scrollY;
  let lastTs = 0;

  function getBasePath() {
    const path = window.location.pathname;
    const marker = "/evaraos/";
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index + marker.length - 1) : "/evaraos";
  }

  function buildHref(page) {
    return `${getBasePath()}/${page}`;
  }

  function normalizePage(path) {
    return path.split("/").pop() || "index.html";
  }

  function isCurrentPage(path) {
    const current = normalizePage(window.location.pathname.replace(/\/+$/, ""));
    const target = normalizePage(path);
    return current === target || (current === "" && target === "index.html");
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

  function getTheme() {
    return localStorage.getItem("evaraos-theme") || "dark";
  }

  function setTheme(theme) {
    localStorage.setItem("evaraos-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    syncThemeLabel();
  }

  function syncThemeLabel() {
    const label = document.querySelector("[data-theme-label]");
    if (!label) return;
    label.textContent = getTheme() === "light" ? "Light mode" : "Dark mode";
  }

  function navHaptic(ms = 8) {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  function getVisibleLinks() {
    const role = getRole();

    const common = [
      { page: "index.html", label: "Home", icon: "⌂" },
      { page: "settings.html", label: "Settings", icon: "⚙︎" }
    ];

    const guestOnly = [
      { page: "login.html", label: "Login", icon: "⇥" },
      { page: "signup.html", label: "Sign Up", icon: "✚" },
      { page: "reset.html", label: "Reset", icon: "↺" }
    ];

    const ownerOnly = [
      { page: "dashboard.html", label: "Dashboard", icon: "◫" },
      { page: "companies.html", label: "Companies", icon: "▣" },
      { page: "users.html", label: "Users", icon: "◉" },
      { page: "leads.html", label: "Leads", icon: "⌁" },
      { page: "jobs.html", label: "Jobs", icon: "✓" },
      { page: "qa.html", label: "QA", icon: "◎" }
    ];

    return role === "owner" ? [...common, ...ownerOnly] : [...common, ...guestOnly];
  }

  function navLink(page, label, icon) {
    const href = buildHref(page);
    const active = isCurrentPage(page) ? " active" : "";
    return `
      <a href="${href}" class="eva-link${active}" data-menu-link="${href}" data-label="${label.toLowerCase()}">
        <span class="eva-link-icon">${icon}</span>
        <span class="eva-link-label">${label}</span>
      </a>
    `;
  }

  function renderNav() {
    const mount = document.getElementById("universalNavRoot");
    if (!mount) return;

    const links = getVisibleLinks()
      .map((item) => navLink(item.page, item.label, item.icon))
      .join("");

    mount.innerHTML = `
      <div class="eva-nav-layer">
        <header class="eva-nav-shell compact" id="evaNavShell">
          <div class="eva-nav-pill glass-shell" id="evaNavPill">
            <a href="${buildHref("index.html")}" class="eva-brand" id="evaBrandLink" aria-label="Go home">
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
        </header>

        <div class="eva-backdrop" id="evaBackdrop"></div>

        <div class="eva-menu-panel" id="evaMenuPanel">
          <label class="eva-search">
            <span>⌕</span>
            <input type="text" id="evaSearchInput" placeholder="Search pages" />
          </label>

          <nav class="eva-links" id="evaLinks" aria-label="Main navigation">
            ${links}
          </nav>

          <div class="eva-divider"></div>

          <div class="eva-quick">
            <button type="button" class="eva-chip" id="evaThemeToggle">
              <span class="eva-chip-row">
                <span class="eva-chip-dot"></span>
                <span data-theme-label>Dark mode</span>
              </span>
            </button>

            <a href="${buildHref("settings.html")}" class="eva-link" data-menu-link="${buildHref("settings.html")}" data-label="advanced settings">
              <span class="eva-link-icon">⚙︎</span>
              <span class="eva-link-label">Advanced settings</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function getMenuZone() {
    return document.getElementById("evaMenuZone");
  }

  function getMenuBtn() {
    return document.getElementById("evaMenuBtn");
  }

  function getMenuPanel() {
    return document.getElementById("evaMenuPanel");
  }

  function getNavShell() {
    return document.getElementById("evaNavShell");
  }

  function getBrandLink() {
    return document.getElementById("evaBrandLink");
  }

  function applyProgress(value) {
    const shell = getNavShell();
    if (!shell) return;
    progress = Math.max(0, Math.min(1, value));
    shell.style.setProperty("--nav-progress", progress.toFixed(4));

    if (progress <= 0.08) {
      shell.classList.add("compact");
      shell.classList.remove("expanded");
    } else {
      shell.classList.remove("compact");
      shell.classList.add("expanded");
    }
  }

  function expandNav() {
    const wasCompact = progress <= 0.08;
    applyProgress(1);
    if (wasCompact) navHaptic(8);
  }

  function compactNav() {
    const wasExpanded = progress > 0.08;
    applyProgress(0);
    if (wasExpanded) navHaptic(6);
  }

  function openMenu() {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    if (!zone || !btn) return;
    document.body.classList.add("nav-menu-open");
    zone.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    expandNav();
  }

  function closeMenu() {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    if (!zone || !btn) return;
    document.body.classList.remove("nav-menu-open");
    zone.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    navHaptic(6);
  }

  function bindBrandLink() {
    const brand = getBrandLink();
    if (!brand) return;

    brand.addEventListener("click", (event) => {
      if (progress <= 0.08) {
        event.preventDefault();
        event.stopPropagation();
        expandNav();
      }
    });
  }

  function bindLinks() {
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

  function bindThemeToggle() {
    const toggle = document.getElementById("evaThemeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTheme(getTheme() === "light" ? "dark" : "light");
    });
  }

  function bindSearch() {
    const input = document.getElementById("evaSearchInput");
    const