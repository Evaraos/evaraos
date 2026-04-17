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
  beamMode: "on",
  navColor: "#ff3b30",
  cardColor: "#8b5cf6",
  buttonColor: "#2563eb",
  backgroundColor: "#0f172a",
  beamColor: "#7c3aed"
};

function normalizeTheme(theme = "") {
  const value = String(theme || "").trim().toLowerCase();
  return VALID_THEMES.includes(value) ? value : DEFAULT_THEME;
}

function normalizeHex(value, fallback) {
  const safe = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(safe) ? safe : fallback;
}

function normalizeBeamMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["off", "on", "rainbow", "custom"].includes(safe) ? safe : "on";
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
  } catch {
    // ignore
  }
}

function getThemeParts(theme = DEFAULT_THEME) {
  const safe = normalizeTheme(theme);

  if (safe === "dark") return { mode: "dark", family: "neutral" };
  if (safe === "light") return { mode: "light", family: "neutral" };

  const [family, mode] = safe.split("-");
  return {
    family: family || "neutral",
    mode: mode === "light" ? "light" : "dark"
  };
}

function buildTheme(family = "neutral", mode = "dark") {
  const safeMode = mode === "light" ? "light" : "dark";
  if (family === "neutral") return safeMode;
  const candidate = `${family}-${safeMode}`;
  return VALID_THEMES.includes(candidate) ? candidate : DEFAULT_THEME;
}

function getStoredAppearance() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}");
    return normalizeAppearance(parsed);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function setStoredAppearance(appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(normalizeAppearance(appearance)));
  } catch {
    // ignore
  }
}

function normalizeAppearance(appearance = {}) {
  const theme = getThemeParts(buildTheme(appearance.family || DEFAULT_APPEARANCE.family, appearance.mode || DEFAULT_APPEARANCE.mode));
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
        radial-gradient(circle at top left, color-mix(in srgb, var(--user-background-tint) 22%, transparent), transparent 42%),
        radial-gradient(circle at bottom right, color-mix(in srgb, var(--user-nav-tint) 16%, transparent), transparent 44%);
    }

    .glass-card,
    .glass-shell,
    .aurora-card,
    .input-shell {
      border-color: color-mix(in srgb, var(--user-card-tint) 28%, rgba(255,255,255,0.10));
      box-shadow:
        0 18px 40px rgba(0,0,0,0.14),
        inset 0 1px 0 rgba(255,255,255,0.12);
    }

    .btn-theme-primary,
    .settings-preview-action {
      background: color-mix(in srgb, var(--user-button-tint) 42%, rgba(255,255,255,0.10));
      border-color: color-mix(in srgb, var(--user-button-tint) 65%, rgba(255,255,255,0.12));
      box-shadow: 0 14px 28px color-mix(in srgb, var(--user-button-tint) 20%, transparent);
    }

    #evaNavPill,
    .eva-nav-pill {
      border-color: color-mix(in srgb, var(--user-nav-tint) 30%, rgba(255,255,255,0.12));
      box-shadow:
        0 14px 30px rgba(0,0,0,0.16),
        inset 0 1px 0 rgba(255,255,255,0.16),
        0 0 0 1px color-mix(in srgb, var(--user-nav-tint) 18%, transparent);
    }

    .dashboard-nav-link.active,
    .eva-link.active,
    .input-shell:focus-within,
    .settings-preview-card,
    .settings-preview-nav {
      position: relative;
      overflow: hidden;
    }

    html[data-beam-mode="off"] .dashboard-nav-link.active,
    html[data-beam-mode="off"] .eva-link.active,
    html[data-beam-mode="off"] .input-shell:focus-within,
    html[data-beam-mode="off"] .settings-preview-card,
    html[data-beam-mode="off"] .settings-preview-nav {
      box-shadow:
        0 14px 30px rgba(0,0,0,0.14),
        inset 0 1px 0 rgba(255,255,255,0.10);
    }

    html[data-beam-mode="on"] .dashboard-nav-link.active,
    html[data-beam-mode="on"] .eva-link.active,
    html[data-beam-mode="on"] .input-shell:focus-within,
    html[data-beam-mode="custom"] .dashboard-nav-link.active,
    html[data-beam-mode="custom"] .eva-link.active,
    html[data-beam-mode="custom"] .input-shell:focus-within,
    html[data-beam-mode="on"] .settings-preview-card,
    html[data-beam-mode="custom"] .settings-preview-card,
    html[data-beam-mode="on"] .settings-preview-nav,
    html[data-beam-mode="custom"] .settings-preview-nav {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--user-beam-color) 55%, transparent),
        0 0 22px color-mix(in srgb, var(--user-beam-color) 28%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.18);
    }

    html[data-beam-mode="rainbow"] .dashboard-nav-link.active,
    html[data-beam-mode="rainbow"] .eva-link.active,
    html[data-beam-mode="rainbow"] .input-shell:focus-within,
    html[data-beam-mode="rainbow"] .settings-preview-card,
    html[data-beam-mode="rainbow"] .settings-preview-nav {
      animation: evaraRainbowBeam 5s linear infinite;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.16),
        0 0 22px rgba(255,255,255,0.16),
        inset 0 1px 0 rgba(255,255,255,0.18);
    }

    @keyframes evaraRainbowBeam {
      0%   { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);
  return styleEl;
}

function syncThemeUi() {
  const currentTheme = getStoredTheme();
  const current = getThemeParts(currentTheme);

  document.querySelectorAll("[data-theme-mode-text]").forEach((el) => {
    el.textContent = current.mode === "dark" ? "Dark" : "Light";
  });

  document.querySelectorAll("[data-theme-group-text]").forEach((el) => {
    const label =
      current.family === "neutral"
        ? "Neutral"
        : current.family.charAt(0).toUpperCase() + current.family.slice(1);
    el.textContent = label;
  });

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const family = bubble.getAttribute("data-theme-family") || "neutral";
    const active = family === current.family;
    bubble.classList.toggle("active", active);
    bubble.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function applyTheme(theme) {
  const safe = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safe);
  setStoredTheme(safe);
  syncThemeUi();
}

function applyAppearanceConfig(appearance = {}) {
  const safe = normalizeAppearance(appearance);
  ensureAppearanceStyle();

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
}

function toggleMode() {
  const current = getThemeParts(getStoredTheme());
  const nextMode = current.mode === "dark" ? "light" : "dark";
  const appearance = getStoredAppearance();
  applyAppearanceConfig({
    ...appearance,
    mode: nextMode
  });
}

function setFamily(family) {
  const appearance = getStoredAppearance();
  applyAppearanceConfig({
    ...appearance,
    family
  });
}

function initTheme() {
  ensureAppearanceStyle();
  applyAppearanceConfig(getStoredAppearance());
}

window.EvaraTheme = {
  initTheme,
  syncThemeUi,
  toggleMode,
  setFamily,
  applyTheme,
  applyAppearanceConfig,
  getStoredAppearance,
  setStoredAppearance
};

document.addEventListener("DOMContentLoaded", initTheme);