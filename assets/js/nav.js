(function () {
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
    return `<a href="${href}" class="menu-link${active}" data-menu-link="${href}" data-label="${label.toLowerCase()}">${label}</a>`;
  }

  function renderNav() {
    const mount = document.getElementById("universalNav");
    if (!mount) return;

    const links = getVisibleLinks().map((item) => navLink(item.page, item.label)).join("");

    mount.innerHTML = `
      <header class="landing-header universal-nav-shell" id="floatingNavShell">
        <div class="landing-header-inner glass-shell">
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
                <span>⌕</span>
                <input type="text" id="navSearchInput" placeholder="Search pages" />
              </label>

              <nav class="nav-dropdown-links" id="navLinksList" aria-label="Main navigation">
                ${links}
              </nav>

              <div class="menu-divider"></div>

              <div class="menu-quick-row">
                <button type="button" class="quick-chip" id="quickThemeToggle">
                  <span class="quick-chip-text">
                    <span class="quick-chip-dot"></span>
                    <span data-theme-label>Dark mode</span>
                  </span>
                </button>

                <a href="${buildHref("settings.html")}" class="menu-link" data-menu-link="${buildHref("settings.html")}" data-label="advanced settings">
                  Advanced settings
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  function openMenu() {
    const dropdown = document.getElementById("siteNavDropdown");
    const toggle = document.getElementById("siteNavToggle");
    document.body.classList.add("nav-menu-open");
    if (!dropdown || !toggle) return;
    dropdown.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    const dropdown = document.getElementById("siteNavDropdown");
    const toggle = document.getElementById("siteNavToggle");
    document.body.classList.remove("nav-menu-open");
    if (!dropdown || !toggle) return;
    dropdown.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
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
    const toggle = document.getElementById("quickThemeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTheme(getTheme() === "light" ? "dark" : "light");
    });
  }

  function bindSearch() {
    const input = document.getElementById("navSearchInput");
    const links = Array.from(document.querySelectorAll("#navLinksList .menu-link"));
    if (!input) return;

    input.addEventListener("input", () => {
      const value = input.value.trim().toLowerCase();
      links.forEach((link) => {
        const label = (link.getAttribute("data-label") || "").toLowerCase();
        link.style.display = !value || label.includes(value) ? "" : "none";
      });
    });
  }

  function bindMenu() {
    const shell = document.getElementById("floatingNavShell");
    const dropdown = document.getElementById("siteNavDropdown");
    const toggle = document.getElementById("siteNavToggle");
    const menu = document.getElementById("siteNavMenu");
    const backdrop = document.getElementById("siteNavBackdrop");

    if (!shell || !dropdown || !toggle || !menu || !backdrop) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      shell.classList.remove("nav-compact");

      if (dropdown.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    backdrop.addEventListener("click", () => {
      closeMenu();
    });

    shell.addEventListener("click", () => {
      shell.classList.remove("nav-compact");
    });

    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target)) {
        closeMenu();
      }
    });
  }

  function bindScrollCompact() {
    const shell = document.getElementById("floatingNavShell");
    if (!shell) return;

    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const goingDown = y > lastY + 2;
      const goingUp = y < lastY - 2;

      if (goingDown && y > 80) {
        shell.classList.add("nav-compact");
      } else if (goingUp || y < 36) {
        shell.classList.remove("nav-compact");
      }

      lastY = y;
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  function init() {
    document.documentElement.setAttribute("data-theme", getTheme());
    renderNav();
    bindMenu();
    bindLinks();
    bindThemeToggle();
    bindSearch();
    bindScrollCompact();
    syncThemeLabel();
  }

  document.addEventListener("DOMContentLoaded", init);
})();