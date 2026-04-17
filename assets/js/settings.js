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

const emailAlertsInput = document.getElementById("settingsEmailAlerts");
const pushAlertsInput = document.getElementById("settingsPushAlerts");
const leadDigestInput = document.getElementById("settingsLeadDigest");
const jobUpdatesInput = document.getElementById("settingsJobUpdates");

const defaultViewInput = document.getElementById("settingsDefaultView");
const timezoneInput = document.getElementById("settingsTimezone");
const workspaceNoteInput = document.getElementById("settingsWorkspaceNote");

const resetBtn = document.getElementById("settingsResetBtn");
const resetBtnTop = document.getElementById("settingsResetBtnTop");
const saveTopBtn = document.getElementById("saveSettingsTopBtn");

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
  navColor: "#ff3b30",
  cardColor: "#8b5cf6",
  buttonColor: "#2563eb",
  backgroundColor: "#0f172a",
  beamColor: "#7c3aed",
  emailAlerts: true,
  pushAlerts: true,
  leadDigest: true,
  jobUpdates: true,
  defaultView: "overview",
  timezone: "America/New_York",
  workspaceNote: ""
};

function setMessage(text = "", isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#ff9b8f" : "#8ef0c1";
}

function capitalize(value = "") {
  const safe = String(value || "").trim();
  return safe ? safe.charAt(0).toUpperCase() + safe.slice(1) : "";
}

function normalizeHex(value, fallback) {
  const safe = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(safe) ? safe : fallback;
}

function normalizeBeamMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["off", "on", "rainbow", "custom"].includes(safe) ? safe : "on";
}

function buildThemeLabel(data) {
  return `${capitalize(data.themeFamily || "neutral")} ${data.themeMode === "light" ? "Light" : "Dark"}`;
}

function countEnabledAlerts(data) {
  const values = [
    Boolean(data.emailAlerts),
    Boolean(data.pushAlerts),
    Boolean(data.leadDigest),
    Boolean(data.jobUpdates)
  ];
  return values.filter(Boolean).length;
}

function getFormData() {
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

  if (emailAlertsInput) emailAlertsInput.checked = Boolean(data.emailAlerts);
  if (pushAlertsInput) pushAlertsInput.checked = Boolean(data.pushAlerts);
  if (leadDigestInput) leadDigestInput.checked = Boolean(data.leadDigest);
  if (jobUpdatesInput) jobUpdatesInput.checked = Boolean(data.jobUpdates);

  if (defaultViewInput) defaultViewInput.value = data.defaultView || "overview";
  if (timezoneInput) timezoneInput.value = data.timezone || "America/New_York";
  if (workspaceNoteInput) workspaceNoteInput.value = data.workspaceNote || "";

  applyAppearance(data);
  renderUiSummary(data);
  syncPresetButtons(data);
}

function syncPresetButtons(data) {
  const checks = {
    clean:
      data.navColor === "#ff3b30" &&
      data.cardColor === "#8b5cf6" &&
      data.buttonColor === "#2563eb" &&
      data.backgroundColor === "#0f172a" &&
      data.beamColor === "#7c3aed",
    lava:
      data.navColor === "#ff5a36" &&
      data.cardColor === "#ef4444" &&
      data.buttonColor === "#f97316" &&
      data.backgroundColor === "#1a0d0a" &&
      data.beamColor === "#fb7185",
    ocean:
      data.navColor === "#0ea5e9" &&
      data.cardColor === "#2563eb" &&
      data.buttonColor === "#06b6d4" &&
      data.backgroundColor === "#071520" &&
      data.beamColor === "#22d3ee",
    aurora:
      data.navColor === "#a855f7" &&
      data.cardColor === "#8b5cf6" &&
      data.buttonColor === "#ec4899" &&
      data.backgroundColor === "#0f1020" &&
      data.beamColor === "#22c55e"
  };

  presetButtons.forEach((button) => {
    const preset = button.getAttribute("data-theme-preset");
    button.classList.toggle("active", Boolean(checks[preset]));
  });
}

