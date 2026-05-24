import {
  getAppearance,
  saveAppearance,
  resetAppearance,
  applyAppearance,
  setText,
  setMessage,
  markSettingsReady
} from "./settings-shared.js";

const VALID_MODES = ["light", "dark", "system"];
let draft = getAppearance();

function normalizeMode(mode) {
  return VALID_MODES.includes(mode) ? mode : "light";
}

function modeLabel(mode) {
  const safe = normalizeMode(mode);
  if (safe === "dark") return "Dark";
  if (safe === "system") return "System";
  return "Light";
}

function cleanDraft(value = {}) {
  return {
    mode: normalizeMode(value.mode),
    updatedAt: value.updatedAt || null
  };
}

function syncControls() {
  draft = cleanDraft(draft);
  setText("appearanceModeLabel", modeLabel(draft.mode));

  document.querySelectorAll("[data-appearance-mode]").forEach((button) => {
    const mode = normalizeMode(button.dataset.appearanceMode);
    button.classList.toggle("is-active", mode === draft.mode);
  });

  applyAppearance(draft);
}

function updateDraft(mode) {
  draft = {
    mode: normalizeMode(mode),
    updatedAt: new Date().toISOString()
  };

  syncControls();
  setMessage("appearanceSaveMessage", "Unsaved appearance changes.");
}

function bindModeButtons() {
  document.querySelectorAll("[data-appearance-mode]").forEach((button) => {
    button.addEventListener("click", () => updateDraft(button.dataset.appearanceMode));
  });
}

function bindActions() {
  const saveBtn = document.getElementById("saveAppearanceBtn");
  const resetBtn = document.getElementById("resetAppearanceBtn");

  saveBtn?.addEventListener("click", () => {
    draft = saveAppearance(cleanDraft(draft));
    syncControls();
    setMessage("appearanceSaveMessage", "Appearance saved.");
  });

  resetBtn?.addEventListener("click", () => {
    draft = resetAppearance();
    syncControls();
    setMessage("appearanceSaveMessage", "Appearance reset to default.");
  });
}

function init() {
  draft = cleanDraft(getAppearance());
  bindModeButtons();
  bindActions();
  syncControls();
  markSettingsReady();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
