(() => {
  if (window.__evaraAdaptiveBootFast) return;
  window.__evaraAdaptiveBootFast = true;

  const BOOT_BUILD = "adaptive-fast-v22-universal";
  const APPEARANCE_KEY = "evaraos-appearance";
  const VALID_MODES = ["light", "dark", "system", "image"];

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

  document.getElementById("evaraNavFallback")?.remove();
  document.getElementById("evaraNavFallbackStyle")?.remove();

  const root = document.documentElement;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}") || {}; } catch { saved = {}; }

  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  let imageUrl = String(saved.imageUrl || "").trim();
  if (!/^data:image\/(?!svg)/.test(imageUrl)) {
    try { const url = new URL(imageUrl, location.origin); imageUrl = imageUrl && ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { imageUrl = ""; }
  }
  const requestedMode = VALID_MODES.includes(saved.mode) ? saved.mode : "system";
  const mode = requestedMode;
  const environment = mode === "system" || (mode === "image" && !imageUrl) ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  const fallback = environment === "dark" || environment === "image"
    ? "radial-gradient(circle at 18% 12%,#10243f 0,transparent 38%),radial-gradient(circle at 83% 22%,#211b55 0,transparent 42%),radial-gradient(circle at 58% 88%,#4a1c31 0,transparent 43%),linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)"
    : "radial-gradient(circle at 18% 12%,#d8f0ff 0,transparent 38%),radial-gradient(circle at 83% 22%,#d5d0ff 0,transparent 42%),radial-gradient(circle at 58% 88%,#ffd6df 0,transparent 43%),linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";
  const wallpaper = mode === "image" && imageUrl ? `url(${JSON.stringify(imageUrl)})` : fallback;
  const canvas = mode === "image" && imageUrl ? `${wallpaper},${fallback}` : fallback;

  root.dataset.theme = "adaptive";
  root.dataset.environment = environment;
  root.dataset.themeMode = mode;
  root.dataset.appearance = "adaptive-" + mode;
  root.dataset.adaptiveContrast = saved.adaptiveContrast === false ? "off" : "on";
  root.dataset.evaraBootBuild = BOOT_BUILD;
  root.dataset.evaraThemeAuthority = "prepaint";
  root.toggleAttribute("data-has-wallpaper", mode === "image" && Boolean(imageUrl));
  root.style.colorScheme = environment === "dark" ? "dark" : "light";
  root.style.setProperty("--evara-wallpaper-image", wallpaper);
  root.style.setProperty("--evara-wallpaper-canvas", canvas);
  root.style.setProperty("--evara-wallpaper-position", ["center center", "center top", "center bottom", "left center", "right center"].includes(saved.imagePosition) ? saved.imagePosition : "center center");
  const legacyDim = Number(saved.imageOverlay);
  const legacyTint = Number(saved.glassTransparency);
  const dimFallback = Number.isFinite(legacyDim) ? clamp(legacyDim * 0.34, 0, 0.34, 0.08) : 0.08;
  const tintFallback = Number.isFinite(legacyTint) ? clamp(legacyTint * 0.74, 0.18, 0.76, 0.46) : 0.46;
  root.style.setProperty("--evara-wallpaper-dim", String(mode === "image" ? clamp(saved.wallpaperDim, 0, 0.34, dimFallback) : 0));
  root.style.setProperty("--evara-glass-tint", String(clamp(saved.glassTint, 0.18, 0.76, tintFallback)));
  root.style.setProperty("--evara-glass-tint-pct", `${Math.round((clamp(saved.glassTint, 0.18, 0.76, tintFallback)) * 100)}%`);

  ["evaraThemeAuthority", "evaraNavAuthority", "evaraOpticsAuthority", "evaraInteractionAuthority", "evaraThemeRuntimeAuthority", "evaraNavRuntimeAuthority"].forEach((id) => document.getElementById(id)?.remove());

  let prepaint = document.getElementById("evaraPrepaintAuthority");
  if (!prepaint) {
    prepaint = document.createElement("style");
    prepaint.id = "evaraPrepaintAuthority";
    document.head.appendChild(prepaint);
  }
  prepaint.textContent = `html{min-height:100%;min-height:100dvh;background:var(--evara-wallpaper-canvas) var(--evara-wallpaper-position,center center)/cover fixed no-repeat!important}body{min-height:100dvh;background:transparent!important}`;

  root.classList.remove("evara-boot-lock");
  root.classList.add("evara-theme-painted");

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove("boot-pending", "evara-boot-lock");
    root.classList.add("evara-theme-painted");
  };

  addEventListener("evara:theme-applied", finish, { once: true });
  addEventListener("pageshow", () => {
    if (!document.getElementById("evaraPrepaintAuthority")) document.head.appendChild(prepaint);
  }, { once: true });
  setTimeout(finish, 700);
})();
