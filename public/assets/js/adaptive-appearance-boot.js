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

  const fallback = environment === "dark"
    ? "linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)"
    : "linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";

  const prepaint = document.createElement("style");
  prepaint.id = "evaraPrepaintAuthority";
  prepaint.dataset.evaraAuthority = "1";
  prepaint.textContent = `html{background:${mode === "image" && imageUrl ? `var(--evara-wallpaper-image),${fallback}` : fallback} center/cover fixed no-repeat!important}html.evara-boot-lock body{visibility:hidden!important}html.evara-theme-painted body{visibility:visible!important}body{background:transparent!important}`;
  document.head.appendChild(prepaint);

  const add = (tag, id, url) => {
    const node = document.createElement(tag);
    node.id = id;
    node.dataset.evaraAuthority = "1";
    if (tag === "link") {
      node.rel = "stylesheet";
      node.href = url;
    } else {
      node.type = "module";
      node.src = url;
    }
    document.head.appendChild(node);
    return node;
  };

  const theme = add("link", "evaraThemeAuthority", "/assets/css/theme.css?v=adaptive-liquid-v7");
  add("link", "evaraNavAuthority", "/assets/css/nav.css?v=nav-v26-visible-actions");
  add("script", "evaraOpticsAuthority", "/assets/js/liquid-optics.js?v=1");
  add("script", "evaraInteractionAuthority", "/assets/js/liquid-interaction.js?v=1");
  add("script", "evaraThemeRuntimeAuthority", "/assets/js/theme.js?v=adaptive-liquid-v7");
  add("script", "evaraNavRuntimeAuthority", "/assets/js/nav.js?v=nav-v26-visible-actions");

  const clean = (node) => {
    if (!(node instanceof Element)) return;
    const nodes = [node, ...(node.querySelectorAll?.("link[href],script[src]") || [])];
    nodes.forEach((item) => {
      if (item.dataset?.evaraAuthority) return;
      const url = item.getAttribute("href") || item.getAttribute("src") || "";
      const isLegacy = url.includes("theme-boot.js") || url.includes("appearance-mode-fix.js");
      const isDuplicate = /\/assets\/(css\/(theme|nav)\.css|js\/(theme|nav|liquid-optics|liquid-interaction)\.js)/.test(url);
      if (isLegacy || isDuplicate) item.remove();
    });
  };

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(clean));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let cssReady = Boolean(theme.sheet);
  let domReady = document.readyState !== "loading";
  let runtimeReady = false;
  let revealed = false;

  const reveal = () => {
    if (revealed || !cssReady || !domReady || !runtimeReady) return;
    clean(document.documentElement);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      revealed = true;
      root.classList.remove("boot-pending", "evara-boot-lock");
      root.classList.add("evara-theme-painted");
      observer.disconnect();
    }));
  };

  theme.addEventListener("load", () => { cssReady = true; reveal(); }, { once: true });
  document.addEventListener("DOMContentLoaded", () => { domReady = true; clean(document.documentElement); reveal(); }, { once: true });
  addEventListener("evara:theme-applied", () => { runtimeReady = true; reveal(); }, { once: true });
  setTimeout(() => { cssReady = true; domReady = true; runtimeReady = true; reveal(); }, 3000);
  reveal();
})();