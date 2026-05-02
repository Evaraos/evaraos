(function () {
  "use strict";

  const VERSION = "fallback-nav-v1";

  function basePath() {
    return "";
  }

  function href(page) {
    return `${basePath()}/${page}`;
  }

  function getUser() {
    try {
      const raw =
        localStorage.getItem("evaraos-user") ||
        sessionStorage.getItem("evaraos-user");

      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isAuthed() {
    const user = getUser();
    return !!(user && (user.uid || user.email));
  }

  function getRole() {
    const user = getUser();
    return String(user?.role || "guest").toLowerCase();
  }

  function getTheme() {
    try {
      const raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return document.documentElement.getAttribute("data-theme") || "light";

      const data = JSON.parse(raw);
      if (data.mode === "light") return "light";
      if (data.mode === "galaxy") return "galaxy";
      if (data.mode === "custom") return data.baseFamily || "dark";
      return "dark";
    } catch {
      return "light";
    }
  }

  function setTheme(next) {
    document.documentElement.setAttribute("data-theme", next);

    try {
      localStorage.setItem(
        "evaraos-appearance",
        JSON.stringify({
          mode: next,
          baseFamily: next
        })
      );
    } catch {}

    const icon = document.querySelector("[data-eva-fallback-theme-icon]");
    if (icon) icon.textContent = next === "light" ? "☾" : "☀";
  }

  function icon(name) {
    const icons = {
      home: `<path d="M3.8 11.4 12 4.5l8.2 6.9"/><path d="M6.5 10.6v8.2h11v-8.2"/><path d="M10 18.8v-5h4v5"/>`,
      users: `<path d="M16.5 18.5c0-2.2-2-4-4.5-4s-4.5 1.8-4.5 4"/><circle cx="12" cy="9" r="3"/><path d="M20 18.5c0-1.6-1.1-3-2.8-3.6"/><path d="M17 6.7a2.6 2.6 0 0 1 0 5"/>`,
      login: `<path d="M10 7V5.8A2.8 2.8 0 0 1 12.8 3h4.4A2.8 2.8 0 0 1 20 5.8v12.4a2.8 2.8 0 0 1-2.8 2.8h-4.4A2.8 2.8 0 0 1 10 18.2V17"/><path d="M4 12h10"/><path d="m11 8 4 4-4 4"/>`,
      signup: `<circle cx="9" cy="9" r="3"/><path d="M3.8 19c0-2.5 2.3-4.5 5.2-4.5 1 0 1.9.2 2.7.6"/><path d="M17 8v8"/><path d="M13 12h8"/>`,
      dashboard: `<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-5"/><path d="M12 15V8"/><path d="M16 15v-8"/>`,
      settings: `<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 0 1 7.1 4.3l.1.1A1.6 1.6 0 0 0 9 4.7a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>`,
      companies: `<path d="M4 20h16"/><path d="M6 20V7l6-3 6 3v13"/><path d="M9 10h.1"/><path d="M12 10h.1"/><path d="M15 10h.1"/><path d="M9 14h.1"/><path d="M12 14h.1"/><path d="M15 14h.1"/>`,
      leads: `<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 3Z"/>`,
      jobs: `<path d="M8 7V5.8A2.8 2.8 0 0 1 10.8 3h2.4A2.8 2.8 0 0 1 16 5.8V7"/><path d="M5 7h14v13H5z"/>`,
      qa: `<path d="M9 3h6"/><path d="M10 3v5l-5.2 9.3A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.2-3.7L14 8V3"/><path d="M8.5 15h7"/>`
    };

    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.home}</svg>`;
  }

  function appTile(page, label, iconName) {
    return `
      <a class="eva-fb-app" href="${href(page)}">
        <span class="eva-fb-app-icon">${icon(iconName)}</span>
        <span class="eva-fb-app-label">${label}</span>
      </a>
    `;
  }

  function section(title, tag, items) {
    if (!items.length) return "";

    return `
      <section class="eva-fb-section">
        <div class="eva-fb-section-head">
          <h3>${title}</h3>
          <span>${tag}</span>
        </div>
        <div class="eva-fb-grid">
          ${items.map((item) => appTile(item.page, item.label, item.icon)).join("")}
        </div>
      </section>
    `;
  }

  function styles() {
    if (document.getElementById("evaFallbackNavStyles")) return;

    const style = document.createElement("style");
    style.id = "evaFallbackNavStyles";
    style.textContent = `
      #universalNavRoot,
      #universalNav,
      .eva-nav-layer,
      #evaNavShell,
      #evaNavPill {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #evaFallbackNavLayer {
        position: fixed !important;
        inset: 0 0 auto 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        font-family: inherit !important;
      }

      .eva-fb-nav {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        transition:
          top .48s cubic-bezier(.2,.9,.2,1),
          left .48s cubic-bezier(.2,.9,.2,1),
          width .48s cubic-bezier(.2,.9,.2,1),
          height .48s cubic-bezier(.2,.9,.2,1),
          transform .48s cubic-bezier(.2,.9,.2,1),
          border-radius .48s cubic-bezier(.2,.9,.2,1),
          background .48s cubic-bezier(.2,.9,.2,1),
          box-shadow .48s cubic-bezier(.2,.9,.2,1);
      }

      body.eva-fb-compact .eva-fb-nav {
        top: max(5px, calc(env(safe-area-inset-top, 0px) - 50px)) !important;
        left: calc(50% - 72px) !important;
        width: 38px !important;
        height: 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
        transform: translateX(-50%) !important;
        border-radius: 999px !important;

        background:
          radial-gradient(circle at 30% 18%, rgba(255,255,255,0.30), transparent 24%),
          radial-gradient(circle at 70% 76%, rgba(216,0,32,0.24), transparent 34%),
          linear-gradient(180deg, rgba(15,16,19,0.98), rgba(0,0,0,0.97)) !important;

        border: 1px solid rgba(255,255,255,0.18) !important;

        box-shadow:
          0 10px 18px rgba(0,0,0,0.36),
          0 4px 10px rgba(0,0,0,0.25),
          inset 0 1px 0 rgba(255,255,255,0.17),
          inset 0 -1px 0 rgba(0,0,0,0.72) !important;

        backdrop-filter: blur(24px) saturate(175%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(175%) !important;
        overflow: hidden !important;
      }

      body.eva-fb-expanded .eva-fb-nav,
      body.eva-fb-menu-open .eva-fb-nav {
        top: max(14px, calc(env(safe-area-inset-top, 0px) + 10px)) !important;
        left: 50% !important;
        width: min(calc(100vw - 18px), 1080px) !important;
        height: 58px !important;
        min-height: 58px !important;
        transform: translateX(-50%) !important;
        border-radius: 999px !important;

        background:
          radial-gradient(circle at 24% 12%, rgba(255,255,255,0.96), transparent 36%),
          linear-gradient(180deg, rgba(255,255,255,0.94), rgba(245,247,249,0.84)) !important;

        border: 1px solid rgba(255,255,255,0.96) !important;

        box-shadow:
          0 18px 34px rgba(0,0,0,0.14),
          0 5px 14px rgba(0,0,0,0.08),
          inset 0 1px 0 rgba(255,255,255,1),
          inset 0 -1px 0 rgba(0,0,0,0.055) !important;

        backdrop-filter: blur(22px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(22px) saturate(180%) !important;
        overflow: hidden !important;
      }

      .eva-fb-brand {
        position: absolute !important;
        inset: 0 !important;
        display: grid !important;
        place-items: center !important;
        color: #10231e !important;
        text-decoration: none !important;
      }

      .eva-fb-logo {
        width: 29px !important;
        height: 29px !important;
        object-fit: contain !important;
        filter:
          drop-shadow(0 0 8px rgba(216,0,32,0.68))
          drop-shadow(0 2px 5px rgba(0,0,0,0.70)) !important;
      }

      body.eva-fb-expanded .eva-fb-logo,
      body.eva-fb-menu-open .eva-fb-logo {
        width: 28px !important;
        height: 28px !important;
        margin-right: 9px !important;
        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.16)) !important;
      }

      .eva-fb-copy {
        display: none !important;
      }

      body.eva-fb-expanded .eva-fb-brand,
      body.eva-fb-menu-open .eva-fb-brand {
        inset: auto !important;
        left: calc(50% - 12px) !important;
        top: 50% !important;
        transform: translate(-50%, -50%) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: auto !important;
        max-width: calc(100% - 124px) !important;
        white-space: nowrap !important;
      }

      body.eva-fb-expanded .eva-fb-copy,
      body.eva-fb-menu-open .eva-fb-copy {
        display: grid !important;
        text-align: center !important;
        line-height: 1.02 !important;
      }

      .eva-fb-copy strong {
        font-size: 1rem !important;
        font-weight: 950 !important;
        letter-spacing: -0.045em !important;
        color: #10231e !important;
      }

      .eva-fb-copy span {
        font-size: .66rem !important;
        font-weight: 850 !important;
        color: rgba(16,35,30,.46) !important;
      }

      .eva-fb-actions {
        display: none !important;
      }

      body.eva-fb-expanded .eva-fb-actions,
      body.eva-fb-menu-open .eva-fb-actions {
        position: absolute !important;
        right: 12px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .eva-fb-theme {
        width: 18px !important;
        height: 18px !important;
        border: 0 !important;
        background: transparent !important;
        color: #0f201c !important;
        padding: 0 !important;
        margin: 0 !important;
        display: grid !important;
        place-items: center !important;
        font-size: 1.02rem !important;
        font-weight: 900 !important;
      }

      .eva-fb-menu-btn {
        width: 32px !important;
        height: 32px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255,255,255,.94) !important;
        display: grid !important;
        place-items: center !important;
        background:
          radial-gradient(circle at 28% 14%, rgba(255,255,255,1), transparent 34%),
          linear-gradient(180deg, rgba(255,255,255,.90), rgba(244,247,249,.72)) !important;
        box-shadow:
          0 9px 14px rgba(0,0,0,.12),
          0 3px 8px rgba(0,0,0,.07),
          inset 0 1px 0 rgba(255,255,255,1),
          inset 0 -1px 0 rgba(0,0,0,.055) !important;
      }

      .eva-fb-burger {
        width: 15px !important;
        height: 11px !important;
        position: relative !important;
      }

      .eva-fb-burger i {
        position: absolute !important;
        left: 50% !important;
        width: 15px !important;
        height: 2px !important;
        border-radius: 999px !important;
        background: #10231e !important;
        transform: translateX(-50%) !important;
        transition: .25s ease !important;
      }

      .eva-fb-burger i:nth-child(1) { top: 0 !important; }
      .eva-fb-burger i:nth-child(2) { top: 4.8px !important; }
      .eva-fb-burger i:nth-child(3) { top: 9.6px !important; }

      body.eva-fb-menu-open .eva-fb-burger i:nth-child(1) {
        top: 4.8px !important;
        transform: translateX(-50%) rotate(45deg) !important;
      }

      body.eva-fb-menu-open .eva-fb-burger i:nth-child(2) {
        opacity: 0 !important;
        transform: translateX(-50%) scaleX(0) !important;
      }

      body.eva-fb-menu-open .eva-fb-burger i:nth-child(3) {
        top: 4.8px !important;
        transform: translateX(-50%) rotate(-45deg) !important;
      }

      .eva-fb-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483645 !important;
        background: rgba(0,0,0,.34) !important;
        backdrop-filter: blur(20px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(140%) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: .25s ease !important;
      }

      body.eva-fb-menu-open .eva-fb-backdrop {
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .eva-fb-panel {
        position: fixed !important;
        left: 50% !important;
        top: max(84px, calc(env(safe-area-inset-top, 0px) + 72px)) !important;
        width: min(430px, calc(100vw - 18px)) !important;
        max-height: min(70vh, calc(100dvh - 190px)) !important;
        overflow: auto !important;
        -webkit-overflow-scrolling: touch !important;
        z-index: 2147483646 !important;
        transform: translateX(-50%) translateY(-8px) scale(.985) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        border-radius: 34px !important;
        padding: 18px 14px 16px !important;

        background:
          radial-gradient(circle at 14% 0%, rgba(255,255,255,.94), transparent 34%),
          radial-gradient(circle at 92% 6%, rgba(216,0,32,.105), transparent 30%),
          radial-gradient(circle at 44% 112%, rgba(0,0,0,.22), transparent 42%),
          linear-gradient(180deg, rgba(251,252,253,.88), rgba(226,230,235,.76)) !important;

        border: 1px solid rgba(255,255,255,.92) !important;

        box-shadow:
          0 34px 82px rgba(0,0,0,.34),
          0 14px 34px rgba(0,0,0,.20),
          inset 0 1px 0 rgba(255,255,255,1),
          inset 0 -1px 0 rgba(0,0,0,.06) !important;

        backdrop-filter: blur(32px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(32px) saturate(180%) !important;
        transition: .28s cubic-bezier(.2,.9,.2,1) !important;
      }

      body.eva-fb-menu-open .eva-fb-panel {
        opacity: 1 !important;
        transform: translateX(-50%) translateY(0) scale(1) !important;
        pointer-events: auto !important;
      }

      .eva-fb-titlebar {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        padding: 0 5px 14px !important;
      }

      .eva-fb-titlebar p {
        margin: 0 0 4px !important;
        font-size: .64rem !important;
        font-weight: 950 !important;
        letter-spacing: .28em !important;
        color: rgba(16,35,30,.42) !important;
      }

      .eva-fb-titlebar h2 {
        margin: 0 !important;
        font-size: 1.42rem !important;
        line-height: .95 !important;
        font-weight: 950 !important;
        letter-spacing: -.065em !important;
        color: #0d201b !important;
      }

      .eva-fb-badge {
        padding: 8px 13px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.82) !important;
        border: 1px solid rgba(255,255,255,.9) !important;
        font-size: .72rem !important;
        font-weight: 950 !important;
        color: rgba(16,35,30,.78) !important;
        text-transform: capitalize !important;
      }

      .eva-fb-search {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        height: 56px !important;
        padding: 0 16px !important;
        border-radius: 22px !important;
        background: rgba(255,255,255,.70) !important;
        border: 1px solid rgba(255,255,255,.86) !important;
        margin-bottom: 12px !important;
      }

      .eva-fb-search svg {
        width: 22px !important;
        height: 22px !important;
        fill: none !important;
        stroke: #10231e !important;
        stroke-width: 2.2 !important;
        stroke-linecap: round !important;
      }

      .eva-fb-search input {
        flex: 1 !important;
        border: 0 !important;
        background: transparent !important;
        outline: 0 !important;
        font-size: 1rem !important;
        font-weight: 800 !important;
        color: #10231e !important;
      }

      .eva-fb-section {
        margin: 12px 0 !important;
        padding: 17px 14px 18px !important;
        border-radius: 30px !important;
        background:
          radial-gradient(circle at 16% 0%, rgba(255,255,255,.88), transparent 36%),
          radial-gradient(circle at 96% 10%, rgba(216,0,32,.052), transparent 36%),
          radial-gradient(circle at 35% 110%, rgba(0,0,0,.09), transparent 42%),
          linear-gradient(180deg, rgba(255,255,255,.52), rgba(255,255,255,.17)) !important;
        border: 1px solid rgba(255,255,255,.86) !important;
        box-shadow:
          0 18px 36px rgba(0,0,0,.13),
          0 7px 16px rgba(0,0,0,.08),
          inset 0 1px 0 rgba(255,255,255,.96),
          inset 0 -1px 0 rgba(0,0,0,.045) !important;
      }

      .eva-fb-section-head {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 14px !important;
        padding: 0 2px !important;
      }

      .eva-fb-section-head h3 {
        margin: 0 !important;
        font-size: 1rem !important;
        font-weight: 950 !important;
        letter-spacing: -.045em !important;
        color: #0d201b !important;
      }

      .eva-fb-section-head span {
        font-size: .62rem !important;
        font-weight: 950 !important;
        letter-spacing: .38em !important;
        color: rgba(16,35,30,.43) !important;
        text-transform: uppercase !important;
      }

      .eva-fb-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 15px 4px !important;
        justify-items: center !important;
      }

      .eva-fb-app {
        width: 68px !important;
        min-height: 76px !important;
        display: grid !important;
        grid-template-rows: 52px auto !important;
        place-items: center !important;
        gap: 5px !important;
        text-decoration: none !important;
        color: #0d201b !important;
      }

      .eva-fb-app-icon {
        width: 52px !important;
        height: 52px !important;
        border-radius: 18px !important;
        display: grid !important;
        place-items: center !important;
        position: relative !important;
        overflow: hidden !important;

        background:
          radial-gradient(circle at 24% 13%, rgba(255,255,255,.94), transparent 20%),
          radial-gradient(circle at 78% 18%, rgba(255,255,255,.22), transparent 27%),
          radial-gradient(circle at 45% 96%, rgba(0,0,0,.18), transparent 40%),
          linear-gradient(145deg, rgba(255,70,86,.82) 0%, rgba(216,0,32,.62) 42%, rgba(10,12,16,.84) 138%) !important;

        border: 1.2px solid rgba(255,255,255,.86) !important;

        box-shadow:
          0 18px 24px rgba(0,0,0,.22),
          0 10px 20px rgba(216,0,32,.10),
          0 0 18px rgba(216,0,32,.08),
          inset 0 1px 0 rgba(255,255,255,.80),
          inset 0 -2px 4px rgba(0,0,0,.24) !important;
      }

      .eva-fb-app-icon::before {
        content: "";
        position: absolute;
        inset: 1px;
        border-radius: 17px;
        background:
          linear-gradient(135deg, rgba(255,255,255,.66), rgba(255,255,255,.22) 18%, transparent 35%, rgba(255,255,255,.07) 68%, rgba(255,255,255,.22)),
          radial-gradient(circle at 82% 94%, rgba(0,0,0,.24), transparent 36%) !important;
      }

      .eva-fb-app-icon svg {
        width: 23px !important;
        height: 23px !important;
        stroke: #fff !important;
        fill: none !important;
        stroke-width: 2.25 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        z-index: 2 !important;
        filter:
          drop-shadow(0 1px 0 rgba(0,0,0,.95))
          drop-shadow(0 -1px 0 rgba(0,0,0,.70))
          drop-shadow(1px 0 0 rgba(0,0,0,.70))
          drop-shadow(-1px 0 0 rgba(0,0,0,.70))
          drop-shadow(0 2px 4px rgba(0,0,0,.28)) !important;
      }

      .eva-fb-app-label {
        max-width: 68px !important;
        font-size: .52rem !important;
        font-weight: 950 !important;
        line-height: 1.02 !important;
        text-align: center !important;
        color: rgba(8,18,16,.92) !important;
      }

      @media (max-width: 430px) {
        body.eva-fb-compact .eva-fb-nav {
          left: calc(50% - 72px) !important;
        }

        .eva-fb-grid {
          gap: 13px 3px !important;
        }

        .eva-fb-app-icon {
          width: 50px !important;
          height: 50px !important;
          border-radius: 17px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function render() {
    styles();

    const old = document.getElementById("evaFallbackNavLayer");
    if (old) old.remove();

    const authed = isAuthed();
    const role = getRole();

    const common = [
      { page: "index.html", label: "Home", icon: "home" }
    ];

    const account = authed
      ? [
          { page: "dashboard.html", label: "Dashboard", icon: "dashboard" },
          { page: "settings.html", label: "Settings", icon: "settings" },
          ...(role === "owner"
            ? [
                { page: "companies.html", label: "Companies", icon: "companies" },
                { page: "users.html", label: "Users", icon: "users" },
                { page: "applications.html", label: "Applications", icon: "users" },
                { page: "leads.html", label: "Leads", icon: "leads" },
                { page: "jobs.html", label: "Jobs", icon: "jobs" },
                { page: "qa.html", label: "QA", icon: "qa" }
              ]
            : [])
        ]
      : [
          { page: "staff_application.html", label: "Apply as Staff", icon: "users" },
          { page: "login.html", label: "Login", icon: "login" },
          { page: "signup.html", label: "Sign Up", icon: "signup" }
        ];

    const layer = document.createElement("div");
    layer.id = "evaFallbackNavLayer";
    layer.dataset.version = VERSION;

    layer.innerHTML = `
      <div class="eva-fb-backdrop" data-eva-fb-close></div>

      <header class="eva-fb-nav" id="evaFallbackNav">
        <a class="eva-fb-brand" href="${href("index.html")}" aria-label="Evaraos navigation">
          <img class="eva-fb-logo" src="/assets/img/evaraos_logo.png" alt="Evaraos logo" />
          <span class="eva-fb-copy">
            <strong>Evaraos Inc</strong>
            <span>Subsidiaries Allocation SaaS</span>
          </span>
        </a>

        <div class="eva-fb-actions">
          <button class="eva-fb-theme" type="button" aria-label="Toggle theme">
            <span data-eva-fallback-theme-icon>${getTheme() === "light" ? "☾" : "☀"}</span>
          </button>

          <button class="eva-fb-menu-btn" type="button" aria-label="Open menu">
            <span class="eva-fb-burger">
              <i></i><i></i><i></i>
            </span>
          </button>
        </div>
      </header>

      <aside class="eva-fb-panel" aria-label="Evaraos Control Center">
        <div class="eva-fb-titlebar">
          <div>
            <p>EVARAOS</p>
            <h2>${authed ? "Executive Control" : "Control Center"}</h2>
          </div>
          <span class="eva-fb-badge">${authed ? role : "Guest"}</span>
        </div>

        <label class="eva-fb-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.6"></circle>
            <path d="M16 16l4.2 4.2"></path>
          </svg>
          <input type="text" placeholder="Search apps" data-eva-fb-search />
        </label>

        ${authed ? section("Executive Control", "Operate", account) : ""}
        ${section("Navigation", "Explore", common)}
        ${!authed ? section("Account", "Access", account) : ""}
        ${authed ? section("Account Tools", "Session", [
          { page: "login.html", label: "Logout", icon: "login" }
        ]) : ""}
      </aside>
    `;

    document.body.appendChild(layer);

    document.documentElement.classList.remove("boot-pending");
    document.body.classList.remove("app-loading");
    document.body.classList.add("app-ready");

    document.body.classList.remove("eva-fb-expanded", "eva-fb-menu-open");
    document.body.classList.add("eva-fb-compact");

    bind(layer);
  }

  function openFull() {
    document.body.classList.remove("eva-fb-compact");
    document.body.classList.add("eva-fb-expanded");
  }

  function closeFull() {
    document.body.classList.remove("eva-fb-expanded", "eva-fb-menu-open");
    document.body.classList.add("eva-fb-compact");
  }

  function openMenu() {
    document.body.classList.remove("eva-fb-compact");
    document.body.classList.add("eva-fb-expanded", "eva-fb-menu-open");
  }

  function closeMenu() {
    closeFull();
  }

  function bind(layer) {
    const nav = layer.querySelector("#evaFallbackNav");
    const brand = layer.querySelector(".eva-fb-brand");
    const menuBtn = layer.querySelector(".eva-fb-menu-btn");
    const themeBtn = layer.querySelector(".eva-fb-theme");
    const backdrop = layer.querySelector("[data-eva-fb-close]");
    const search = layer.querySelector("[data-eva-fb-search]");
    const apps = Array.from(layer.querySelectorAll(".eva-fb-app"));

    nav.addEventListener("click", (event) => {
      if (event.target.closest(".eva-fb-menu-btn, .eva-fb-theme")) return;

      event.preventDefault();
      event.stopPropagation();

      if (document.body.classList.contains("eva-fb-compact")) openFull();
      else closeFull();
    });

    brand.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (document.body.classList.contains("eva-fb-compact")) openFull();
      else closeFull();
    });

    menuBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (document.body.classList.contains("eva-fb-menu-open")) closeMenu();
      else openMenu();
    });

    themeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const current = getTheme();
      setTheme(current === "light" ? "dark" : "light");
    });

    backdrop.addEventListener("click", closeMenu);

    search?.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();

      apps.forEach((app) => {
        const label = app.textContent.trim().toLowerCase();
        app.style.display = !q || label.includes(q) ? "" : "none";
      });
    });

    apps.forEach((app) => {
      app.addEventListener("click", (event) => {
        const label = app.textContent.trim().toLowerCase();

        if (label === "logout") {
          event.preventDefault();

          try {
            localStorage.removeItem("evaraos-user");
            localStorage.removeItem("evaraos-role");
            sessionStorage.removeItem("evaraos-user");
            sessionStorage.removeItem("evaraos-role");
          } catch {}

          window.location.href = href("login.html");
        }
      });
    });
  }

  function start() {
    render();
    setTimeout(render, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
