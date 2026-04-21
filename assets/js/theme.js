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
  beamMode: "off",
  cardColor: "#8B5CF6",
  buttonColor: "#4F7CFF",
  backgroundColor: "#0F172A",
  beamColor: "#8B5CF6"
};

const PRESET_LIGHT = {
  mode: "light",
  baseFamily: "light",
  beamMode: "off",
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
let remoteHydrated = false;
let draftAppearance = null;

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
  return ["off", "rainbow"].includes(safe) ? safe : "off";
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

function cloneAppearance(value) {
  return JSON.parse(JSON.stringify(normalizeAppearance(value || getStoredAppearance())));
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
  const safe = normalizeAppearance(appearance);
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(safe));
  } catch {}
  return safe;
}

function getWorkingAppearance() {
  return draftAppearance ? cloneAppearance(draftAppearance) : cloneAppearance(getStoredAppearance());
}

function setWorkingAppearance(appearance) {
  draftAppearance = cloneAppearance(appearance);
  return draftAppearance;
}

function clearWorkingAppearance() {
  draftAppearance = null;
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
  `;
  document.head.appendChild(styleEl);
  return styleEl;
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

function applyTheme(theme) {
  const safe = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safe);
  setStoredTheme(safe);

  if (document.body) {
    document.body.setAttribute("data-theme-active", safe);
  }

  window.dispatchEvent(
    new CustomEvent("evara:theme-changed", {
      detail: { theme: safe }
    })
  );
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
}

async function persistAppearance(appearance) {
  const safe = setStoredAppearance(appearance);
  if (auth.currentUser) {
    await saveUserThemePreferences(safe);
  }
  return safe;
}

async function applyAppearanceConfig(appearance = {}) {
  const safe = normalizeAppearance(appearance);

  if (safe.mode === "custom") {
    setStoredBaseFamily(safe.baseFamily);
  } else {
    setStoredBaseFamily(safe.mode);
  }

  clearWorkingAppearance();
  await persistAppearance(safe);
  applyAppearanceTokens(safe);
  hydrateThemeInputs();
  syncThemeUi();
  return safe;
}

function applyAppearanceConfigLocalOnly(appearance = {}) {
  const safe = normalizeAppearance(appearance);

  if (safe.mode === "custom") {
    setStoredBaseFamily(safe.baseFamily);
  } else {
    setStoredBaseFamily(safe.mode);
  }

  setWorkingAppearance(safe);
  applyAppearanceTokens(safe);
  hydrateThemeInputs();
  syncThemeUi();
  return safe;
}

async function saveWorkingAppearance() {
  return applyAppearanceConfig(getWorkingAppearance());
}

function discardWorkingAppearance() {
  const saved = getStoredAppearance();
  clearWorkingAppearance();
  applyAppearanceTokens(saved);
  hydrateThemeInputs();
  syncThemeUi();
  closeColorSheet();
  closeCustomSheet();
}

async function resetAppearanceConfig() {
  const fallback = getPresetAppearance(getStoredBaseFamily());
  return applyAppearanceConfig({ ...fallback });
}

function syncThemeUi() {
  const appearance = getWorkingAppearance();

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
    } else if (appearance.mode === "light") {
      el.textContent = "Light";
    } else {
      el.textContent = "Dark";
    }
  });

  const beamText = appearance.beamMode === "rainbow" ? "On" : "Off";
  document.querySelectorAll("[data-beam-mode-text]").forEach((el) => {
    el.textContent = beamText;
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
      el.textContent = value.toUpperCase();
    });
  });

  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    const mode = btn.getAttribute("data-set-mode");
    btn.classList.toggle("is-active", mode === appearance.mode);
  });

  const beamToggle = document.getElementById("settingsBeamToggle");
  if (beamToggle) {
    beamToggle.checked = appearance.beamMode === "rainbow";
  }

  const saveBar = document.getElementById("settingsSaveBar");
  if (saveBar) {
    const saved = normalizeAppearance(getStoredAppearance());
    const working = normalizeAppearance(appearance);
    const isDirty = JSON.stringify(saved) !== JSON.stringify(working);
    saveBar.classList.toggle("show", isDirty);
  }
}

function hydrateThemeInputs() {
  const appearance = getWorkingAppearance();

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

  const appearance = getWorkingAppearance();
  activeColorSheetTarget = targetKey;

  const currentValue = appearance[targetKey] || "#FFFFFF";

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

function openCustomSheet() {
  const sheet = document.getElementById("settingsCustomSheet");
  if (!sheet) return;
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeCustomSheet() {
  const sheet = document.getElementById("settingsCustomSheet");
  if (!sheet) return;
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
}

function bindColorSheet() {
  const { sheetInput, sheetSwatch, sheetValue } = getColorSheetEls();
  if (!sheetInput || !sheetSwatch || !sheetValue) return;

  const updateDraftColor = (value) => {
    if (!activeColorSheetTarget) return;

    const current = getWorkingAppearance();
    const next = {
      ...current,
      mode: "custom",
      baseFamily:
        current.mode === "custom"
          ? current.baseFamily
          : getStoredBaseFamily(),
      [activeColorSheetTarget]: value
    };

    applyAppearanceConfigLocalOnly(next);
    sheetSwatch.style.background = value;
    sheetValue.textContent = value.toUpperCase();
  };

  sheetInput.addEventListener("input", () => {
    updateDraftColor(normalizeHex(sheetInput.value, "#FFFFFF"));
  });

  sheetInput.addEventListener("change", () => {
    updateDraftColor(normalizeHex(sheetInput.value, "#FFFFFF"));
  });

  document.querySelectorAll("[data-color-sheet-close]").forEach((btn) => {
    btn.addEventListener("click", closeColorSheet);
  });

  const doneBtn = document.getElementById("settingsColorSheetDoneBtn");
  if (doneBtn) {
    doneBtn.addEventListener("click", closeColorSheet);
  }
}

function bindColorWheelOpeners() {
  const mapping = [
    [".settings-color-open[data-open-target='cardColor']", "cardColor", "Surface Tint"],
    [".settings-color-open[data-open-target='buttonColor']", "buttonColor", "Button Tint"],
    [".settings-color-open[data-open-target='backgroundColor']", "backgroundColor", "Background Aura"],
    [".settings-color-open[data-open-target='beamColor']", "beamColor", "Beam Color"]
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

function bindCustomSheet() {
  document.querySelectorAll("[data-open-custom-editor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const current = getWorkingAppearance();
      if (current.mode !== "custom") {
        applyAppearanceConfigLocalOnly({
          ...current,
          mode: "custom",
          baseFamily:
            current.mode === "custom"
              ? current.baseFamily
              : current.mode === "galaxy"
              ? "galaxy"
              : current.mode === "light"
              ? "light"
              : "dark"
        });
      }
      openCustomSheet();
    });
  });

  document.querySelectorAll("[data-custom-sheet-close]").forEach((btn) => {
    btn.addEventListener("click", closeCustomSheet);
  });
}

function bindThemeControls() {
  if (hasBoundThemeControls) return;
  hasBoundThemeControls = true;

  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-set-mode") || "dark";
      const current = getWorkingAppearance();

      const preset = getPresetAppearance(mode);
      applyAppearanceConfigLocalOnly({
        ...preset,
        mode,
        baseFamily: mode,
        beamMode: current.beamMode,
        beamColor: current.beamColor
      });
    });
  });

  const beamToggle = document.getElementById("settingsBeamToggle");
  if (beamToggle) {
    beamToggle.addEventListener("change", () => {
      const current = getWorkingAppearance();
      applyAppearanceConfigLocalOnly({
        ...current,
        beamMode: beamToggle.checked ? "rainbow" : "off"
      });
    });
  }

  document.querySelectorAll("[data-appearance-reset]").forEach((resetBtn) => {
    resetBtn.addEventListener("click", async () => {
      await resetAppearanceConfig();
    });
  });

  const saveBtn = document.getElementById("settingsSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await saveWorkingAppearance();
      closeCustomSheet();
      closeColorSheet();
    });
  }

  const discardBtn = document.getElementById("settingsDiscardBtn");
  if (discardBtn) {
    discardBtn.addEventListener("click", () => {
      discardWorkingAppearance();
    });
  }
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
  if (remoteHydrated) return;
  if (!auth.currentUser) return;

  const remotePrefs = await getUserThemePreferences();
  if (!remotePrefs) {
    remoteHydrated = true;
    return;
  }

  clearWorkingAppearance();
  setStoredAppearance(remotePrefs);
  applyAppearanceTokens(remotePrefs);
  hydrateThemeInputs();
  syncThemeUi();
  remoteHydrated = true;
}

async function initTheme() {
  ensureAppearanceStyle();

  const localAppearance = getStoredAppearance();
  clearWorkingAppearance();
  applyAppearanceTokens(localAppearance);

  bindThemeControls();
  bindColorSheet();
  bindColorWheelOpeners();
  bindCustomSheet();
  hydrateThemeInputs();
  syncThemeUi();
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
  saveWorkingAppearance,
  discardWorkingAppearance,
  resetAppearanceConfig,
  getStoredAppearance,
  getWorkingAppearance,
  setStoredAppearance,
  normalizeAppearance,
  hydrateThemeInputs,
  openColorSheet,
  closeColorSheet,
  openCustomSheet,
  closeCustomSheet
};

document.addEventListener("DOMContentLoaded", async () => {
  await initTheme();

  if (document.body) {
    const activeTheme = document.documentElement.getAttribute("data-theme") || "dark";
    document.body.setAttribute("data-theme-active", activeTheme);
  }

  window.dispatchEvent(
    new CustomEvent("evara:theme-ready", {
      detail: {
        theme: document.documentElement.getAttribute("data-theme") || "dark",
        appearance: getWorkingAppearance()
      }
    })
  );
});