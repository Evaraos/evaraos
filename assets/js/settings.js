import { auth, db, applyUserToUi } from "./firebase.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("settingsForm");
const messageEl = document.getElementById("settingsMessage");

const nameInput = document.getElementById("settingsName");
const emailInput = document.getElementById("settingsEmail");

const themeModeInput = document.getElementById("settingsThemeMode");
const themeFamilyInput = document.getElementById("settingsThemeFamily");
const beamModeInput = document.getElementById("settingsBeamMode");

const navColorInput = document.getElementById("settingsNavColor");
const cardColorInput = document.getElementById("settingsCardColor");
const buttonColorInput = document.getElementById("settingsButtonColor");
const backgroundColorInput = document.getElementById("settingsBackgroundColor");
const beamColorInput = document.getElementById("settingsBeamColor");

const navHexInput = document.getElementById("settingsNavHex");
const cardHexInput = document.getElementById("settingsCardHex");
const buttonHexInput = document.getElementById("settingsButtonHex");
const backgroundHexInput = document.getElementById("settingsBackgroundHex");
const beamHexInput = document.getElementById("settingsBeamHex");

const emailAlertsInput = document.getElementById("settingsEmailAlerts");
const pushAlertsInput = document.getElementById("settingsPushAlerts");
const leadDigestInput = document.getElementById("settingsLeadDigest");
const jobUpdatesInput = document.getElementById("settingsJobUpdates");

const defaultViewInput = document.getElementById("settingsDefaultView");
const timezoneInput = document.getElementById("settingsTimezone");
const workspaceNoteInput = document.getElementById("settingsWorkspaceNote");

const saveTopBtn = document.getElementById("saveSettingsTopBtn");
const resetBtn = document.getElementById("settingsResetBtn");
const resetBtnTop = document.getElementById("settingsResetBtnTop");

const heroTitle = document.getElementById("settingsHeroTitle");
const heroText = document.getElementById("settingsHeroText");

const themeStat = document.getElementById("settingsThemeStat");
const themeMeta = document.getElementById("settingsThemeMeta");
const beamStat = document.getElementById("settingsBeamStat");
const beamMeta = document.getElementById("settingsBeamMeta");
const alertsStat = document.getElementById("settingsAlertsStat");
const alertsMeta = document.getElementById("settingsAlertsMeta");
const workspaceStat = document.getElementById("settingsWorkspaceStat");
const workspaceMeta = document.getElementById("settingsWorkspaceMeta");

const summaryFeed = document.getElementById("settingsSummaryFeed");
const beamPreviewLabel = document.getElementById("settingsBeamPreviewLabel");

const modePills = Array.from(document.querySelectorAll("[data-mode-pill]"));
const familyPills = Array.from(document.querySelectorAll("[data-family-pill]"));
const beamPills = Array.from(document.querySelectorAll("[data-beam-pill]"));
const presetButtons = Array.from(document.querySelectorAll("[data-theme-preset]"));

let currentUser = null;
let currentRole = "customer";
let originalSettings = null;

const DEFAULT_SETTINGS = {
  fullName: "",
  email: "",
  themeMode: "dark",
  themeFamily: "neutral",
  beamMode: "on",
  navColor: "#FF3B30",
  cardColor: "#8B5CF6",
  buttonColor: "#2563EB",
  backgroundColor: "#0F172A",
  beamColor: "#7C3AED",
  emailAlerts: true,
  pushAlerts: true,
  leadDigest: true,
  jobUpdates: true,
  defaultView: "overview",
  timezone: "America/New_York",
  workspaceNote: ""
};

function normalizeHex(value, fallback) {
  const safe = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(safe) ? safe : fallback.toUpperCase();
}

function normalizeBeamMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["off", "on", "rainbow", "custom"].includes(safe) ? safe : "on";
}

function capitalize(value = "") {
  const safe = String(value || "").trim();
  return safe ? safe.charAt(0).toUpperCase() + safe.slice(1) : "";
}

function setMessage(text = "", isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#ff9186" : "#8ef0c1";
}

function countEnabledAlerts(data) {
  return [
    Boolean(data.emailAlerts),
    Boolean(data.pushAlerts),
    Boolean(data.leadDigest),
    Boolean(data.jobUpdates)
  ].filter(Boolean).length;
}

