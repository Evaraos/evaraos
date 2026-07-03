(() => {
  if (window.__evaraAdaptiveBootFast) return;
  window.__evaraAdaptiveBootFast = true;

  const normalizeSettingsUrl = (url) => {
    try {
      const next = new URL(url, location.origin);
      if (next.pathname === "/settings.html") {
        next.pathname = "/settings-v2.html";
        return next.href;
      }
    } catch {}
    return "";
  };

  if (location.pathname === "/settings.html") {
    location.replace("/settings-v2.html" + location.search + location.hash);
    return;
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const next = normalizeSettingsUrl(anchor.getAttribute("href"));
    if (!next) return;
    event.preventDefault();
    location.assign(next);
  }, true);

  const root = document.documentElement;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("evaraos-appearance") || "{}") || {};
  } catch {
    saved = {};
  }

  const imageUrl = typeof saved.imageUrl === "string" ? saved.imageUrl.trim() : "";
  const requestedMode = ["light", "dark", "system", "image"].includes(saved.mode) ? saved.mode : "system";
  const mode = requestedMode === "image" && !imageUrl ? "system" : requestedMode;
  const environment = mode === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;
  const darkCanvas = "radial-gradient(circle at 18% 12%,#10243f 0,transparent 38%),radial-gradient(circle at 83% 22%,#211b55 0,transparent 42%),radial-gradient(circle at 58% 88%,#4a1c31 0,transparent 43%),linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)";
  const lightCanvas = "radial-gradient(circle at 18% 12%,#d8f0ff 0,transparent 38%),radial-gradient(circle at 83% 22%,#d5d0ff 0,transparent 42%),radial-gradient(circle at 58% 88%,#ffd6df 0,transparent 43%),linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";
  const fallback = environment === "dark" ? darkCanvas : lightCanvas;
  const wallpaper = mode === "image" && imageUrl ? `url(${JSON.stringify(imageUrl)})` : fallback;
  const canvas = mode === "image" && imageUrl ? `${wallpaper},${fallback}` : fallback;

  root.dataset.theme = "adaptive";
  root.dataset.environment = environment;
  root.dataset.themeMode = mode;
  root.dataset.appearance = "adaptive-" + mode;
  root.dataset.adaptiveContrast = saved.adaptiveContrast === false ? "off" : "on";
  root.dataset.evaraBootBuild = "adaptive-fast-v19-single-canvas-nav-fallback";
  root.toggleAttribute("data-has-wallpaper", mode === "image" && Boolean(imageUrl));
  root.style.colorScheme = environment === "dark" ? "dark" : "light";
  root.style.setProperty("--evara-wallpaper-image", wallpaper);
  root.style.setProperty("--evara-wallpaper-position", saved.imagePosition || "center center");
  root.style.setProperty("--evara-wallpaper-dim", String(mode === "image" ? (Number(saved.wallpaperDim) || 0.08) : 0));
  root.style.setProperty("--evara-glass-tint", String(Number(saved.glassTint) || 0.46));

  [
    "evaraThemeAuthority",
    "evaraNavAuthority",
    "evaraOpticsAuthority",
    "evaraInteractionAuthority",
    "evaraThemeRuntimeAuthority",
    "evaraNavRuntimeAuthority"
  ].forEach((id) => document.getElementById(id)?.remove());

  const prepaint = document.createElement("style");
  prepaint.id = "evaraPrepaintAuthority";
  prepaint.textContent = `html{min-height:100%;min-height:100dvh;background:${canvas} center/cover fixed no-repeat!important}body{min-height:100dvh;background:transparent!important}`;
  document.head.appendChild(prepaint);

  const fallbackNav = document.createElement("style");
  fallbackNav.id = "evaraNavFallbackStyle";
  fallbackNav.textContent = `#evaraNavFallback{position:fixed;inset:0 0 auto 0;height:calc(68px + env(safe-area-inset-top,0px));z-index:2147483647;pointer-events:none}#evaraNavFallback .nf-title{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 33px);transform:translate(-50%,-50%);font:950 17px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:var(--text-primary,rgba(255,255,255,.96));letter-spacing:-.04em}#evaraNavFallback a,#evaraNavFallback button{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);width:48px;height:48px;border-radius:999px;border:1px solid rgba(255,255,255,.24);background:linear-gradient(145deg,rgba(255,255,255,.26),rgba(255,255,255,.08));box-shadow:0 14px 34px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.42);backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);color:var(--text-primary,rgba(255,255,255,.96));display:grid;place-items:center;pointer-events:auto;text-decoration:none;padding:0}#evaraNavFallback .nf-menu{left:max(12px,env(safe-area-inset-left,0px))}#evaraNavFallback .nf-bell{right:max(14px,env(safe-area-inset-right,0px))}#evaraNavFallback svg{width:25px;height:25px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.eva-nav-layer:not(:empty)~#evaraNavFallback,#universalNavRoot:not(:empty)+#evaraNavFallback{display:none!important}`;
  document.head.appendChild(fallbackNav);

  function ensureFallbackNav() {
    const host = document.getElementById("universalNavRoot") || document.getElementById("universalNav");
    if ((host && host.children.length) || document.getElementById("evaNavShell")) {
      document.getElementById("evaraNavFallback")?.remove();
      return;
    }
    if (document.getElementById("evaraNavFallback")) return;
    const nav = document.createElement("div");
    nav.id = "evaraNavFallback";
    nav.innerHTML = '<a class="nf-menu" href="/settings-v2.html" aria-label="Open Settings"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></a><span class="nf-title">Evaraos</span><button class="nf-bell" type="button" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></button>';
    document.body.appendChild(nav);
  }

  root.classList.remove("evara-boot-lock");
  root.classList.add("evara-theme-painted");

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove("boot-pending", "evara-boot-lock");
    root.classList.add("evara-theme-painted");
    ensureFallbackNav();
  };

  addEventListener("evara:theme-applied", finish, { once: true });
  addEventListener("pageshow", () => {
    if (!document.getElementById("evaraPrepaintAuthority") && !finished) document.head.appendChild(prepaint);
    setTimeout(ensureFallbackNav, 700);
  }, { once: true });
  setTimeout(finish, 900);
  setTimeout(ensureFallbackNav, 1200);
})();