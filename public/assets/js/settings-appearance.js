import {
  getAppearance,
  saveAppearance,
  resetAppearance,
  applyAppearance,
  setText,
  setMessage,
  markSettingsReady,
  normalizeAppearanceMode
} from "./settings-shared.js";

let draft = getAppearance();

function byId(id) {
  return document.getElementById(id);
}

function normalizeMode(mode) {
  return normalizeAppearanceMode(mode);
}

function modeLabel(mode) {
  const safe = normalizeMode(mode);

  if (safe === "light") return "Light";
  if (safe === "dark") return "Dark";
  if (safe === "system") return "System";
  if (safe === "galaxy") return "Galaxy";
  if (safe === "custom") return "Custom";

  return "System";
}

function syncControls() {
  setText("appearanceModeLabel", modeLabel(draft.mode));

  document.querySelectorAll("[data-appearance-mode]").forEach((button) => {
    const mode = button.dataset.appearanceMode;
    button.classList.toggle("is-active", mode === draft.mode);
  });

  const cardTint = byId("customCardTint");
  const buttonTint = byId("customButtonTint");
  const beamColor = byId("customBeamColor");
  const backgroundGlow = byId("customBackgroundGlow");
  const rainbowBeam = byId("rainbowBeamToggle");

  if (cardTint) cardTint.value = draft.cardTint || "#ffffff";
  if (buttonTint) buttonTint.value = draft.buttonTint || "#ffffff";
  if (beamColor) beamColor.value = draft.beamColor || "#7c3aed";
  if (backgroundGlow) backgroundGlow.value = draft.backgroundGlow || "#7c3aed";
  if (rainbowBeam) rainbowBeam.checked = !!draft.rainbowBeam;

  applyAppearance(draft);
}

function updateDraft(patch) {
  draft = {
    ...draft,
    ...patch
  };

  draft.mode = normalizeMode(draft.mode);

  if (draft.mode !== "custom") {
    draft.baseFamily = draft.mode;
  }

  if (draft.mode === "custom" && !draft.baseFamily) {
    draft.baseFamily = "dark";
  }

  syncControls();
  setMessage("appearanceSaveMessage", "Unsaved appearance changes.");
}

function bindModeButtons() {
  document.querySelectorAll("[data-appearance-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = normalizeMode(button.dataset.appearanceMode);

      updateDraft({
        mode,
        baseFamily: mode === "custom"
          ? draft.baseFamily || "dark"
          : mode
      });
    });
  });
}

function bindColorControls() {
  const bindings = [
    ["customCardTint", "cardTint"],
    ["customButtonTint", "buttonTint"],
    ["customBeamColor", "beamColor"],
    ["customBackgroundGlow", "backgroundGlow"]
  ];

  bindings.forEach(([id, key]) => {
    const input = byId(id);
    if (!input) return;

    input.addEventListener("input", () => {
      updateDraft({
        mode: "custom",
        [key]: input.value
      });
    });
  });

  const rainbowBeam = byId("rainbowBeamToggle");

  if (rainbowBeam) {
    rainbowBeam.addEventListener("change", () => {
      updateDraft({
        rainbowBeam: rainbowBeam.checked
      });
    });
  }
}

function bindActions() {
  const saveBtn = byId("saveAppearanceBtn");
  const resetBtn = byId("resetAppearanceBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      draft = saveAppearance(draft);
      syncControls();
      setMessage("appearanceSaveMessage", "Appearance saved.");
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      draft = resetAppearance();
      syncControls();
      setMessage("appearanceSaveMessage", "Appearance reset to default.");
    });
  }
}

function init() {
  draft = getAppearance();
  bindModeButtons();
  bindColorControls();
  bindActions();
  syncControls();
  markSettingsReady();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
