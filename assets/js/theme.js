const STORAGE_KEY = "evaraos-theme";
const APPEARANCE_KEY = "evaraos-appearance";

const DEFAULT_THEME = "dark";
const VALID_THEMES = [
  "dark",
  "light",
  "blue-dark",
  "blue-light",
  "red-dark",
  "red-light",
  "pink-dark",
  "pink-light",
  "green-dark",
  "green-light",
  "purple-dark",
  "purple-light",
  "yellow-dark",
  "yellow-light"
];

const DEFAULT_APPEARANCE = {
  mode: "dark",
  family: "neutral",
  beamMode: "contextual",
  navColor: "#FF3B30",
  cardColor: "#8B5CF6",
  buttonColor: "#2563EB",
  backgroundColor: "#0F172A",
  beamColor: "#7C3AED"
};

function normalizeTheme(theme = "") {
  const value = String(theme || "").trim().toLowerCase();
  return VALID_THEMES.includes(value) ? value : DEFAULT_THEME;
}

function normalizeHex(value, fallback) {
  const safe = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(safe) ? safe : fallback.toUpperCase();
}

function normalizeBeamMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["off", "contextual", "rainbow", "custom"].includes(safe) ? safe : "contextual";
}

function buildTheme(family = "neutral", mode = "dark") {
  const safeMode = mode === "light" ? "light" : "dark";
  if (family === "neutral") return safeMode;
  const candidate = `${family}-${safeMode}`;
  return VALID_THEMES.includes(candidate) ? candidate : DEFAULT_THEME;
}

function getThemeParts(theme = DEFAULT_THEME) {
  const safe = normalizeTheme(theme);
  if (safe === "dark") return { family: "neutral", mode: "dark" };
  if (safe === "light") return { family: "neutral", mode: "light" };
  const [family, mode] = safe.split("-");
  return {
    family: family || "neutral",
    mode: mode === "light" ? "light" : "dark"
  };
}

function normalizeAppearance(appearance = {}) {
  const theme = getThemeParts(
    buildTheme(
      appearance.family || DEFAULT_APPEARANCE.family,
      appearance.mode || DEFAULT_APPEARANCE.mode
    )
  );

  return {
    mode: theme.mode,
    family: theme.family,
    beamMode: normalizeBeamMode(appearance.beamMode || DEFAULT_APPEARANCE.beamMode),
    navColor: normalizeHex(appearance.navColor, DEFAULT_APPEARANCE.navColor),
    cardColor: normalizeHex(appearance.cardColor, DEFAULT_APPEARANCE.cardColor),
    buttonColor: normalizeHex(appearance.buttonColor, DEFAULT_APPEARANCE.buttonColor),
    backgroundColor: normalizeHex(appearance.backgroundColor, DEFAULT_APPEARANCE.backgroundColor),
    beamColor: normalizeHex(appearance.beamColor, DEFAULT_APPEARANCE.beamColor)
  };
}

function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);
  } catch {
    return DEFAULT_THEME;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeTheme(theme));
  } catch {}
}

function getStoredAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function setStoredAppearance(appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(normalizeAppearance(appearance)));
  } catch {}
}