function buildThemeLabel(data) {
  return `${capitalize(data.themeFamily)} ${data.themeMode === "light" ? "Light" : "Dark"}`;
}

function syncPillGroup(buttons, value, attr) {
  buttons.forEach((button) => {
    const active = button.getAttribute(attr) === value;
    button.classList.toggle("active", active);
  });
}

function syncModePills(value) {
  syncPillGroup(modePills, value, "data-mode-pill");
}

function syncFamilyPills(value) {
  syncPillGroup(familyPills, value, "data-family-pill");
}

function syncBeamPills(value) {
  syncPillGroup(beamPills, value, "data-beam-pill");
}

function syncHexPair(colorInput, hexInput, fallback) {
  const safe = normalizeHex(colorInput.value, fallback);
  colorInput.value = safe;
  hexInput.value = safe;
}

function readForm() {
  return {
    fullName: nameInput?.value.trim() || "",
    email: emailInput?.value.trim() || "",
    themeMode: themeModeInput?.value === "light" ? "light" : "dark",
    themeFamily: themeFamilyInput?.value || "neutral",
    beamMode: normalizeBeamMode(beamModeInput?.value || "on"),
    navColor: normalizeHex(navColorInput?.value, DEFAULT_SETTINGS.navColor),
    cardColor: normalizeHex(cardColorInput?.value, DEFAULT_SETTINGS.cardColor),
    buttonColor: normalizeHex(buttonColorInput?.value, DEFAULT_SETTINGS.buttonColor),
    backgroundColor: normalizeHex(backgroundColorInput?.value, DEFAULT_SETTINGS.backgroundColor),
    beamColor: normalizeHex(beamColorInput?.value, DEFAULT_SETTINGS.beamColor),
    emailAlerts: Boolean(emailAlertsInput?.checked),
    pushAlerts: Boolean(pushAlertsInput?.checked),
    leadDigest: Boolean(leadDigestInput?.checked),
    jobUpdates: Boolean(jobUpdatesInput?.checked),
    defaultView: defaultViewInput?.value || "overview",
    timezone: timezoneInput?.value.trim() || "America/New_York",
    workspaceNote: workspaceNoteInput?.value.trim() || ""
  };
}

function syncPresetButtons(data) {
  const checks = {
    clean:
      data.navColor === "#FF3B30" &&
      data.cardColor === "#8B5CF6" &&
      data.buttonColor === "#2563EB" &&
      data.backgroundColor === "#0F172A" &&
      data.beamColor === "#7C3AED",
    lava:
      data.navColor === "#FF5A36" &&
      data.cardColor === "#EF4444" &&
      data.buttonColor === "#F97316" &&
      data.backgroundColor === "#1A0D0A" &&
      data.beamColor === "#FB7185",
    ocean:
      data.navColor === "#0EA5E9" &&
      data.cardColor === "#2563EB" &&
      data.buttonColor === "#06B6D4" &&
      data.backgroundColor === "#071520" &&
      data.beamColor === "#22D3EE",
    aurora:
      data.navColor === "#A855F7" &&
      data.cardColor === "#8B5CF6" &&
      data.buttonColor === "#EC4899" &&
      data.backgroundColor === "#0F1020" &&
      data.beamColor === "#22C55E"
  };

  presetButtons.forEach((button) => {
    button.classList.toggle("active", Boolean(checks[button.getAttribute("data-theme-preset")]));
  });
}

function applyAppearance(data) {
  if (window.EvaraTheme?.applyAppearanceConfig) {
    window.EvaraTheme.applyAppearanceConfig({
      mode: data.themeMode,
      family: data.themeFamily,
      beamMode: data.beamMode,
      navColor: data.navColor,
      cardColor: data.cardColor,
      buttonColor: data.buttonColor,
      backgroundColor: data.backgroundColor,
      beamColor: data.beamColor
    });
  }
}

