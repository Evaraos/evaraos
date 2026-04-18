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

  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;
  let tapHandled = false;

  let lockedScrollY = 0;

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
    return localStorage.getItem("evaraos-theme") || document.documentElement.getAttribute("data-theme") || "dark";
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

  function navHaptic(ms = 10) {
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

    const authLinks = [
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

    return {
      common,
      authLinks,
      ownerOnly,
      main: role === "owner" ? [...common, ...ownerOnly] : common
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
    const authLinks = groups.authLinks.map((item) => navLink(item.page, item.label, item.icon)).join("");

    mount.innerHTML = `
      <div class="eva-nav-layer">
        <header class="eva-nav-shell compact" id="evaNavShell">
          <div class="eva-nav-pill glass-shell" id="evaNavPill">
            <div class="eva-brand" id="evaBrandBlock" role="button" tabindex="0" aria-label="Toggle navigation pill">
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
            </div>

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
            ${authLinks}
          </div>

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

  function isCompact() {
    return progress <= 0.08;
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

  function scheduleCompact(delay = 7000) {
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
        scheduleCompact(4000);
        return;
      }

      navPinnedOpen = false;
      setTarget(0, "scroll");
    }, 110);
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
      scheduleCompact(7000);
      return;
    }

    if (!atTopOfPage()) {
      navPinnedOpen = false;
      compactNav(true, "tap");
    }
  }

  function bindTapToggle() {
    const pill = getNavPill();
    const brand = getBrandBlock();
    const menuBtn = getMenuBtn();
    if (!pill || !brand || !menuBtn) return;

    function onTouchStart(event) {
      if (event.target.closest("#evaMenuBtn")) return;
      const touch = event.touches ? event.touches[0] : event;
      tapStartX = touch.clientX;
      tapStartY = touch.clientY;
      tapMoved = false;
      tapHandled = false;
    }

    function onTouchMove(event) {
      if (event.target.closest("#evaMenuBtn")) return;
      const touch = event.touches ? event.touches[0] : event;
      const dx = Math.abs(touch.clientX - tapStartX);
      const dy = Math.abs(touch.clientY - tapStartY);
      if (dx > 10 || dy > 10) {
        tapMoved = true;
      }
    }

    function onTouchEnd(event) {
      if (event.target.closest("#evaMenuBtn")) return;
      if (tapMoved || tapHandled) return;
      tapHandled = true;
      togglePill(event);
    }

    pill.addEventListener("touchstart", onTouchStart, { passive: true });
    pill.addEventListener("touchmove", onTouchMove, { passive: true });
    pill.addEventListener("touchend", onTouchEnd);

    brand.addEventListener("touchstart", onTouchStart, { passive: true });
    brand.addEventListener("touchmove", onTouchMove, { passive: true });
    brand.addEventListener("touchend", onTouchEnd);

    pill.addEventListener("click", (event) => {
      if (event.target.closest("#evaMenuBtn")) return;
      if (tapHandled) {
        tapHandled = false;
        return;
      }
      togglePill(event);
    });

    brand.addEventListener("click", (event) => {
      if (tapHandled) {
        tapHandled = false;
        return;
      }
      togglePill(event);
    });

    brand.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        togglePill(event);
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
    const factor = motionMode === "tap" ? 0.085 : 0.082;
    const next = Math.abs(diff) < 0.0006 ? targetProgress : progress + diff * factor;
    applyProgress(next);
    rafId = requestAnimationFrame(animate);
  }

  function init() {
    document.documentElement.setAttribute("data-theme", getTheme());
    renderNav();
    bindTapToggle();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();