import {
  auth,
  getUserThemePreferences,
  saveUserThemePreferences
} from "./firebase.js";

const STORAGE_KEY = "evaraos-theme";
const APPEARANCE_KEY = "evaraos-appearance";
const BASE_FAMILY_KEY = "evaraos-last-base-family";

const PRESET_DARK = {
  mode: "dark",
  baseFamily: "dark",
  beamMode: "contextual",
  cardColor: "#8B5CF6",
  buttonColor: "#4F7CFF",
  backgroundColor: "#0F172A",
  beamColor: "#8B5CF6"
};

const PRESET_LIGHT = {
  mode: "light",
  baseFamily: "light",
  beamMode: "contextual",
  cardColor: "#C4B5FD",
  buttonColor: "#7DB7FF",
  backgroundColor: "#F5F7FB",
  beamColor: "#A78BFA"
};

const PRESET_GALAXY = {
  mode: "galaxy",
  baseFamily: "galaxy",
  beamMode: "rainbow",
  cardColor: "#D6A8FF",
  buttonColor: "#FF8BD7",
  backgroundColor: "#120A22",
  beamColor: "#E3A6FF"
};

let activeColorSheetTarget = null;
let hasBoundThemeControls = false;

function normalizeTheme(theme = "") {
  const value = String(theme || "").trim().toLowerCase();
  if (value === "light") return "light";
  if (value === "galaxy") return "galaxy";
  return "dark";
}

function normalizeHex(value, fallback) {
  const safe = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(safe) ? safe : fallback.toUpperCase();
}

function normalizeMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["dark", "light", "custom", "galaxy"].includes(safe) ? safe : "dark";
}

function normalizeBaseFamily(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["light", "dark", "galaxy"].includes(safe) ? safe : "dark";
}

function normalizeBeamMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["off", "contextual", "rainbow"].includes(safe) ? safe : "contextual";
}

function getPresetAppearance(baseFamily = "dark") {
  if (baseFamily === "light") return { ...PRESET_LIGHT };
  if (baseFamily === "galaxy") return { ...PRESET_GALAXY };
  return { ...PRESET_DARK };
}

function getStoredBaseFamily() {
  try {
    return normalizeBaseFamily(localStorage.getItem(BASE_FAMILY_KEY) || "dark");
  } catch {
    return "dark";
  }
}

function setStoredBaseFamily(baseFamily = "dark") {
  try {
    localStorage.setItem(BASE_FAMILY_KEY, normalizeBaseFamily(baseFamily));
  } catch {}
}

function normalizeAppearance(appearance = {}) {
  const requestedMode = normalizeMode(appearance.mode || "dark");
  const rememberedBase =
    requestedMode === "custom"
      ? normalizeBaseFamily(appearance.baseFamily || getStoredBaseFamily())
      : requestedMode;

  const baseFamily =
    requestedMode === "light"
      ? "light"
      : requestedMode === "dark"
      ? "dark"
      : requestedMode === "galaxy"
      ? "galaxy"
      : rememberedBase;

  const preset = getPresetAppearance(baseFamily);

  return {
    mode: requestedMode,
    baseFamily,
    beamMode: normalizeBeamMode(appearance.beamMode || preset.beamMode),
    cardColor: normalizeHex(appearance.cardColor, preset.cardColor),
    buttonColor: normalizeHex(appearance.buttonColor, preset.buttonColor),
    backgroundColor: normalizeHex(appearance.backgroundColor, preset.backgroundColor),
    beamColor: normalizeHex(appearance.beamColor, preset.beamColor)
  };
}

