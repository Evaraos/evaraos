(function () {
  let tripleTapCount = 0;
  let tripleTapTimer = null;
  let progress = 0;
  let targetProgress = 0;
  let lastY = window.scrollY;
  let compactTimer = null;
  let rafId = null;
  let navPinnedOpen = false;

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

  function clearCompactTimer() {
    if (compactTimer) {
      clearTimeout(compactTimer);
      compactTimer = null;
    }
  }

  function atTopOfPage() {
    return window.scrollY <= 4;
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

  function setTarget(value) {
    targetProgress = Math.max(0, Math.min(1, value));
  }

  function expandNav(pin = false) {
    clearCompactTimer();
    if (pin) navPinnedOpen = true;
    setTarget(1);
  }

  function compactNav(unpin = false) {
    if (unpin) navPinnedOpen = false;

    if (atTopOfPage() && !document.body.classList.contains("nav-menu-open")) {
      setTarget(1);
      return;
    }
    setTarget(0);
  }

  function scheduleCompact(delay = 3000) {
    clearCompactTimer();
    if (document.body.classList.contains("nav-menu-open")) return;
    if (atTopOfPage()) return;
    if (navPinnedOpen) return;

    compactTimer = setTimeout(() => {
      if (
        !document.body.classList.contains("nav-menu-open") &&
        !atTopOfPage() &&
        !navPinnedOpen
      ) {
        compactNav();
      }
    }, delay);
  }

  function openMenu() {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    if (!zone || !btn) return;
    document.body.classList.add("nav-menu-open");
    zone.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    expandNav(true);
  }

  function closeMenu(shouldCompact = true) {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    if (!zone || !btn) return;
    document.body.classList.remove("nav-menu-open");
    zone.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");

    if (shouldCompact) {
      navPinnedOpen = false;
      if (atTopOfPage()) {
        setTarget(1);
      } else {
        setTarget(0);
      }
    }
  }

  function bindBrandLink() {
    const brand = getBrandLink();
    if (!brand) return;

    brand.addEventListener("click", (event) => {
      if (progress <= 0.08) {
        event.preventDefault();
        event.stopPropagation();
        expandNav(true);
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
        closeMenu(false);
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

  function toggleQuickMode() {
    const panel = getMenuPanel();
    if (!panel) return;
    panel.classList.toggle("quick-mode");
  }

  function bindTripleTap() {
    const btn = getMenuBtn();
    if (!btn) return;

    btn.addEventListener("click", () => {
      tripleTapCount += 1;
      clearTimeout(tripleTapTimer);

      tripleTapTimer = setTimeout(() => {
        tripleTapCount = 0;
      }, 350);

      if (tripleTapCount === 3) {
        toggleQuickMode();
        tripleTapCount = 0;
        clearTimeout(tripleTapTimer);
      }
    });
  }

  function bindMenu() {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    const panel = getMenuPanel();
    const backdrop = document.getElementById("evaBackdrop");
    const pill = document.getElementById("evaNavPill");

    if (!zone || !btn || !panel || !backdrop || !pill) return;

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (document.body.classList.contains("nav-menu-open")) {
        closeMenu(true);
      } else {
        openMenu();
      }
    });

    pill.addEventListener("click", (event) => {
      if (event.target.closest("#evaMenuBtn")) return;

      if (progress <= 0.08) {
        event.preventDefault();
        expandNav(true);
        return;
      }

      if (!document.body.classList.contains("nav-menu-open") && !atTopOfPage()) {
        event.preventDefault();
        navPinnedOpen = false;
        compactNav(true);
      }
    });

    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    backdrop.addEventListener("click", () => {
      closeMenu(true);
    });

    document.addEventListener("click", (event) => {
      if (!zone.contains(event.target) && !panel.contains(event.target)) {
        if (document.body.classList.contains("nav-menu-open")) {
          closeMenu(true);
        }
      }
    });
  }

  function bindScrollBehavior() {
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        const dy = y - lastY;

        if (!document.body.classList.contains("nav-menu-open")) {
          if (atTopOfPage()) {
            navPinnedOpen = false;
            setTarget(1);
            clearCompactTimer();
          } else if (dy < -0.25) {
            const boost = Math.min(0.16, Math.abs(dy) / 220);
            navPinnedOpen = false;
            setTarget(Math.min(1, targetProgress + boost));
            scheduleCompact(3000);
          } else if (dy > 0.25) {
            const drop = Math.min(0.14, Math.abs(dy) / 220);
            navPinnedOpen = false;
            setTarget(Math.max(0, targetProgress - drop));
            scheduleCompact(180);
          } else if (!navPinnedOpen) {
            scheduleCompact(3000);
          }
        }

        lastY = y;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchend",
      () => {
        if (!document.body.classList.contains("nav-menu-open")) {
          if (atTopOfPage()) {
            navPinnedOpen = false;
            setTarget(1);
          } else if (!navPinnedOpen) {
            scheduleCompact(3000);
          }
        }
      },
      { passive: true }
    );
  }

  function animate() {
    const diff = targetProgress - progress;
    const next = Math.abs(diff) < 0.0015 ? targetProgress : progress + diff * 0.09;
    applyProgress(next);
    rafId = requestAnimationFrame(animate);
  }

  function init() {
    document.documentElement.setAttribute("data-theme", getTheme());
    renderNav();
    bindBrandLink();
    bindMenu();
    bindLinks();
    bindThemeToggle();
    bindSearch();
    bindTripleTap();
    targetProgress = atTopOfPage() ? 1 : 0;
    applyProgress(targetProgress);
    bindScrollBehavior();
    syncThemeLabel();
    animate();
  }

  document.addEventListener("DOMContentLoaded", init);
})();