function renderUiSummary(data) {
  const themeLabel = buildThemeLabel(data);
  const workspaceLabel = capitalize(data.defaultView || "overview");
  const alertCount = countEnabledAlerts(data);

  if (heroTitle) heroTitle.textContent = "Settings loaded";
  if (heroText) {
    heroText.textContent = `${themeLabel} • Beam ${capitalize(data.beamMode)} • ${alertCount} alerts enabled`;
  }

  if (themeStat) themeStat.textContent = data.themeMode === "light" ? "Light" : "Dark";
  if (themeMeta) themeMeta.textContent = `${capitalize(data.themeFamily || "neutral")} family`;

  if (beamStat) beamStat.textContent = capitalize(data.beamMode || "on");
  if (beamMeta) beamMeta.textContent = data.beamMode === "rainbow" ? "Rainbow animated beam" : `Beam color ${data.beamColor}`;

  if (alertsStat) alertsStat.textContent = `${alertCount}/4`;
  if (alertsMeta) alertsMeta.textContent = `${alertCount} notifications currently enabled`;

  if (workspaceStat) workspaceStat.textContent = workspaceLabel;
  if (workspaceMeta) workspaceMeta.textContent = data.timezone || "America/New_York";

  if (beamPreviewLabel) {
    beamPreviewLabel.textContent = `${capitalize(data.beamMode)} beam preview`;
  }

  if (summaryFeed) {
    summaryFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Theme Mode</strong>
        <span>${themeLabel}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Beam Engine</strong>
        <span>${capitalize(data.beamMode)} • ${data.beamColor}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Navigation Color</strong>
        <span>${data.navColor}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Card Color</strong>
        <span>${data.cardColor}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Button Color</strong>
        <span>${data.buttonColor}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Background Color</strong>
        <span>${data.backgroundColor}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Alerts</strong>
        <span>${countEnabledAlerts(data)} enabled</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Workspace</strong>
        <span>${workspaceLabel} • ${data.timezone || "America/New_York"}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Workspace Note</strong>
        <span>${data.workspaceNote || "No workspace note added."}</span>
      </article>
    `;
  }
}

function getPresetAppearance(name) {
  const presets = {
    clean: {
      navColor: "#ff3b30",
      cardColor: "#8b5cf6",
      buttonColor: "#2563eb",
      backgroundColor: "#0f172a",
      beamColor: "#7c3aed"
    },
    lava: {
      navColor: "#ff5a36",
      cardColor: "#ef4444",
      buttonColor: "#f97316",
      backgroundColor: "#1a0d0a",
      beamColor: "#fb7185"
    },
    ocean: {
      navColor: "#0ea5e9",
      cardColor: "#2563eb",
      buttonColor: "#06b6d4",
      backgroundColor: "#071520",
      beamColor: "#22d3ee"
    },
    aurora: {
      navColor: "#a855f7",
      cardColor: "#8b5cf6",
      buttonColor: "#ec4899",
      backgroundColor: "#0f1020",
      beamColor: "#22c55e"
    }
  };

  return presets[name] || presets.clean;
}

function applyPreset(name) {
  const preset = getPresetAppearance(name);
  if (navColorInput) navColorInput.value = preset.navColor;
  if (cardColorInput) cardColorInput.value = preset.cardColor;
  if (buttonColorInput) buttonColorInput.value = preset.buttonColor;
  if (backgroundColorInput) backgroundColorInput.value = preset.backgroundColor;
  if (beamColorInput) beamColorInput.value = preset.beamColor;

  const next = getFormData();
  applyAppearance(next);
  renderUiSummary(next);
  syncPresetButtons(next);
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
      navColor: saved.navColor || saved.appearance?.navColor || DEFAULT_SETTINGS.navColor,
      cardColor: saved.cardColor || saved.appearance?.cardColor || DEFAULT_SETTINGS.cardColor,
      buttonColor: saved.buttonColor || saved.appearance?.buttonColor || DEFAULT_SETTINGS.buttonColor,
      backgroundColor: saved.backgroundColor || saved.appearance?.backgroundColor || DEFAULT_SETTINGS.backgroundColor,
      beamColor: saved.beamColor || saved.appearance?.beamColor || DEFAULT_SETTINGS.beamColor,
      emailAlerts: typeof saved.emailAlerts === "boolean" ? saved.emailAlerts : true,
      pushAlerts: typeof saved.pushAlerts === "boolean" ? saved.pushAlerts : true,
      leadDigest: typeof saved.leadDigest === "boolean" ? saved.leadDigest : true,
      jobUpdates: typeof saved.jobUpdates === "boolean" ? saved.jobUpdates : true,
      defaultView: saved.defaultView || "overview",
      timezone: saved.timezone || "America/New_York",
      workspaceNote: saved.workspaceNote || ""
    };
  } else {
    currentRole = "customer";

    data = {
      ...DEFAULT_SETTINGS,
      fullName: user.displayName || "",
      email: user.email || ""
    };

    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      fullName: user.displayName || "",
      role: currentRole,
      ...data,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  originalSettings = { ...data };
  populateForm(originalSettings);
}

async function saveSettings() {
  if (!currentUser) return;

  const payload = getFormData();

  if (!payload.fullName) {
    setMessage("Please enter your full name.", true);
    return;
  }

  try {
    const userRef = doc(db, "users", currentUser.uid);

    if (currentUser.displayName !== payload.fullName) {
      await updateProfile(currentUser, {
        displayName: payload.fullName
      });
    }

    await setDoc(userRef, {
      uid: currentUser.uid,
      email: currentUser.email || payload.email || "",
      displayName: payload.fullName,
      fullName: payload.fullName,
      role: currentRole,
      themeMode: payload.themeMode,
      themeFamily: payload.themeFamily,
      beamMode: payload.beamMode,
      navColor: payload.navColor,
      cardColor: payload.cardColor,
      buttonColor: payload.buttonColor,
      backgroundColor: payload.backgroundColor,
      beamColor: payload.beamColor,
      appearance: {
        mode: payload.themeMode,
        family: payload.themeFamily,
        beamMode: payload.beamMode,
        navColor: payload.navColor,
        cardColor: payload.cardColor,
        buttonColor: payload.buttonColor,
        backgroundColor: payload.backgroundColor,
        beamColor: payload.beamColor
      },
      emailAlerts: payload.emailAlerts,
      pushAlerts: payload.pushAlerts,
      leadDigest: payload.leadDigest,
      jobUpdates: payload.jobUpdates,
      defaultView: payload.defaultView,
      timezone: payload.timezone,
      workspaceNote: payload.workspaceNote,
      updatedAt: serverTimestamp()
    }, { merge: true });

    applyAppearance(payload);

    applyUserToUi({
      displayName: payload.fullName,
      email: currentUser.email || payload.email || "",
      role: currentRole
    });

    originalSettings = { ...payload };
    renderUiSummary(originalSettings);
    syncPresetButtons(originalSettings);
    setMessage("Settings saved successfully.");
  } catch (error) {
    console.error("Settings save failed:", error);
    setMessage(error.message || "Unable to save settings.", true);
  }
}

function resetSettings() {
  if (!originalSettings) return;
  populateForm(originalSettings);
  setMessage("Changes reset.");
}

async function handleSubmit(event) {
  event.preventDefault();
  await saveSettings();
}

function bindLivePreview() {
  [
    themeModeInput,
    themeFamilyInput,
    beamModeInput,
    navColorInput,
    cardColorInput,
    buttonColorInput,
    backgroundColorInput,
    beamColorInput,
    emailAlertsInput,
    pushAlertsInput,
    leadDigestInput,
    jobUpdatesInput,
    defaultViewInput,
    timezoneInput,
    workspaceNoteInput
  ]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener("input", () => {
        const data = getFormData();
        applyAppearance(data);
        renderUiSummary(data);
        syncPresetButtons(data);
      });

      input.addEventListener("change", () => {
        const data = getFormData();
        applyAppearance(data);
        renderUiSummary(data);
        syncPresetButtons(data);
      });
    });
}

function bindPresetButtons() {
  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyPreset(button.getAttribute("data-theme-preset"));
    });
  });
}

function bindEvents() {
  if (form) form.addEventListener("submit", handleSubmit);
  if (resetBtn) resetBtn.addEventListener("click", resetSettings);
  if (resetBtnTop) resetBtnTop.addEventListener("click", resetSettings);
  if (saveTopBtn) saveTopBtn.addEventListener("click", saveSettings);

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });

  bindLivePreview();
  bindPresetButtons();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/evaraos/login.html";
    return;
  }

  try {
    await loadSettings(user);
  } catch (error) {
    console.error("Settings load failed:", error);
    setMessage(error.message || "Unable to load settings.", true);
  }
});

document.addEventListener("DOMContentLoaded", bindEvents);