function renderSummary(data) {
  const alertCount = countEnabledAlerts(data);
  const themeLabel = buildThemeLabel(data);

  if (heroTitle) heroTitle.textContent = "Settings loaded";
  if (heroText) heroText.textContent = `${themeLabel} • Beam ${capitalize(data.beamMode)} • ${alertCount} alerts enabled`;

  if (themeStat) themeStat.textContent = data.themeMode === "light" ? "Light" : "Dark";
  if (themeMeta) themeMeta.textContent = `${capitalize(data.themeFamily)} family`;

  if (beamStat) beamStat.textContent = capitalize(data.beamMode);
  if (beamMeta) beamMeta.textContent = data.beamMode === "custom" ? data.beamColor : `${capitalize(data.beamMode)} beam`;

  if (alertsStat) alertsStat.textContent = `${alertCount}/4`;
  if (alertsMeta) alertsMeta.textContent = `${alertCount} notifications enabled`;

  if (workspaceStat) workspaceStat.textContent = capitalize(data.defaultView);
  if (workspaceMeta) workspaceMeta.textContent = data.timezone;

  if (beamPreviewLabel) {
    beamPreviewLabel.textContent = `${capitalize(data.beamMode)} beam preview`;
  }

  if (summaryFeed) {
    summaryFeed.innerHTML = `
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Theme</strong>
        <span class="settings-note">${themeLabel}</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Beam</strong>
        <span class="settings-note">${capitalize(data.beamMode)} • ${data.beamColor}</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Navigation Tint</strong>
        <span class="settings-note">${data.navColor}</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Card Tint</strong>
        <span class="settings-note">${data.cardColor}</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Button Tint</strong>
        <span class="settings-note">${data.buttonColor}</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Background Tint</strong>
        <span class="settings-note">${data.backgroundColor}</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Alerts</strong>
        <span class="settings-note">${alertCount} enabled</span>
      </article>
      <article class="glass-card aurora-card settings-feed-item">
        <strong>Workspace</strong>
        <span class="settings-note">${capitalize(data.defaultView)} • ${data.timezone}</span>
      </article>
    `;
  }

  syncModePills(data.themeMode);
  syncFamilyPills(data.themeFamily);
  syncBeamPills(data.beamMode);
  syncPresetButtons(data);
}

function populateForm(data) {
  if (nameInput) nameInput.value = data.fullName || "";
  if (emailInput) emailInput.value = data.email || "";

  if (themeModeInput) themeModeInput.value = data.themeMode || "dark";
  if (themeFamilyInput) themeFamilyInput.value = data.themeFamily || "neutral";
  if (beamModeInput) beamModeInput.value = data.beamMode || "on";

  if (navColorInput) navColorInput.value = data.navColor || DEFAULT_SETTINGS.navColor;
  if (cardColorInput) cardColorInput.value = data.cardColor || DEFAULT_SETTINGS.cardColor;
  if (buttonColorInput) buttonColorInput.value = data.buttonColor || DEFAULT_SETTINGS.buttonColor;
  if (backgroundColorInput) backgroundColorInput.value = data.backgroundColor || DEFAULT_SETTINGS.backgroundColor;
  if (beamColorInput) beamColorInput.value = data.beamColor || DEFAULT_SETTINGS.beamColor;

  if (navHexInput) navHexInput.value = data.navColor || DEFAULT_SETTINGS.navColor;
  if (cardHexInput) cardHexInput.value = data.cardColor || DEFAULT_SETTINGS.cardColor;
  if (buttonHexInput) buttonHexInput.value = data.buttonColor || DEFAULT_SETTINGS.buttonColor;
  if (backgroundHexInput) backgroundHexInput.value = data.backgroundColor || DEFAULT_SETTINGS.backgroundColor;
  if (beamHexInput) beamHexInput.value = data.beamColor || DEFAULT_SETTINGS.beamColor;

  if (emailAlertsInput) emailAlertsInput.checked = Boolean(data.emailAlerts);
  if (pushAlertsInput) pushAlertsInput.checked = Boolean(data.pushAlerts);
  if (leadDigestInput) leadDigestInput.checked = Boolean(data.leadDigest);
  if (jobUpdatesInput) jobUpdatesInput.checked = Boolean(data.jobUpdates);

  if (defaultViewInput) defaultViewInput.value = data.defaultView || "overview";
  if (timezoneInput) timezoneInput.value = data.timezone || "America/New_York";
  if (workspaceNoteInput) workspaceNoteInput.value = data.workspaceNote || "";

  applyAppearance(data);
  renderSummary(data);
}