function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY) || "dark");
  } catch {
    return "dark";
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
    if (!raw) return { ...PRESET_DARK };
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return { ...PRESET_DARK };
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
      --user-card-tint: ${PRESET_DARK.cardColor};
      --user-button-tint: ${PRESET_DARK.buttonColor};
      --user-background-tint: ${PRESET_DARK.backgroundColor};
      --user-bg-color: ${PRESET_DARK.backgroundColor};
      --user-bg-color-2: ${PRESET_DARK.cardColor};
      --user-beam-color: ${PRESET_DARK.beamColor};
      --user-nav-tint: ${PRESET_DARK.cardColor};
    }

    body {
      background-image:
        radial-gradient(circle at 18% 14%, color-mix(in srgb, var(--user-background-tint) 16%, transparent), transparent 28%),
        radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--user-card-tint) 10%, transparent), transparent 24%),
        radial-gradient(circle at 18% 84%, color-mix(in srgb, var(--user-card-tint) 8%, transparent), transparent 24%) !important;
    }

    html[data-theme="light"] body,
    html[data-theme$="-light"] body {
      background-image:
        radial-gradient(circle at 18% 14%, color-mix(in srgb, var(--user-background-tint) 18%, white), transparent 28%),
        radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--user-card-tint) 12%, transparent), transparent 24%),
        radial-gradient(circle at 18% 84%, color-mix(in srgb, var(--user-card-tint) 8%, transparent), transparent 24%) !important;
    }

    html[data-theme="galaxy"] body {
      background-image:
        radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--user-background-tint) 26%, transparent), transparent 18%),
        radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--user-card-tint) 22%, transparent), transparent 24%),
        radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--user-button-tint) 18%, transparent), transparent 24%),
        radial-gradient(circle at 22% 84%, color-mix(in srgb, var(--user-beam-color) 14%, transparent), transparent 24%) !important;
    }

    .glass-card,
    .glass-shell,
    .aurora-card,
    .input-shell,
    .feature-card,
    .inline-card,
    .dashboard-feed-item,
    .dashboard-stat-card,
    .login-panel,
    .auth-panel,
    .dashboard-panel,
    .dashboard-hero,
    .dashboard-overview,
    .dashboard-sidebar-inner,
    .settings-preview-card,
    .settings-color-tool,
    .settings-mini-card,
    .stats-card,
    .section-panel,
    .cta-panel,
    .site-footer-inner,
    .eva-nav-pill,
    #evaNavPill,
    .eva-menu-panel,
    .settings-preview-nav,
    .settings-block,
    .settings-hero {
      border-color: color-mix(in srgb, var(--user-card-tint) 22%, rgba(255,255,255,0.12)) !important;
      box-shadow:
        0 18px 34px rgba(0,0,0,0.14),
        inset 0 1px 0 rgba(255,255,255,0.10),
        0 0 0 1px color-mix(in srgb, var(--user-card-tint) 8%, transparent) !important;
    }

    html[data-theme="galaxy"] .glass-card,
    html[data-theme="galaxy"] .glass-shell,
    html[data-theme="galaxy"] .aurora-card,
    html[data-theme="galaxy"] .input-shell,
    html[data-theme="galaxy"] .feature-card,
    html[data-theme="galaxy"] .inline-card,
    html[data-theme="galaxy"] .dashboard-feed-item,
    html[data-theme="galaxy"] .dashboard-stat-card,
    html[data-theme="galaxy"] .login-panel,
    html[data-theme="galaxy"] .auth-panel,
    html[data-theme="galaxy"] .dashboard-panel,
    html[data-theme="galaxy"] .dashboard-hero,
    html[data-theme="galaxy"] .dashboard-overview,
    html[data-theme="galaxy"] .dashboard-sidebar-inner,
    html[data-theme="galaxy"] .settings-preview-card,
    html[data-theme="galaxy"] .settings-color-tool,
    html[data-theme="galaxy"] .settings-mini-card,
    html[data-theme="galaxy"] .stats-card,
    html[data-theme="galaxy"] .section-panel,
    html[data-theme="galaxy"] .cta-panel,
    html[data-theme="galaxy"] .site-footer-inner,
    html[data-theme="galaxy"] .eva-nav-pill,
    html[data-theme="galaxy"] #evaNavPill,
    html[data-theme="galaxy"] .eva-menu-panel,
    html[data-theme="galaxy"] .settings-preview-nav,
    html[data-theme="galaxy"] .settings-block,
    html[data-theme="galaxy"] .settings-hero {
      box-shadow:
        0 24px 42px rgba(12,4,24,0.24),
        inset 0 1px 0 rgba(255,255,255,0.10),
        0 0 0 1px color-mix(in srgb, var(--user-card-tint) 12%, transparent),
        0 0 28px color-mix(in srgb, var(--user-beam-color) 12%, transparent) !important;
    }

    .eva-nav-pill,
    #evaNavPill,
    .settings-preview-nav {
      background:
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--user-card-tint) 10%, rgba(255,255,255,0.06)),
          rgba(255,255,255,0.02)
        ) !important;
    }

    .btn,
    .btn-apple,
    .btn-theme-primary,
    .btn-theme-secondary,
    .settings-preview-btn,
    .settings-chip,
    .settings-section-link,
    .settings-color-open,
    .settings-color-sheet-close,
    .eva-chip,
    .eva-link,
    .eva-menu-btn {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--user-button-tint) 10%, rgba(255,255,255,0.22)),
          color-mix(in srgb, var(--user-button-tint) 4%, rgba(255,255,255,0.06))
        ) !important;
      border-color: color-mix(in srgb, var(--user-button-tint) 18%, rgba(255,255,255,0.12)) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.22),
        inset 0 -1px 0 rgba(255,255,255,0.04),
        0 10px 22px rgba(0,0,0,0.10),
        0 0 0 1px color-mix(in srgb, var(--user-button-tint) 6%, transparent) !important;
      backdrop-filter: blur(16px) saturate(145%) !important;
      -webkit-backdrop-filter: blur(16px) saturate(145%) !important;
    }

    html[data-theme="galaxy"] .btn,
    html[data-theme="galaxy"] .btn-apple,
    html[data-theme="galaxy"] .btn-theme-primary,
    html[data-theme="galaxy"] .btn-theme-secondary,
    html[data-theme="galaxy"] .settings-preview-btn,
    html[data-theme="galaxy"] .settings-chip,
    html[data-theme="galaxy"] .settings-section-link,
    html[data-theme="galaxy"] .settings-color-open,
    html[data-theme="galaxy"] .settings-color-sheet-close,
    html[data-theme="galaxy"] .eva-chip,
    html[data-theme="galaxy"] .eva-link,
    html[data-theme="galaxy"] .eva-menu-btn {
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.24),
        inset 0 -1px 0 rgba(255,255,255,0.04),
        0 14px 26px rgba(12,4,24,0.20),
        0 0 18px color-mix(in srgb, var(--user-button-tint) 12%, transparent),
        0 0 0 1px color-mix(in srgb, var(--user-button-tint) 8%, transparent) !important;
    }

    .btn::before,
    .btn-apple::before,
    .btn-theme-primary::before,
    .btn-theme-secondary::before,
    .settings-preview-btn::before,
    .settings-chip::before,
    .settings-section-link::before,
    .settings-color-open::before,
    .settings-color-sheet-close::before,
    .eva-chip::before,
    .eva-link::before,
    .eva-menu-btn::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background:
        linear-gradient(
          135deg,
          rgba(255,255,255,0.22),
          rgba(255,255,255,0.06) 34%,
          transparent 58%
        );
      opacity: 0.92;
      z-index: 0;
    }

    .btn > *,
    .btn-apple > *,
    .btn-theme-primary > *,
    .btn-theme-secondary > *,
    .settings-preview-btn > *,
    .settings-chip > *,
    .settings-section-link > *,
    .settings-color-open > *,
    .settings-color-sheet-close > *,
    .eva-chip > *,
    .eva-link > *,
    .eva-menu-btn > * {
      position: relative;
      z-index: 1;
    }

    .page-grid-overlay {
      background-image:
        linear-gradient(color-mix(in srgb, var(--user-card-tint) 8%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--user-card-tint) 8%, transparent) 1px, transparent 1px) !important;
      opacity: 0.16 !important;
    }

    html[data-theme="galaxy"] .page-grid-overlay {
      opacity: 0.14 !important;
      background-image:
        linear-gradient(color-mix(in srgb, var(--user-card-tint) 10%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--user-beam-color) 8%, transparent) 1px, transparent 1px) !important;
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
    html:not([data-beam-mode]) .beam-target:hover,
    html:not([data-beam-mode]) .beam-target.is-active,
    html:not([data-beam-mode]) .dashboard-nav-link.active,
    html:not([data-beam-mode]) .eva-link.active,
    html:not([data-beam-mode]) .input-shell:focus-within,
    html:not([data-beam-mode]) .btn:focus-visible {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--user-beam-color) 46%, transparent),
        0 0 18px color-mix(in srgb, var(--user-beam-color) 18%, transparent),
        0 0 30px color-mix(in srgb, var(--user-beam-color) 8%, transparent),
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
        0 0 0 1px color-mix(in srgb, var(--user-beam-color) 16%, transparent),
        0 0 14px color-mix(in srgb, var(--user-beam-color) 8%, transparent),
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
      background:
        linear-gradient(
          120deg,
          color-mix(in srgb, var(--user-beam-color) 26%, #ff3b30),
          color-mix(in srgb, var(--user-beam-color) 18%, #ff9500),
          color-mix(in srgb, var(--user-beam-color) 18%, #ffd60a),
          color-mix(in srgb, var(--user-beam-color) 16%, #34c759),
          color-mix(in srgb, var(--user-beam-color) 16%, #0a84ff),
          color-mix(in srgb, var(--user-beam-color) 16%, #5e5ce6),
          color-mix(in srgb, var(--user-beam-color) 18%, #bf5af2),
          color-mix(in srgb, var(--user-beam-color) 22%, #ff2d55),
          color-mix(in srgb, var(--user-beam-color) 26%, #ff3b30)
        );
      background-size: 220% 220%;
      animation: evaraRainbowFlow 5.8s linear infinite;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-composite: exclude;
      pointer-events: none;
      z-index: 3;
      opacity: 0.82;
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
  const currentTheme = getStoredTheme();
  const appearance = getStoredAppearance();

  document.querySelectorAll("[data-theme-mode-text]").forEach((el) => {
    if (appearance.mode === "custom") {
      const label =
        appearance.baseFamily === "light"
          ? "Custom (Light)"
          : appearance.baseFamily === "galaxy"
          ? "Custom (Galaxy)"
          : "Custom (Dark)";
      el.textContent = label;
    } else if (appearance.mode === "galaxy") {
      el.textContent = "Galaxy";
    } else {
      el.textContent = currentTheme === "light" ? "Light" : currentTheme === "galaxy" ? "Galaxy" : "Dark";
    }
  });

  document.querySelectorAll("[data-beam-mode-text]").forEach((el) => {
    const label =
      appearance.beamMode === "contextual"
        ? "Contextual"
        : appearance.beamMode.charAt(0).toUpperCase() + appearance.beamMode.slice(1);
    el.textContent = label;
  });

  const previewMap = [
    ["[data-card-color-preview]", appearance.cardColor],
    ["[data-button-color-preview]", appearance.buttonColor],
    ["[data-background-color-preview]", appearance.backgroundColor],
    ["[data-beam-color-preview]", appearance.beamColor]
  ];

  previewMap.forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.background = value;
    });
  });

  const valueMap = [
    ["[data-card-color-value]", appearance.cardColor],
    ["[data-button-color-value]", appearance.buttonColor],
    ["[data-background-color-value]", appearance.backgroundColor],
    ["[data-beam-color-value]", appearance.beamColor]
  ];

  valueMap.forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  });

  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    const mode = btn.getAttribute("data-set-mode");
    btn.classList.toggle("is-active", mode === appearance.mode);
  });

  document.querySelectorAll("[data-set-beam]").forEach((btn) => {
    const mode = btn.getAttribute("data-set-beam");
    btn.classList.toggle("is-active", mode === appearance.beamMode);
  });

  const customSection = document.querySelector("[data-color-wheel-section]");
  if (customSection) {
    customSection.style.display = appearance.mode === "custom" ? "" : "none";
  }
}

