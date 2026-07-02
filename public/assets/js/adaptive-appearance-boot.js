(() => {
  const root = document.documentElement;

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("evaraos-appearance") || "{}") || {};
  } catch {
    saved = {};
  }

  const imageUrl = typeof saved.imageUrl === "string" ? saved.imageUrl.trim() : "";
  const requestedMode = ["light", "dark", "system", "image"].includes(saved.mode)
    ? saved.mode
    : "system";
  const mode = requestedMode === "image" && !imageUrl ? "system" : requestedMode;
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const environment = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  if (requestedMode === "image" && !imageUrl) {
    try {
      localStorage.setItem("evaraos-appearance", JSON.stringify({ ...saved, mode: "system" }));
    } catch {}
  }

  root.dataset.theme = "adaptive";
  root.dataset.environment = environment;
  root.dataset.themeMode = mode;
  root.dataset.appearance = `adaptive-${mode}`;
  root.dataset.adaptiveContrast = "on";
  root.toggleAttribute("data-has-wallpaper", mode === "image" && Boolean(imageUrl));
  root.classList.add("boot-pending", "evara-boot-lock");
  root.style.colorScheme = environment === "dark" ? "dark" : environment === "light" ? "light" : "light dark";
  root.style.setProperty("--evara-wallpaper-position", saved.imagePosition || "center center");
  root.style.setProperty("--evara-wallpaper-dim", String(mode === "image" ? (Number(saved.wallpaperDim) || 0.08) : 0));
  root.style.setProperty("--evara-glass-tint", String(Number(saved.glassTint) || 0.46));

  if (mode === "image" && imageUrl) {
    root.style.setProperty("--evara-wallpaper-image", `url(${JSON.stringify(imageUrl)})`);
  } else {
    root.style.removeProperty("--evara-wallpaper-image");
  }

  [
    "evaraThemeAuthority",
    "evaraNavAuthority",
    "evaraOpticsAuthority",
    "evaraInteractionAuthority",
    "evaraThemeRuntimeAuthority",
    "evaraNavRuntimeAuthority"
  ].forEach((id) => document.getElementById(id)?.remove());

  const fallback = environment === "dark"
    ? "linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)"
    : "linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";

  const prepaint = document.createElement("style");
  prepaint.id = "evaraPrepaintAuthority";
  prepaint.textContent = `html{background:${mode === "image" && imageUrl ? `var(--evara-wallpaper-image),${fallback}` : fallback} center/cover no-repeat!important}html.evara-boot-lock body{visibility:hidden!important}html.evara-theme-painted body{visibility:visible!important}body{background:transparent!important}`;
  document.head.appendChild(prepaint);

  let domReady = document.readyState !== "loading";
  let runtimeReady = root.dataset.evaraThemeReady === "true";
  let revealed = false;

  const reveal = (force = false) => {
    if (revealed || (!force && (!domReady || !runtimeReady))) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (revealed) return;
      revealed = true;
      root.classList.remove("boot-pending", "evara-boot-lock");
      root.classList.add("evara-theme-painted");
      prepaint.remove();
    }));
  };

  document.addEventListener("DOMContentLoaded", () => {
    domReady = true;
    reveal();
  }, { once: true });

  addEventListener("evara:theme-applied", () => {
    runtimeReady = true;
    reveal();
  }, { once: true });

  setTimeout(() => {
    domReady = true;
    runtimeReady = true;
    reveal(true);
  }, 2600);

  reveal();
})();