function getPreset(name) {
  const presets = {
    clean: {
      navColor: "#FF3B30",
      cardColor: "#8B5CF6",
      buttonColor: "#2563EB",
      backgroundColor: "#0F172A",
      beamColor: "#7C3AED"
    },
    lava: {
      navColor: "#FF5A36",
      cardColor: "#EF4444",
      buttonColor: "#F97316",
      backgroundColor: "#1A0D0A",
      beamColor: "#FB7185"
    },
    ocean: {
      navColor: "#0EA5E9",
      cardColor: "#2563EB",
      buttonColor: "#06B6D4",
      backgroundColor: "#071520",
      beamColor: "#22D3EE"
    },
    aurora: {
      navColor: "#A855F7",
      cardColor: "#8B5CF6",
      buttonColor: "#EC4899",
      backgroundColor: "#0F1020",
      beamColor: "#22C55E"
    }
  };

  return presets[name] || presets.clean;
}

function applyPreset(name) {
  const preset = getPreset(name);

  navColorInput.value = preset.navColor;
  cardColorInput.value = preset.cardColor;
  buttonColorInput.value = preset.buttonColor;
  backgroundColorInput.value = preset.backgroundColor;
  beamColorInput.value = preset.beamColor;

  navHexInput.value = preset.navColor;
  cardHexInput.value = preset.cardColor;
  buttonHexInput.value = preset.buttonColor;
  backgroundHexInput.value = preset.backgroundColor;
  beamHexInput.value = preset.beamColor;

  const data = readForm();
  applyAppearance(data);
  renderSummary(data);
}

async function loadSettings(user) {
  currentUser = user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  let data;

  if (snap.exists()) {
    const saved = snap.data() || {};
    currentRole = saved.role || "customer";

    data = {
      ...DEFAULT_SETTINGS,
      fullName: saved.fullName || saved.displayName || user.displayName || "",
      email: saved.email || user.email || "",
      themeMode: saved.themeMode || saved.appearance?.mode || DEFAULT_SETTINGS.themeMode,
      themeFamily: saved.themeFamily || saved.appearance?.family || DEFAULT_SETTINGS.themeFamily,
      beamMode: saved.beamMode || saved.appearance?.beamMode || DEFAULT_SETTINGS.beamMode,
      navColor: normalizeHex(saved.navColor || saved.appearance?.navColor, DEFAULT_SETTINGS.navColor),
      cardColor: normalizeHex(saved.cardColor || saved.appearance?.cardColor, DEFAULT_SETTINGS.cardColor),
      buttonColor: normalizeHex(saved.buttonColor || saved.appearance?.buttonColor, DEFAULT_SETTINGS.buttonColor),
      backgroundColor: normalizeHex(saved.backgroundColor || saved.appearance?.backgroundColor, DEFAULT_SETTINGS.backgroundColor),
      beamColor: normalizeHex(saved.beamColor || saved.appearance?.beamColor, DEFAULT_SETTINGS.beamColor),
      emailAlerts: typeof saved.emailAlerts === "boolean" ? saved.emailAlerts : true,
      pushAlerts: typeof saved.pushAlerts === "boolean" ? saved.pushAlerts : true,
      leadDigest: typeof saved.leadDigest === "boolean" ? saved.leadDigest : true,
      jobUpdates: typeof saved.jobUpdates === "boolean" ? saved.jobUpdates : true,
      defaultView: saved.defaultView || "overview",
      timezone: saved.timezone || "America/New_York",
      workspaceNote: saved.workspaceNote || ""
    };
  } else {
    data = {
      ...DEFAULT_SETTINGS,
      fullName: user.displayName || "",
      email: user.email || ""
    };
  }

  originalSettings = { ...data };
  populateForm(originalSettings);
}

