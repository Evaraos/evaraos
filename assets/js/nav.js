(function () {
  let tripleTapCount = 0;
  let tripleTapTimer = null;
  let progress = 0;
  let targetProgress = 0;
  let lastY = window.scrollY;
  let lastScrollDirection = 0;
  let compactTimer = null;
  let scrollSettleTimer = null;
  let rafId = null;
  let navPinnedOpen = false;
  let motionMode = "scroll";
  let hasBootAnimated = false;

  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;
  let tapHandled = false;

  let lockedScrollY = 0;
  let longLoaderTimer = null;

  function getMount() {
    return document.getElementById("universalNavRoot") || document.getElementById("universalNav");
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

  function normalizePage(path) {
    return path.split("/").pop() || "index.html";
  }

  function isCurrentPage(path) {
    const current = normalizePage(window.location.pathname.replace(/\/+$/, ""));
    const target = normalizePage(path);
    return current === target || (current === "" && target === "index.html");
  }

  function getStoredUser() {
    try {
      const raw =
        localStorage.getItem("evaraos-user") ||
        sessionStorage.getItem("evaraos-user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    const user = getStoredUser();
    return Boolean(user && (user.uid || user.email));
  }

  function getRole() {
    const user = getStoredUser();
    if (!user) return "guest";
    return String(user.role || "guest").toLowerCase();
  }

  function getDisplayName() {
    const user = getStoredUser();
    if (!user) return "Profile";
    return user.displayName || user.fullName || user.username || user.email || "Profile";
  }

  function getAppearanceTheme() {
    try {
      const raw = localStorage.getItem("evaraos-appearance");
      if (raw) {
        const appearance = JSON.parse(raw);
        if (appearance.mode === "light") return "light";
        if (appearance.mode === "galaxy") return "galaxy";
        if (appearance.mode === "custom") {
          if (appearance.baseFamily === "light") return "light";
          if (appearance.baseFamily === "galaxy") return "galaxy";
          return "dark";
        }
      }
    } catch {}

    const docTheme = document.documentElement.getAttribute("data-theme");
    if (docTheme === "light" || docTheme === "galaxy") return docTheme;
    return "dark";
  }

  function setTheme(theme) {
    const safe = theme === "light" || theme === "galaxy" ? theme : "dark";
    document.documentElement.setAttribute("data-theme", safe);
    syncThemeLabel();
  }

  function syncThemeLabel() {
    const label = document.querySelector("[data-theme-label]");
    if (!label) return;

    const theme = getAppearanceTheme();
    if (theme === "light") {
      label.textContent = "Light mode";
    } else if (theme === "galaxy") {
      label.textContent = "Galaxy mode";
    } else {
      label.textContent = "Dark mode";
    }
  }

  function navHaptic(ms = 10) {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  function isCompact() {
    return progress <= 0.08;
  }

  function ensureLoaderSystem() {
    let micro = document.getElementById("evaraMicroLoader");
    let full = document.getElementById("evaraGlobalLoader");

    if (!micro) {
      micro = document.createElement("div");
      micro.id = "evaraMicroLoader";
      micro.className = "evara-micro-loader";
      micro.setAttribute("aria-hidden", "true");
      micro.innerHTML = `
        <div class="evara-micro-loader__orb">
          <img
            src="${getBasePath()}/assets/img/evaraos_logo.png"
            alt="Evaraos"
            class="evara-micro-loader__logo"
            onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
          />
          <span class="evara-micro-loader__pulse"></span>
          <span class="evara-micro-loader__sheen"></span>
        </div>
      `;
      document.body.appendChild(micro);
    }

    if (!full) {
      full = document.createElement("div");
      full.id = "evaraGlobalLoader";
      full.className = "evara-global-loader";
      full.setAttribute("aria-hidden", "true");
      full.innerHTML = `
        <div class="evara-loader-backdrop"></div>
        <div class="evara-loader-box glass-card">
          <div class="evara-loader-mark evara-loader-mark--premium">
            <span class="evara-loader-ring"></span>
            <span class="evara-loader-ring2"></span>
            <span class="evara-loader-ring3"></span>
            <span class="evara-loader-particle evara-loader-particle--a"></span>
            <span class="evara-loader-particle evara-loader-particle--b"></span>
            <span class="evara-loader-particle evara-loader-particle--c"></span>

            <div class="evara-loader-logo-wrap evara-loader-logo-wrap--premium">
              <img
                src="${getBasePath()}/assets/img/evaraos_logo.png"
                alt="Evaraos"
                class="evara-loader-logo evara-loader-logo--premium"
                onerror="this.onerror=null;this.src='${getBasePath()}/assets/logo.png';"
              />
              <span class="evara-loader-logo-glow"></span>
            </div>
          </div>

          <div class="evara-loader-copy">
            <p class="evara-loader-title" id="evaraLoaderTitle">Launching Evaraos</p>
            <p class="evara-loader-subtitle" id="evaraLoaderSubtitle">Loading navigation, theme, and experience.</p>
          </div>

          <div class="evara-loader-dots" aria-hidden="true">
            <span class="evara-loader-dot"></span>
            <span class="evara-loader-dot"></span>
            <span class="evara-loader-dot"></span>
          </div>
        </div>
      `;
      document.body.appendChild(full);
    }

    return { micro, full };
  }

  function clearLongLoaderTimer() {
    if (longLoaderTimer) {
      window.clearTimeout(longLoaderTimer);
      longLoaderTimer = null;
    }
  }

  function showMicroLoader() {
    const { micro } = ensureLoaderSystem();
    micro.classList.add("active");
    micro.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
  }

  function hideMicroLoader() {
    const micro = document.getElementById("evaraMicroLoader");
    if (micro) {
      micro.classList.remove("active");
      micro.setAttribute("aria-hidden", "true");
    }
  }

  function showFullLoader({
    title = "Opening Evaraos",
    subtitle = "Preparing your next screen."
  } = {}) {
    const { full } = ensureLoaderSystem();
    const titleEl = full.querySelector("#evaraLoaderTitle");
    const subtitleEl = full.querySelector("#evaraLoaderSubtitle");

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;

    hideMicroLoader();
    full.classList.add("active");
    full.setAttribute("aria-hidden", "false");
    document.body.classList.add("app-loading");
  }

  function hideFullLoader() {
    const full = document.getElementById("evaraGlobalLoader");
    if (full) {
      full.classList.remove("active");
      full.setAttribute("aria-hidden", "true");
    }
  }

  function hideAllLoaders() {
    clearLongLoaderTimer();
    hideMicroLoader();
    hideFullLoader();
    document.body.classList.remove("app-loading");
  }

  function beginSmartLoader({
    title = "Opening Evaraos",
    subtitle = "Preparing your next screen."
  } = {}) {
    showMicroLoader();
    clearLongLoaderTimer();

    longLoaderTimer = window.setTimeout(() => {
      showFullLoader({ title, subtitle });
    }, 260);
  }

  function navigateWithLoader(href, options = {}) {
    if (!href) return;
    beginSmartLoader(options);
    window.setTimeout(() => {
      window.location.assign(href);
    }, 90);
  }

  function getVisibleLinks() {
    const role = getRole();
    const authed = isAuthenticated();

    const common = [
      { page: "index.html", label: "Home", icon: "⌂" }
    ];

    const guestMain = [
      { page: "login.html", label: "Login", icon: "⇥" },
      { page: "signup.html", label: "Sign Up", icon: "✚" },
      { page: "reset.html", label: "Reset", icon: "↺" }
    ];

    const authedMain = [
      { page: "dashboard.html", label: "Profile", icon: "◉" },
      { page: "settings.html", label: "Settings", icon: "⚙︎" }
    ];

    const ownerOnly = [
      { page: "companies.html", label: "Companies", icon: "▣" },
      { page: "users.html", label: "Users", icon: "◉" },
      { page: "leads.html", label: "Leads", icon: "⌁" },
      { page: "jobs.html", label: "Jobs", icon: "✓" },
      { page: "qa.html", label: "QA", icon: "◎" }
    ];

    const main = authed
      ? [...common, ...authedMain, ...(role === "owner" ? ownerOnly : [])]
      : [...common, ...guestMain];

    return {
      main,
      authed,
      role,
      displayName: getDisplayName()
    };
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
    const mount = getMount();
    if (!mount) return;

    const groups = getVisibleLinks();
    const mainLinks = groups.main.map((item) => navLink(item.page, item.label, item.icon)).join("");

    const utilityLinks = groups.authed
      ? `
        <button type="button" class="eva-chip" id="evaLogoutBtn">
          <span class="eva-chip-row">
            <span class="eva-chip-dot"></span>
            <span>Logout</span>
          </span>
        </button>
      `
      : "";

    mount.innerHTML = `
      <div class="eva-nav-layer">
        <header class="eva-nav-shell ${atTopOfPage() ? "expanded" : "compact"}" id="evaNavShell">
          <div class="eva-nav-pill glass-shell" id="evaNavPill">
            <a
              href="${buildHref("index.html")}"
              class="eva-brand"
              id="evaBrandBlock"
              data-home-link="${buildHref("index.html")}"
              aria-label="Go to Home"
            >
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
            ${mainLinks}
          </nav>

          <div class="eva-divider"></div>

          <div class="eva-quick" id="evaAuthLinks">
            ${utilityLinks}
          </div>

          <div class="eva-divider"></div>

          <div class="eva-quick">
            <button type="button" class="eva-chip" id="evaThemeToggle">
              <span class="eva-chip-row">
                <span class="eva-chip-dot"></span>
                <span data-theme-label>Dark mode</span>
              </span>
            </button>
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

  function getBrandBlock() {
    return document.getElementById("evaBrandBlock");
  }

  function getNavPill() {
    return document.getElementById("evaNavPill");
  }

  function clearCompactTimer() {
    if (compactTimer) {
      clearTimeout(compactTimer);
      compactTimer = null;
    }
  }

  function clearScrollSettleTimer() {
    if (scrollSettleTimer) {
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = null;
    }
  }

  function atTopOfPage() {
    return window.scrollY <= 4;
  }

  function atBottomOfPage() {
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    return scrollBottom >= docHeight - 4;
  }

  function applyProgress(value) {
    const shell = getNavShell();
    const brand = getBrandBlock();
    if (!shell) return;

    progress = Math.max(0, Math.min(1, value));
    shell.style.setProperty("--nav-progress", progress.toFixed(4));

    const compact = progress <= 0.08;
    shell.classList.toggle("compact", compact);
    shell.classList.toggle("expanded", !compact);

    if (brand) {
      if (compact) {
        brand.setAttribute("aria-disabled", "true");
        brand.setAttribute("tabindex", "-1");
        brand.style.pointerEvents = "none";
      } else {
        brand.removeAttribute("aria-disabled");
        brand.setAttribute("tabindex", "0");
        brand.style.pointerEvents = "auto";
      }
    }
  }

  function setTarget(value, mode = "scroll") {
    targetProgress = Math.max(0, Math.min(1, value));
    motionMode = mode;
  }

  function expandNav(pin = false, mode = "tap") {
    clearCompactTimer();
    if (pin) navPinnedOpen = true;
    setTarget(1, mode);
    navHaptic(10);
  }

  function compactNav(unpin = false, mode = "scroll") {
    if (unpin) navPinnedOpen = false;

    if (atTopOfPage() && !document.body.classList.contains("nav-menu-open")) {
      setTarget(1, mode);
      return;
    }
    setTarget(0, mode);
    navHaptic(8);
  }

  function scheduleCompact(delay = 4200) {
    clearCompactTimer();
    if (document.body.classList.contains("nav-menu-open")) return;
    if (atTopOfPage()) return;

    compactTimer = setTimeout(() => {
      if (!document.body.classList.contains("nav-menu-open") && !atTopOfPage()) {
        navPinnedOpen = false;
        compactNav(false, "tap");
      }
    }, delay);
  }

  function settleAfterScroll() {
    clearScrollSettleTimer();
    scrollSettleTimer = setTimeout(() => {
      if (document.body.classList.contains("nav-menu-open")) return;

      if (atTopOfPage()) {
        navPinnedOpen = false;
        setTarget(1, "scroll");
        return;
      }

      if (atBottomOfPage()) {
        navPinnedOpen = false;
        setTarget(0, "scroll");
        return;
      }

      if (lastScrollDirection < 0) {
        navPinnedOpen = true;
        setTarget(1, "scroll");
        scheduleCompact(3800);
        return;
      }

      navPinnedOpen = false;
      setTarget(0, "scroll");
    }, 90);
  }

  function lockBodyScroll() {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }

  function unlockBodyScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    window.scrollTo(0, lockedScrollY);
  }

  function updateMenuViewportFit() {
    const panel = getMenuPanel();
    if (!panel) return;

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const topInset = 6;
    const menuTop = window.innerWidth <= 480 ? 66 : 74;
    const bottomInset = 12;

    const maxHeight = Math.max(260, viewportHeight - menuTop - bottomInset);
    panel.style.setProperty("--eva-menu-max-height", `${maxHeight}px`);

    const top = `calc(max(${topInset}px, env(safe-area-inset-top)) + ${menuTop}px)`;
    panel.style.top = top;
  }

  function openMenu() {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    if (!zone || !btn) return;

    updateMenuViewportFit();
    lockBodyScroll();

    document.body.classList.add("nav-menu-open");
    zone.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    expandNav(true, "tap");
  }

  function closeMenu(shouldCompact = true) {
    const zone = getMenuZone();
    const btn = getMenuBtn();
    if (!zone || !btn) return;

    document.body.classList.remove("nav-menu-open");
    zone.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    unlockBodyScroll();
    navHaptic(8);

    if (shouldCompact) {
      navPinnedOpen = false;
      if (atTopOfPage()) {
        setTarget(1, "tap");
      } else {
        setTarget(0, "tap");
      }
    }
  }

  function togglePill(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (document.body.classList.contains("nav-menu-open")) return;

    if (isCompact()) {
      expandNav(true, "tap");
      scheduleCompact(4200);
      return;
    }

    if (!atTopOfPage()) {
      navPinnedOpen = false;
      compactNav(true, "tap");
    }
  }

  function bindTapToggle() {
    const pill = getNavPill();
    const menuBtn = getMenuBtn();
    if (!pill || !menuBtn) return;

    function onTouchStart(event) {
      if (event.target.closest("#evaMenuBtn")) return;
      if (event.target.closest("#evaBrandBlock")) return;
      const touch = event.touches ? event.touches[0] : event;
      tapStartX = touch.clientX;
      tapStartY = touch.clientY;
      tapMoved = false;
      tapHandled = false;
    }

    function onTouchMove(event) {
      if (event.target.closest("#evaMenuBtn")) return;
      if (event.target.closest("#evaBrandBlock")) return;
      const touch = event.touches ? event.touches[0] : event;
      const dx = Math.abs(touch.clientX - tapStartX);
      const dy = Math.abs(touch.clientY - tapStartY);
      if (dx > 10 || dy > 10) {
        tapMoved = true;
      }
    }

    function onTouchEnd(event) {
      if (event.target.closest("#evaMenuBtn")) return;
      if (event.target.closest("#evaBrandBlock")) return;
      if (tapMoved || tapHandled) return;
      tapHandled = true;
      togglePill(event);
    }

    pill.addEventListener("touchstart", onTouchStart, { passive: true });
    pill.addEventListener("touchmove", onTouchMove, { passive: true });
    pill.addEventListener("touchend", onTouchEnd);

    pill.addEventListener("click", (event) => {
      if (event.target.closest("#evaMenuBtn")) return;
      if (event.target.closest("#evaBrandBlock")) return;
      if (tapHandled) {
        tapHandled = false;
        return;
      }
      togglePill(event);
    });
  }

  function bindBrandHome() {
    const brand = getBrandBlock();
    if (!brand) return;

    brand.addEventListener("click", (event) => {
      if (isCompact()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      navHaptic(10);
      const href = brand.getAttribute("data-home-link");
      navigateWithLoader(href, {
        title: "Opening Home",
        subtitle: "Loading the Evaraos home experience."
      });
    });

    brand.addEventListener("keydown", (event) => {
      if (isCompact()) {
        event.preventDefault();
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const href = brand.getAttribute("data-home-link");
        navigateWithLoader(href, {
          title: "Opening Home",
          subtitle: "Loading the Evaraos home experience."
        });
      }
    });
  }

  function bindLinks() {
    document.querySelectorAll("[data-menu-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        navHaptic(8);
        const href = link.getAttribute("data-menu-link");
        if (!href) return;
        closeMenu(false);
        navigateWithLoader(href, {
          title: "Loading page",
          subtitle: "Preparing your next screen."
        });
      });
    });

    const logoutBtn = document.getElementById("evaLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        try {
          localStorage.removeItem("evaraos-user");
          localStorage.removeItem("evaraos-role");
          sessionStorage.removeItem("evaraos-user");
          sessionStorage.removeItem("evaraos-role");
        } catch {}

        closeMenu(false);
        navigateWithLoader(buildHref("login.html"), {
          title: "Signing out",
          subtitle: "Clearing local session and returning to login."
        });
      });
    }
  }

  function bindThemeToggle() {
    const toggle = document.getElementById("evaThemeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const current = getAppearanceTheme();
      const next = current === "light" ? "dark" : "light";

      try {
        const raw = localStorage.getItem("evaraos-appearance");
        if (raw) {
          const appearance = JSON.parse(raw);
          appearance.mode = next;
          appearance.baseFamily = next;
          localStorage.setItem("evaraos-appearance", JSON.stringify(appearance));
        }
      } catch {}

      setTheme(next);
    });
  }

  function bindSearch() {
    const input = document.getElementById("evaSearchInput");
    const links = Array.from(document.querySelectorAll("#evaLinks .eva-link, #evaAuthLinks .eva-link"));
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
    navHaptic(10);
    updateMenuViewportFit();
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

    if (!zone || !btn || !panel || !backdrop) return;

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      navHaptic(10);

      if (document.body.classList.contains("nav-menu-open")) {
        closeMenu(true);
      } else {
        openMenu();
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

    window.addEventListener("resize", () => {
      if (document.body.classList.contains("nav-menu-open")) {
        updateMenuViewportFit();
      }
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        if (document.body.classList.contains("nav-menu-open")) {
          updateMenuViewportFit();
        }
      });
    }
  }

  function bindScrollBehavior() {
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        const dy = y - lastY;

        if (!document.body.classList.contains("nav-menu-open")) {
          clearCompactTimer();

          if (Math.abs(dy) > 0.05) {
            lastScrollDirection = dy < 0 ? -1 : 1;
          }

          if (atTopOfPage()) {
            navPinnedOpen = false;
            setTarget(1, "scroll");
          } else if (atBottomOfPage()) {
            navPinnedOpen = false;
            setTarget(0, "scroll");
          } else {
            const sensitivity = 0.024;
            const next = Math.max(0, Math.min(1, targetProgress - dy * sensitivity));
            setTarget(next, "scroll");
          }

          settleAfterScroll();
        }

        lastY = y;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchend",
      () => {
        if (!document.body.classList.contains("nav-menu-open")) {
          settleAfterScroll();
        }
      },
      { passive: true }
    );
  }

  function animate() {
    const diff = targetProgress - progress;
    const factor = motionMode === "tap" ? 0.16 : 0.11;
    const next = Math.abs(diff) < 0.0006 ? targetProgress : progress + diff * factor;
    applyProgress(next);
    rafId = requestAnimationFrame(animate);
  }

  function bootLoaderPulse() {
    if (hasBootAnimated) return;
    hasBootAnimated = true;

    beginSmartLoader({
      title: "Launching Evaraos",
      subtitle: "Loading navigation, theme, and experience."
    });

    window.setTimeout(() => {
      hideAllLoaders();
    }, 620);
  }

  function init() {
    setTheme(getAppearanceTheme());
    renderNav();

    const shell = getNavShell();
    const immediate = atTopOfPage() ? 1 : 0;
    progress = immediate;
    targetProgress = immediate;

    if (shell) {
      shell.style.setProperty("--nav-progress", immediate.toFixed(4));
      shell.classList.toggle("expanded", immediate === 1);
      shell.classList.toggle("compact", immediate !== 1);
    }

    applyProgress(immediate);

    bindTapToggle();
    bindBrandHome();
    bindMenu();
    bindLinks();
    bindThemeToggle();
    bindSearch();
    bindTripleTap();
    bindScrollBehavior();
    syncThemeLabel();
    animate();
    bootLoaderPulse();

    window.addEventListener("pageshow", () => {
      setTheme(getAppearanceTheme());
      hideAllLoaders();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();