function applyTheme(theme) {
  const safe = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safe);
  setStoredTheme(safe);
  syncThemeUi();
}

async function persistAppearance(appearance) {
  setStoredAppearance(appearance);
  await saveUserThemePreferences(appearance);
}

function getEffectiveAppearance(appearance = {}) {
  const safe = normalizeAppearance(appearance);
  const effectiveBase =
    safe.mode === "light"
      ? "light"
      : safe.mode === "dark"
      ? "dark"
      : safe.mode === "galaxy"
      ? "galaxy"
      : safe.baseFamily;

  const preset = safe.mode === "custom" ? safe : getPresetAppearance(effectiveBase);

  return {
    safe,
    effectiveBase,
    preset
  };
}

function applyAppearanceTokens(appearance = {}) {
  ensureAppearanceStyle();

  const { safe, effectiveBase, preset } = getEffectiveAppearance(appearance);

  const root = document.documentElement;
  root.style.setProperty("--user-card-tint", preset.cardColor);
  root.style.setProperty("--user-button-tint", preset.buttonColor);
  root.style.setProperty("--user-background-tint", preset.backgroundColor);
  root.style.setProperty("--user-bg-color", preset.backgroundColor);
  root.style.setProperty("--user-bg-color-2", preset.cardColor);
  root.style.setProperty("--user-beam-color", safe.beamColor);
  root.style.setProperty("--user-nav-tint", preset.cardColor);
  root.setAttribute("data-beam-mode", safe.beamMode);

  applyTheme(
    effectiveBase === "light"
      ? "light"
      : effectiveBase === "galaxy"
      ? "galaxy"
      : "dark"
  );

  syncThemeUi();
}