async function saveSettings() {
  if (!currentUser) return;

  const data = readForm();

  if (!data.fullName) {
    setMessage("Please enter your full name.", true);
    return;
  }

  try {
    if (currentUser.displayName !== data.fullName) {
      await updateProfile(currentUser, {
        displayName: data.fullName
      });
    }

    await setDoc(doc(db, "users", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email || data.email,
      displayName: data.fullName,
      fullName: data.fullName,
      role: currentRole,
      themeMode: data.themeMode,
      themeFamily: data.themeFamily,
      beamMode: data.beamMode,
      navColor: data.navColor,
      cardColor: data.cardColor,
      buttonColor: data.buttonColor,
      backgroundColor: data.backgroundColor,
      beamColor: data.beamColor,
      appearance: {
        mode: data.themeMode,
        family: data.themeFamily,
        beamMode: data.beamMode,
        navColor: data.navColor,
        cardColor: data.cardColor,
        buttonColor: data.buttonColor,
        backgroundColor: data.backgroundColor,
        beamColor: data.beamColor
      },
      emailAlerts: data.emailAlerts,
      pushAlerts: data.pushAlerts,
      leadDigest: data.leadDigest,
      jobUpdates: data.jobUpdates,
      defaultView: data.defaultView,
      timezone: data.timezone,
      workspaceNote: data.workspaceNote,
      updatedAt: serverTimestamp()
    }, { merge: true });

    applyAppearance(data);

    applyUserToUi({
      displayName: data.fullName,
      email: currentUser.email || data.email,
      role: currentRole
    });

    originalSettings = { ...data };
    renderSummary(data);
    setMessage("Settings saved successfully.");
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Unable to save settings.", true);
  }
}

function resetSettings() {
  if (!originalSettings) return;
  populateForm(originalSettings);
  setMessage("Changes reset.");
}

function syncColorInputPair(colorInput, hexInput, fallback) {
  colorInput.addEventListener("input", () => {
    const safe = normalizeHex(colorInput.value, fallback);
    hexInput.value = safe;
    const data = readForm();
    applyAppearance(data);
    renderSummary(data);
  });

  hexInput.addEventListener("input", () => {
    const safe = normalizeHex(hexInput.value, fallback);
    colorInput.value = safe;
    hexInput.value = safe;
    const data = readForm();
    applyAppearance(data);
    renderSummary(data);
  });
}

function bindPills() {
  modePills.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-mode-pill");
      themeModeInput.value = value;
      const data = readForm();
      applyAppearance(data);
      renderSummary(data);
    });
  });

  familyPills.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-family-pill");
      themeFamilyInput.value = value;
      const data = readForm();
      applyAppearance(data);
      renderSummary(data);
    });
  });

  beamPills.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-beam-pill");
      beamModeInput.value = value;
      const data = readForm();
      applyAppearance(data);
      renderSummary(data);
    });
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyPreset(button.getAttribute("data-theme-preset"));
    });
  });
}

function bindLivePreview() {
  [
    themeModeInput,
    themeFamilyInput,
    beamModeInput,
    emailAlertsInput,
    pushAlertsInput,
    leadDigestInput,
    jobUpdatesInput,
    defaultViewInput,
    timezoneInput,
    workspaceNoteInput
  ].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      const data = readForm();
      applyAppearance(data);
      renderSummary(data);
    });
    input.addEventListener("change", () => {
      const data = readForm();
      applyAppearance(data);
      renderSummary(data);
    });
  });

  syncColorInputPair(navColorInput, navHexInput, DEFAULT_SETTINGS.navColor);
  syncColorInputPair(cardColorInput, cardHexInput, DEFAULT_SETTINGS.cardColor);
  syncColorInputPair(buttonColorInput, buttonHexInput, DEFAULT_SETTINGS.buttonColor);
  syncColorInputPair(backgroundColorInput, backgroundHexInput, DEFAULT_SETTINGS.backgroundColor);
  syncColorInputPair(beamColorInput, beamHexInput, DEFAULT_SETTINGS.beamColor);
}

function bindEvents() {
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveSettings();
    });
  }

  if (saveTopBtn) saveTopBtn.addEventListener("click", saveSettings);
  if (resetBtn) resetBtn.addEventListener("click", resetSettings);
  if (resetBtnTop) resetBtnTop.addEventListener("click", resetSettings);

  bindPills();
  bindLivePreview();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/evaraos/login.html";
    return;
  }

  try {
    await loadSettings(user);
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Unable to load settings.", true);
  }
});

document.addEventListener("DOMContentLoaded", bindEvents);