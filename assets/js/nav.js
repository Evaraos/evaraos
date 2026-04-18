(function () {
  const root = document.getElementById("universalNavRoot") || document.getElementById("universalNav");
  if (!root) return;

  const path = window.location.pathname;
  const isHome =
    path.endsWith("/index.html") ||
    path === "/evaraos/" ||
    path === "/evaraos";
  const isAuthPage =
    path.endsWith("/login.html") ||
    path.endsWith("/signup.html") ||
    path.endsWith("/reset.html");

  root.innerHTML = `
    <div class="eva-nav-layer">
      <div class="eva-backdrop" id="evaBackdrop"></div>

      <div class="eva-nav-shell compact" id="evaNavShell">
        <div class="eva-nav-pill glass-card" id="evaNavPill">
          <a href="/evaraos/index.html" class="eva-brand" id="evaBrand">
            <img
              src="/evaraos/assets/img/evaraos_logo.png"
              alt="Evaraos"
              class="eva-logo"
            />
            <span class="eva-brand-copy">
              <strong>Evaraos Inc</strong>
              <span>Subsidiaries Allocation SaaS</span>
            </span>
          </a>

          <div class="eva-menu-zone" id="evaMenuZone">
            <button class="eva-menu-btn" id="evaMenuBtn" type="button" aria-label="Open menu">
              <span class="eva-burger">
                <span class="eva-burger-line top"></span>
                <span class="eva-burger-line mid"></span>
                <span class="eva-burger-line bot"></span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="eva-menu-panel glass-card" id="evaMenuPanel">
        <label class="eva-search">
          <span>⌕</span>
          <input type="search" id="evaSearchInput" placeholder="Search pages" />
        </label>

        <div class="eva-links" id="evaMainLinks">
          <a class="eva-link" href="/evaraos/index.html">
            <span class="eva-link-label">Home</span>
            <span class="eva-link-icon">⌂</span>
          </a>

          <a class="eva-link" href="/evaraos/settings.html">
            <span class="eva-link-label">Settings</span>
            <span class="eva-link-icon">⚙</span>
          </a>
        </div>

        <div class="eva-links" id="evaAuthLinks"></div>

        <div class="eva-divider"></div>

        <div class="eva-links">
          <button class="eva-link" id="evaThemeToggle" type="button">
            <span class="eva-chip-row">
              <span class="eva-chip-dot"></span>
              <span id="evaThemeLabel">Dark mode</span>
            </span>
          </button>

          <button class="eva-link" id="evaQuickMode" type="button">
            <span class="eva-link-label">Advanced settings</span>
            <span class="eva-link-icon">⋯</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const navShell = document.getElementById("evaNavShell");
  const navPill = document.getElementById("evaNavPill");
  const brand = document.getElementById("evaBrand");
  const menuZone = document.getElementById("evaMenuZone");
  const menuBtn = document.getElementById("evaMenuBtn");
  const menuPanel = document.getElementById("evaMenuPanel");
  const backdrop = document.getElementById("evaBackdrop");
  const authLinks = document.getElementById("evaAuthLinks");
  const searchInput = document.getElementById("evaSearchInput");
  const quickModeBtn = document.getElementById("evaQuickMode");
  const themeToggle = document.getElementById("evaThemeToggle");
  const themeLabel = document.getElementById("evaThemeLabel");

  let menuOpen = false;
  let holdTimer = null;
  let closeTimer = null;
  let lastScrollY = window.scrollY;
  let manualOpen = false;

  function getSavedTheme() {
    return localStorage.getItem("evaraos-theme") || document.documentElement.getAttribute("data-theme") || "dark";
  }

  function applyThemeLabel() {
    const theme = getSavedTheme();
    themeLabel.textContent = theme === "light" ? "Light mode" : "Dark mode";
  }

  function setTheme(nextTheme) {
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("evaraos-theme", nextTheme);
    applyThemeLabel();
  }

  applyThemeLabel();

  themeToggle.addEventListener("click", () => {
    const current = getSavedTheme();
    const next = current === "light" ? "dark" : "light";
    setTheme(next);
  });

  quickModeBtn.addEventListener("click", () => {
    menuPanel.classList.toggle("quick-mode");
  });

  function setAuthLinks() {
    const isLoggedIn = !!localStorage.getItem("evaraos-user");
    if (isLoggedIn) {
      authLinks.innerHTML = `
        <a class="eva-link" href="/evaraos/login.html" id="evaLogoutLink">
          <span class="eva-link-label">Logout</span>
          <span class="eva-link-icon">⎋</span>
        </a>
      `;
      const logoutLink = document.getElementById("evaLogoutLink");
      if (logoutLink) {
        logoutLink.addEventListener("click", async (e) => {
          e.preventDefault();
          try {
            const mod = await import("/evaraos/assets/js/firebase.js");
            await mod.logout();
          } catch {
            localStorage.removeItem("evaraos-user");
            localStorage.removeItem("evaraos-role");
            window.location.replace("/evaraos/login.html");
          }
        });
      }
    } else {
      authLinks.innerHTML = `
        <a class="eva-link" href="/evaraos/login.html">
          <span class="eva-link-label">Login</span>
          <span class="eva-link-icon">→</span>
        </a>
        <a class="eva-link" href="/evaraos/signup.html">
          <span class="eva-link-label">Sign Up</span>
          <span class="eva-link-icon">＋</span>
        </a>
        <a class="eva-link" href="/evaraos/reset.html">
          <span class="eva-link-label">Reset</span>
          <span class="eva-link-icon">↺</span>
        </a>
      `;
    }

    if (isAuthPage) {
      authLinks.innerHTML = `
        <button class="eva-link" type="button" id="evaThemeOnly">
          <span class="eva-chip-row">
            <span class="eva-chip-dot"></span>
            <span>${getSavedTheme() === "light" ? "Light mode" : "Dark mode"}</span>
          </span>
        </button>
      `;
      const themeOnly = document.getElementById("evaThemeOnly");
      if (themeOnly) {
        themeOnly.addEventListener("click", () => {
          const current = getSavedTheme();
          const next = current === "light" ? "dark" : "light";
          setTheme(next);
          setAuthLinks();
        });
      }
    }
  }

  setAuthLinks();

  const searchableLinks = [
    { label: "Home", href: "/evaraos/index.html" },
    { label: "Settings", href: "/evaraos/settings.html" },
    { label: "Login", href: "/evaraos/login.html" },
    { label: "Sign Up", href: "/evaraos/signup.html" },
    { label: "Reset", href: "/evaraos/reset.html" },
    { label: "Dashboard", href: "/evaraos/dashboard.html" },
    { label: "Profile", href: "/evaraos/profile.html" },
    { label: "Companies", href: "/evaraos/companies.html" },
    { label: "Users", href: "/evaraos/users.html" },
    { label: "Leads", href: "/evaraos/leads.html" },
    { label: "Jobs", href: "/evaraos/jobs.html" }
  ];

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    const mainLinks = document.getElementById("evaMainLinks");

    if (!q) {
      mainLinks.innerHTML = `
        <a class="eva-link" href="/evaraos/index.html">
          <span class="eva-link-label">Home</span>
          <span class="eva-link-icon">⌂</span>
        </a>
        <a class="eva-link" href="/evaraos/settings.html">
          <span class="eva-link-label">Settings</span>
          <span class="eva-link-icon">⚙</span>
        </a>
      `;
      return;
    }

    const matches = searchableLinks.filter((item) => item.label.toLowerCase().includes(q));
    mainLinks.innerHTML = matches.length
      ? matches.map((item) => `
          <a class="eva-link" href="${item.href}">
            <span class="eva-link-label">${item.label}</span>
            <span class="eva-link-icon">→</span>
          </a>
        `).join("")
      : `<div class="eva-link"><span class="eva-link-label">No matches</span></div>`;
  });

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function clearTimers() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function openMenu() {
    menuOpen = true;
    menuZone.classList.add("open");
    document.body.classList.add("nav-menu-open");
    vibrate(10);
  }

  function closeMenu() {
    menuOpen = false;
    menuZone.classList.remove("open");
    document.body.classList.remove("nav-menu-open");
    vibrate(6);
  }

  function expandPill(options = {}) {
    const manual = !!options.manual;
    if (manual) manualOpen = true;

    navShell.classList.remove("compact");
    navShell.classList.add("expanded");

    clearTimers();

    closeTimer = setTimeout(() => {
      if (!menuOpen && !isHome && !manualOpen) {
        compactPill();
      }
      if (manualOpen) {
        manualOpen = false;
        compactPill();
      }
    }, manual ? 7000 : 4000);
  }

  function compactPill() {
    navShell.classList.remove("expanded");
    navShell.classList.add("compact");
  }

  function setTopBehavior() {
    if (window.scrollY <= 4) {
      navShell.classList.remove("compact");
      navShell.classList.add("expanded");
      return true;
    }
    return false;
  }

  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!menuOpen) {
      openMenu();
      expandPill({ manual: true });
    } else {
      closeMenu();
      if (!setTopBehavior()) compactPill();
    }
  });

  navPill.addEventListener("click", (e) => {
    if (e.target.closest(".eva-menu-btn")) return;
    if (e.target.closest(".eva-brand") && !isHome) return;
    expandPill({ manual: true });
  });

  backdrop.addEventListener("click", () => {
    closeMenu();
    if (!setTopBehavior()) compactPill();
  });

  document.addEventListener("click", (e) => {
    if (!menuPanel.contains(e.target) && !navPill.contains(e.target) && menuOpen) {
      closeMenu();
      if (!setTopBehavior()) compactPill();
    }
  });

  window.addEventListener("scroll", () => {
    if (menuOpen) return;

    if (setTopBehavior()) {
      lastScrollY = window.scrollY;
      return;
    }

    const currentY = window.scrollY;

    if (currentY < lastScrollY) {
      expandPill();
    } else if (currentY > lastScrollY) {
      manualOpen = false;
      compactPill();
    }

    lastScrollY = currentY;
  });

  if (!setTopBehavior()) {
    compactPill();
  }
})();