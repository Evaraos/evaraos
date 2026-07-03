(() => {
  if (window.__evaraAdaptiveBootFast) return;
  window.__evaraAdaptiveBootFast = true;

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

  root.dataset.theme = "adaptive";
  root.dataset.environment = environment;
  root.dataset.themeMode = mode;
  root.dataset.appearance = `adaptive-${mode}`;
  root.dataset.adaptiveContrast = saved.adaptiveContrast === false ? "off" : "on";
  root.dataset.evaraBootBuild = "adaptive-fast-v16-scoped-brand";
  root.toggleAttribute("data-has-wallpaper", mode === "image" && Boolean(imageUrl));
  root.style.colorScheme = environment === "dark" ? "dark" : "light";
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

  if (location.pathname.includes("/settings/icons")) {
    const brandStyles = [
      "/assets/css/brand/sprint3-emblem-logos.css?v=2",
      "/assets/css/brand/sprint3-logo-carousel.css?v=2",
      "/assets/css/brand/brand-assets-panel.css?v=2",
      "/assets/css/brand/brand-studio-apply-motion.css?v=2"
    ];
    brandStyles.forEach((href) => {
      if (document.querySelector(`link[href=\"${href}\"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });

    const brandScripts = [
      "/assets/js/brand-studio-logo-assets.js?v=3",
      "/assets/js/brand-assets-panel.js?v=2",
      "/assets/js/brand-studio-apply-motion.js?v=1"
    ];
    brandScripts.forEach((src) => {
      if (document.querySelector(`script[src=\"${src}\"]`)) return;
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      document.head.appendChild(script);
    });
  }

  const fallback = environment === "dark"
    ? "linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)"
    : "linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";
  const canvas = mode === "image" && imageUrl
    ? `var(--evara-wallpaper-image),${fallback}`
    : fallback;

  const prepaint = document.createElement("style");
  prepaint.id = "evaraPrepaintAuthority";
  prepaint.textContent = `html{min-height:100%;min-height:100dvh;background:${canvas} center/cover fixed no-repeat!important}body{min-height:100dvh;background:transparent!important}`;
  document.head.appendChild(prepaint);

  root.classList.remove("evara-boot-lock");
  root.classList.add("evara-theme-painted");

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove("boot-pending", "evara-boot-lock");
    root.classList.add("evara-theme-painted");
    requestAnimationFrame(() => requestAnimationFrame(() => prepaint.remove()));
  };

  addEventListener("evara:theme-applied", finish, { once: true });
  addEventListener("pageshow", () => {
    if (!document.getElementById("evaraPrepaintAuthority") && !finished) document.head.appendChild(prepaint);
  }, { once: true });
  setTimeout(finish, 1400);
})();