async function applyAppearanceConfig(appearance = {}) {
  const safe = normalizeAppearance(appearance);

  if (safe.mode === "custom") {
    setStoredBaseFamily(safe.baseFamily);
  } else {
    setStoredBaseFamily(safe.mode);
  }

  setStoredAppearance(safe);
  applyAppearanceTokens(safe);
  await persistAppearance(safe);
}

function applyAppearanceConfigLocalOnly(appearance = {}) {
  const safe = normalizeAppearance(appearance);

  if (safe.mode === "custom") {
    setStoredBaseFamily(safe.baseFamily);
  } else {
    setStoredBaseFamily(safe.mode);
  }

  setStoredAppearance(safe);
  applyAppearanceTokens(safe);
}

function resetAppearanceConfig() {
  const fallback = getPresetAppearance(getStoredBaseFamily());
  applyAppearanceConfig({ ...fallback });
}

function getColorSheetEls() {
  return {
    sheet: document.getElementById("settingsColorSheet"),
    sheetInput: document.getElementById("settingsColorSheetInput"),
    sheetSwatch: document.getElementById("settingsColorSheetSwatch"),
    sheetValue: document.getElementById("settingsColorSheetValue"),
    sheetTitle: document.getElementById("settingsColorSheetTitle")
  };
}

