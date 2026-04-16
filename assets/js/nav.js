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
    return `<a href="${href}" class="eva-link${active}" data-menu-link="${href}" data-label="${label.toLowerCase()}">${label}</a>`;
  }

  function renderNav() {
    const mount = document.getElementById("universalNavRoot");
    if (!mount) return;

    const links = getVisibleLinks().map((item) => navLink(item.page, item.label)).join("");

    mount.innerHTML = `
      <div class="eva-nav-layer">
        <header class="eva-nav-shell" id="evaNavShell">
          <div class="eva-nav-pill glass-shell">
            <a href="${buildHref("index.html")}" class="eva-brand" aria-label="Go home">
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

              <div class="eva-backdrop" id="evaBackdrop"></div>

              <div class="eva-menu" id="evaMenu">
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
                    Advanced settings
                  </a>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>
    `;
  }

  function openMenu() {
    const zone = document.getElementById("evaMenuZone");
    const btn = document.getElementById("evaMenuBtn");
    document.body.classList.add("nav-menu-open");
    if (!zone || !btn) return;
    zone.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    const zone = document.getElementById("evaMenuZone");
    const btn = document.getElementById("evaMenuBtn");
    document.body.classList.remove("nav-menu-open");
    if (!zone || !btn) return;
    zone.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
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
    const links = Array.from(document.querySelectorAll("#evaLinks .eva-link"));
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
    const shell = document.getElementById("evaNavShell");
    const zone = document.getElementById("evaMenuZone");
    const btn = document.getElementById("evaMenuBtn");
    const menu = document.getElementById("evaMenu");
    const backdrop = document.getElementById("evaBackdrop");

    if (!shell || !zone || !btn || !menu || !backdrop) return;

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      shell.classList.remove("compact");

      if (zone.classList.contains("open")) {
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
      shell.classList.remove("compact");
    });

    document.addEventListener("click", (event) => {
      if (!zone.contains(event.target)) {
        closeMenu();
      }
    });
  }

  function bindScrollCompact() {
    const shell = document.getElementById("evaNavShell");
    if (!shell) return;

    let lastY = window.scrollY;
    let targetCompact = false;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY;

      if (y < 24) {
        targetCompact = false;
      } else if (delta > 1) {
        targetCompact = true;
      } else if (delta < -1) {
        targetCompact = false;
      }

      shell.classList.toggle("compact", targetCompact);

      lastY = y;
      ticking = false;
    }

    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
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