(() => {
  if (window.__evaraAdaptiveBootFast) return;
  window.__evaraAdaptiveBootFast = true;

  const BOOT_BUILD = "adaptive-fast-v21-single-authority";
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

  const imageUrl = typeof saved.imageUrl === "string" && saved.imageUrl.startsWith("data:image/svg") === false ? saved.imageUrl.trim() : "";
  const requestedMode = VALID_MODES.includes(saved.mode) ? saved.mode : "system";
  const mode = requestedMode;
  const environment = mode === "dark" ? "dark" : mode === "light" ? "light" : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const imageFit = saved.imageFit === "contain" ? "contain" : "cover";
  const imageBlur = Math.min(24, Math.max(0, Number(saved.imageBlur) || 0));
  const fallback = environment === "dark"
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
  root.style.setProperty("--evara-wallpaper-position", saved.imagePosition || "center center");
  root.style.setProperty("--evara-wallpaper-fit", imageFit);
  root.style.setProperty("--evara-wallpaper-blur", `${mode === "image" ? imageBlur : 0}px`);
  root.style.setProperty("--evara-wallpaper-dim", String(mode === "image" ? (Number(saved.wallpaperDim) || 0.08) : 0));
  root.style.setProperty("--evara-glass-tint", String(Number(saved.glassTint) || 0.46));
  root.style.setProperty("--evara-glass-tint-pct", `${Math.round((Number(saved.glassTint) || 0.46) * 100)}%`);

  ["evaraThemeAuthority", "evaraNavAuthority", "evaraOpticsAuthority", "evaraInteractionAuthority", "evaraThemeRuntimeAuthority", "evaraNavRuntimeAuthority"].forEach((id) => document.getElementById(id)?.remove());

  let prepaint = document.getElementById("evaraPrepaintAuthority");
  if (!prepaint) {
    prepaint = document.createElement("style");
    prepaint.id = "evaraPrepaintAuthority";
    document.head.appendChild(prepaint);
  }
  prepaint.textContent = `html{min-height:100%;min-height:100dvh;background:${canvas} ${saved.imagePosition || "center center"}/${imageFit} fixed no-repeat!important;color-scheme:${environment === "dark" ? "dark" : "light"}!important}body{min-height:100dvh;background:transparent!important}`;

  root.classList.remove("evara-boot-lock");
  root.classList.add("evara-theme-painted");

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove("boot-pending", "evara-boot-lock");
    root.classList.add("evara-theme-painted");
    root.dataset.evaraThemeAuthority = "runtime";
  };

  addEventListener("evara:theme-applied", finish, { once: true });
  addEventListener("pageshow", () => {
    if (!document.getElementById("evaraPrepaintAuthority")) document.head.appendChild(prepaint);
  }, { once: true });
  setTimeout(finish, 700);
})();