function openColorSheet(targetKey, title) {
  const { sheet, sheetInput, sheetSwatch, sheetValue, sheetTitle } = getColorSheetEls();
  if (!sheet || !sheetInput || !sheetSwatch || !sheetValue || !sheetTitle) return;

  const appearance = getStoredAppearance();
  activeColorSheetTarget = targetKey;

  const currentValue =
    targetKey === "cardColor"
      ? appearance.cardColor
      : targetKey === "buttonColor"
      ? appearance.buttonColor
      : targetKey === "backgroundColor"
      ? appearance.backgroundColor
      : appearance.beamColor;

  sheetTitle.textContent = title;
  sheetInput.value = currentValue;
  sheetSwatch.style.background = currentValue;
  sheetValue.textContent = currentValue.toUpperCase();
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeColorSheet() {
  const { sheet } = getColorSheetEls();
  if (!sheet) return;
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
  activeColorSheetTarget = null;
}

function bindColorSheet() {
  const { sheetInput, sheetSwatch, sheetValue } = getColorSheetEls();
  if (!sheetInput || !sheetSwatch || !sheetValue) return;

  const updateColor = async (value) => {
    if (!activeColorSheetTarget) return;
    const current = getStoredAppearance();

    const next = {
      ...current,
      mode: "custom",
      baseFamily: current.mode === "custom" ? current.baseFamily : getStoredBaseFamily(),
      [activeColorSheetTarget]: value
    };

    await applyAppearanceConfig(next);
    hydrateThemeInputs();
    sheetSwatch.style.background = value;
    sheetValue.textContent = value.toUpperCase();
  };

  sheetInput.addEventListener("input", async () => {
    const value = normalizeHex(sheetInput.value, "#FFFFFF");
    await updateColor(value);
  });

  sheetInput.addEventListener("change", async () => {
    const value = normalizeHex(sheetInput.value, "#FFFFFF");
    await updateColor(value);
  });

  document.querySelectorAll("[data-color-sheet-close]").forEach((btn) => {
    btn.addEventListener("click", closeColorSheet);
  });
}

function bindColorWheelOpeners() {
  const mapping = [
    [".settings-color-open[data-open-target='card']", "cardColor", "Surface Tint"],
    [".settings-color-open[data-open-target='button']", "buttonColor", "Button Tint"],
    [".settings-color-open[data-open-target='background']", "backgroundColor", "Background Aura"],
    [".settings-color-open[data-open-target='beam']", "beamColor", "Beam Color"]
  ];

  mapping.forEach(([selector, key, title]) => {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openColorSheet(key, title);
      });
    });
  });
}