function ensureAppearanceStyle() {
  let styleEl = document.getElementById("evaraAppearanceStyle");
  if (styleEl) return styleEl;

  styleEl = document.createElement("style");
  styleEl.id = "evaraAppearanceStyle";
  styleEl.textContent = `
    :root {
      --user-nav-tint: ${DEFAULT_APPEARANCE.navColor};
      --user-card-tint: ${DEFAULT_APPEARANCE.cardColor};
      --user-button-tint: ${DEFAULT_APPEARANCE.buttonColor};
      --user-background-tint: ${DEFAULT_APPEARANCE.backgroundColor};
      --user-beam-color: ${DEFAULT_APPEARANCE.beamColor};
    }

    body {
      background-image:
        radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--user-background-tint) 16%, transparent), transparent 26%),
        radial-gradient(circle at 82% 14%, color-mix(in srgb, var(--user-nav-tint) 14%, transparent), transparent 24%),
        radial-gradient(circle at 16% 82%, color-mix(in srgb, var(--user-card-tint) 10%, transparent), transparent 24%);
    }

    .glass-card,
    .glass-shell,
    .aurora-card,
    .input-shell,
    .feature-card,
    .hero,
    .inline-card,
    .dashboard-feed-item,
    .dashboard-stat-card,
    .login-panel,
    .auth-panel,
    .dashboard-panel,
    .dashboard-hero,
    .dashboard-overview,
    .dashboard-sidebar-inner {
      border-color: color-mix(in srgb, var(--user-card-tint) 26%, rgba(255,255,255,0.12)) !important;
      box-shadow:
        0 18px 34px rgba(0,0,0,0.14),
        inset 0 1px 0 rgba(255,255,255,0.10),
        0 0 0 1px color-mix(in srgb, var(--user-card-tint) 12%, transparent) !important;
    }

    .btn-theme-primary,
    .settings-preview-btn,
    .premium-red-btn,
    .login-actions-row .btn:first-child,
    .hero-actions .btn:first-child,
    .dashboard-hero-actions .btn:first-child {
      background:
        linear-gradient(
          135deg,
          color-mix(in srgb, var(--user-button-tint) 86%, white 14%) 0%,
          color-mix(in srgb, var(--user-button-tint) 68%, white 32%) 100%
        ) !important;
      border-color: color-mix(in srgb, var(--user-button-tint) 50%, rgba(255,255,255,0.10)) !important;
      box-shadow:
        0 18px 34px color-mix(in srgb, var(--user-button-tint) 24%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.18) !important;
    }

    .eva-nav-pill,
    #evaNavPill,
    .settings-preview-nav,
    .nav-hamburger,
    .nav-dropdown-menu,
    .eva-menu-panel {
      border-color: color-mix(in srgb, var(--user-nav-tint) 28%, rgba(255,255,255,0.12)) !important;
      box-shadow:
        0 16px 34px rgba(0,0,0,0.16),
        inset 0 1px 0 rgba(255,255,255,0.12),
        0 0 0 1px color-mix(in srgb, var(--user-nav-tint) 14%, transparent) !important;
    }

    .page-grid-overlay {
      background-image:
        linear-gradient(color-mix(in srgb, var(--user-nav-tint) 9%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--user-nav-tint) 9%, transparent) 1px, transparent 1px) !important;
      opacity: 0.22 !important;
    }

    html[data-beam-mode="off"] .beam-target:hover,
    html[data-beam-mode="off"] .beam-target.is-active,
    html[data-beam-mode="off"] .dashboard-nav-link.active,
    html[data-beam-mode="off"] .eva-link.active,
    html[data-beam-mode="off"] .input-shell:focus-within,
    html[data-beam-mode="off"] .btn:focus-visible {
      box-shadow: none !important;
      filter: none !important;
    }

    html[data-beam-mode="contextual"] .beam-target:hover,
    html[data-beam-mode="contextual"] .beam-target.is-active,
    html[data-beam-mode="contextual"] .dashboard-nav-link.active,
    html[data-beam-mode="contextual"] .eva-link.active,
    html[data-beam-mode="contextual"] .input-shell:focus-within,
    html[data-beam-mode="contextual"] .btn:focus-visible,
    html[data-beam-mode="custom"] .beam-target:hover,
    html[data-beam-mode="custom"] .beam-target.is-active,
    html[data-beam-mode="custom"] .dashboard-nav-link.active,
    html[data-beam-mode="custom"] .eva-link.active,
    html[data-beam-mode="custom"] .input-shell:focus-within,
    html[data-beam-mode="custom"] .btn:focus-visible {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--user-beam-color) 56%, transparent),
        0 0 18px color-mix(in srgb, var(--user-beam-color) 22%, transparent),
        0 0 32px color-mix(in srgb, var(--user-beam-color) 10%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.12) !important;
    }

    html[data-beam-mode="rainbow"] .beam-target:hover,
    html[data-beam-mode="rainbow"] .beam-target.is-active,
    html[data-beam-mode="rainbow"] .dashboard-nav-link.active,
    html[data-beam-mode="rainbow"] .eva-link.active,
    html[data-beam-mode="rainbow"] .input-shell:focus-within,
    html[data-beam-mode="rainbow"] .btn:focus-visible {
      position: relative;
      isolation: isolate;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.16),
        0 0 18px rgba(255,255,255,0.16),
        inset 0 1px 0 rgba(255,255,255,0.12) !important;
    }

    html[data-beam-mode="rainbow"] .beam-target:hover::after,
    html[data-beam-mode="rainbow"] .beam-target.is-active::after,
    html[data-beam-mode="rainbow"] .dashboard-nav-link.active::after,
    html[data-beam-mode="rainbow"] .eva-link.active::after,
    html[data-beam-mode="rainbow"] .input-shell:focus-within::after,
    html[data-beam-mode="rainbow"] .btn:focus-visible::after {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(
        120deg,
        #ff3b30,
        #ff9500,
        #ffd60a,
        #34c759,
        #0a84ff,
        #5e5ce6,
        #bf5af2,
        #ff2d55,
        #ff3b30
      );
      background-size: 300% 300%;
      animation: evaraRainbowFlow 4.2s linear infinite;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-composite: exclude;
      pointer-events: none;
      z-index: 2;
    }

    @keyframes evaraRainbowFlow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(styleEl);
  return styleEl;
}

function syncThemeUi() {
  const current = getThemeParts(getStoredTheme());
  const appearance = getStoredAppearance();

  document.querySelectorAll("[data-theme-mode-text]").forEach((el) => {
    el.textContent = current.mode === "light" ? "Light" : "Dark";
  });

  document.querySelectorAll("[data-theme-group-text]").forEach((el) => {
    el.textContent = current.family === "neutral"
      ? "Neutral"
      : current.family.charAt(0).toUpperCase() + current.family.slice(1);
  });

  document.querySelectorAll("[data-beam-mode-text]").forEach((el) => {
    el.textContent = appearance.beamMode.charAt(0).toUpperCase() + appearance.beamMode.slice(1);
  });

  document.querySelectorAll("[data-nav-color-preview]").forEach((el) => {
    el.style.background = appearance.navColor;
  });

  document.querySelectorAll("[data-card-color-preview]").forEach((el) => {
    el.style.background = appearance.cardColor;
  });

  document.querySelectorAll("[data-button-color-preview]").forEach((el) => {
    el.style.background = appearance.buttonColor;
  });

  document.querySelectorAll("[data-background-color-preview]").forEach((el) => {
    el.style.background = appearance.backgroundColor;
  });

  document.querySelectorAll("[data-beam-color-preview]").forEach((el) => {
    el.style.background = appearance.beamColor;
  });
}

function applyTheme(theme) {
  const safe = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safe);
  setStoredTheme(safe);
  syncThemeUi();
}

function applyAppearanceConfig(appearance = {}) {
  ensureAppearanceStyle();

  const safe = normalizeAppearance(appearance);
  const theme = buildTheme(safe.family, safe.mode);

  applyTheme(theme);
  setStoredAppearance(safe);

  const root = document.documentElement;
  root.style.setProperty("--user-nav-tint", safe.navColor);
  root.style.setProperty("--user-card-tint", safe.cardColor);
  root.style.setProperty("--user-button-tint", safe.buttonColor);
  root.style.setProperty("--user-background-tint", safe.backgroundColor);
  root.style.setProperty("--user-beam-color", safe.beamColor);
  root.setAttribute("data-beam-mode", safe.beamMode);

  syncThemeUi();
}

function resetAppearanceConfig() {
  applyAppearanceConfig({ ...DEFAULT_APPEARANCE });
}

function bindThemeControls() {
  document.querySelectorAll("[data-set-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.getAttribute("data-set-theme");
      if (!theme) return;
      applyTheme(theme);
    });
  });

  document.querySelectorAll("[data-set-family]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const family = btn.getAttribute("data-set-family") || "neutral";
      const current = getStoredAppearance();
      applyAppearanceConfig({
        ...current,
        family
      });
    });
  });

  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-set-mode") || "dark";
      const current = getStoredAppearance();
      applyAppearanceConfig({
        ...current,
        mode
      });

      if (mode === "custom") {
        const customSection = document.querySelector("[data-color-wheel-section]");
        if (customSection) {
          customSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });

  document.querySelectorAll("[data-set-beam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const beamMode = btn.getAttribute("data-set-beam") || "contextual";
      const current = getStoredAppearance();
      applyAppearanceConfig({
        ...current,
        beamMode
      });

      if (beamMode === "custom") {
        const beamInput = document.querySelector("[data-appearance-beam]");
        if (beamInput) beamInput.click();
      }
    });
  });

  const navColor = document.querySelector("[data-appearance-nav]");
  const cardColor = document.querySelector("[data-appearance-card]");
  const buttonColor = document.querySelector("[data-appearance-button]");
  const backgroundColor = document.querySelector("[data-appearance-background]");
  const beamColor = document.querySelector("[data-appearance-beam]");
  const resetBtn = document.querySelector("[data-appearance-reset]");

  if (navColor) {
    navColor.addEventListener("input", () => {
      const current = getStoredAppearance();
      applyAppearanceConfig({ ...current, navColor: navColor.value });
    });
  }

  if (cardColor) {
    cardColor.addEventListener("input", () => {
      const current = getStoredAppearance();
      applyAppearanceConfig({ ...current, cardColor: cardColor.value });
    });
  }

  if (buttonColor) {
    buttonColor.addEventListener("input", () => {
      const current = getStoredAppearance();
      applyAppearanceConfig({ ...current, buttonColor: buttonColor.value });
    });
  }

  if (backgroundColor) {
    backgroundColor.addEventListener("input", () => {
      const current = getStoredAppearance();
      applyAppearanceConfig({ ...current, backgroundColor: backgroundColor.value });
    });
  }

  if (beamColor) {
    beamColor.addEventListener("input", () => {
      const current = getStoredAppearance();
      applyAppearanceConfig({ ...current, beamColor: beamColor.value });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetAppearanceConfig();
      hydrateThemeInputs();
    });
  }
}

function hydrateThemeInputs() {
  const appearance = getStoredAppearance();

  const navColor = document.querySelector("[data-appearance-nav]");
  const cardColor = document.querySelector("[data-appearance-card]");
  const buttonColor = document.querySelector("[data-appearance-button]");
  const backgroundColor = document.querySelector("[data-appearance-background]");
  const beamColor = document.querySelector("[data-appearance-beam]");

  if (navColor) navColor.value = appearance.navColor;
  if (cardColor) cardColor.value = appearance.cardColor;
  if (buttonColor) buttonColor.value = appearance.buttonColor;
  if (backgroundColor) backgroundColor.value = appearance.backgroundColor;
  if (beamColor) beamColor.value = appearance.beamColor;

  syncThemeUi();
}

function markBeamTargets() {
  document.querySelectorAll(`
    .glass-card,
    .glass-shell,
    .aurora-card,
    .settings-chip,
    .settings-preview-btn,
    .settings-preview-nav,
    .settings-color-tool,
    .dashboard-nav-link,
    .eva-link,
    .btn
  `).forEach((el) => {
    el.classList.add("beam-target");
  });
}

function initTheme() {
  ensureAppearanceStyle();
  applyAppearanceConfig(getStoredAppearance());
  bindThemeControls();
  hydrateThemeInputs();
  markBeamTargets();
}

window.EvaraTheme = {
  initTheme,
  applyTheme,
  applyAppearanceConfig,
  resetAppearanceConfig,
  getStoredAppearance,
  setStoredAppearance,
  normalizeAppearance,
  hydrateThemeInputs
};

document.addEventListener("DOMContentLoaded", initTheme);