function bindThemeControls() {
  if (hasBoundThemeControls) return;
  hasBoundThemeControls = true;

  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mode = btn.getAttribute("data-set-mode") || "dark";
      const current = getStoredAppearance();

      if (mode === "dark" || mode === "light" || mode === "galaxy") {
        const preset = getPresetAppearance(mode);
        await applyAppearanceConfig({
          ...preset,
          mode,
          baseFamily: mode,
          beamMode: current.beamMode,
          beamColor: current.beamColor
        });
        hydrateThemeInputs();
        return;
      }

      const rememberedBase =
        current.mode === "custom"
          ? current.baseFamily
          : getStoredBaseFamily();

      await applyAppearanceConfig({
        ...current,
        mode: "custom",
        baseFamily: rememberedBase
      });

      hydrateThemeInputs();

      const customSection = document.querySelector("[data-color-wheel-section]");
      if (customSection) {
        customSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  document.querySelectorAll("[data-set-beam]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const beamMode = btn.getAttribute("data-set-beam") || "contextual";
      const current = getStoredAppearance();

      await applyAppearanceConfig({
        ...current,
        beamMode
      });

      hydrateThemeInputs();
    });
  });

  document.querySelectorAll("[data-appearance-reset]").forEach((resetBtn) => {
    resetBtn.addEventListener("click", async () => {
      resetAppearanceConfig();
      hydrateThemeInputs();
    });
  });
}

function hydrateThemeInputs() {
  const appearance = getStoredAppearance();

  document.querySelectorAll("[data-appearance-card]").forEach((input) => {
    input.value = appearance.cardColor;
  });

  document.querySelectorAll("[data-appearance-button]").forEach((input) => {
    input.value = appearance.buttonColor;
  });

  document.querySelectorAll("[data-appearance-background]").forEach((input) => {
    input.value = appearance.backgroundColor;
  });

  document.querySelectorAll("[data-appearance-beam]").forEach((input) => {
    input.value = appearance.beamColor;
  });

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

async function hydrateFromFirestoreIfAvailable() {
  if (!auth.currentUser) return;
  const remotePrefs = await getUserThemePreferences();
  if (!remotePrefs) return;
  applyAppearanceConfigLocalOnly(remotePrefs);
  hydrateThemeInputs();
}

async function initTheme() {
  ensureAppearanceStyle();

  const localAppearance = getStoredAppearance();
  applyAppearanceConfigLocalOnly(localAppearance);

  bindThemeControls();
  bindColorSheet();
  bindColorWheelOpeners();
  hydrateThemeInputs();
  markBeamTargets();

  if (auth.currentUser) {
    await hydrateFromFirestoreIfAvailable();
  }
}

window.EvaraTheme = {
  initTheme,
  applyTheme,
  applyAppearanceConfig,
  applyAppearanceConfigLocalOnly,
  resetAppearanceConfig,
  getStoredAppearance,
  setStoredAppearance,
  normalizeAppearance,
  hydrateThemeInputs
};

document.addEventListener("DOMContentLoaded", initTheme);