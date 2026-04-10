// assets/js/settings.js

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
const emailStat = document.getElementById("settingsEmailStat");
const emailMeta = document.getElementById("settingsEmailMeta");
const pushStat = document.getElementById("settingsPushStat");
const pushMeta = document.getElementById("settingsPushMeta");
const workspaceStat = document.getElementById("settingsWorkspaceStat");
const workspaceMeta = document.getElementById("settingsWorkspaceMeta");

const summaryFeed = document.getElementById("settingsSummaryFeed");

let currentUser = null;
let originalSettings = null;

function setMessage(text = "", isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#ff9b8f" : "#8ef0c1";
}

function capitalize(value = "") {
  const safe = String(value || "").trim();
  return safe ? safe.charAt(0).toUpperCase() + safe.slice(1) : "";
}

function readThemePartsFromDom() {
  const theme = document.documentElement.getAttribute("data-theme") || "dark";

  if (theme === "dark" || theme === "light") {
    return { mode: theme, family: "neutral" };
  }

  const [family, mode] = theme.split("-");
  return {
    family: family || "neutral",
    mode: mode === "light" ? "light" : "dark"
  };
}

function buildThemeValue(mode = "dark", family = "neutral") {
  const safeMode = mode === "light" ? "light" : "dark";
  const safeFamily = String(family || "neutral").trim().toLowerCase();

  return safeFamily === "neutral" ? safeMode : `${safeFamily}-${safeMode}`;
}

function getFormData() {
  return {
    fullName: nameInput?.value.trim() || "",
    email: emailInput?.value.trim() || "",
    themeMode: themeModeInput?.value === "light" ? "light" : "dark",
    themeFamily: themeFamilyInput?.value || "neutral",
    emailAlerts: Boolean(emailAlertsInput?.checked),
    pushAlerts: Boolean(pushAlertsInput?.checked),
    leadDigest: Boolean(leadDigestInput?.checked),
    jobUpdates: Boolean(jobUpdatesInput?.checked),
    defaultView: defaultViewInput?.value || "overview",
    timezone: timezoneInput?.value.trim() || "America/New_York",
    workspaceNote: workspaceNoteInput?.value.trim() || ""
  };
}

function populateForm(data) {
  if (nameInput) nameInput.value = data.fullName || "";
  if (emailInput) emailInput.value = data.email || "";

  if (themeModeInput) themeModeInput.value = data.themeMode || "dark";
  if (themeFamilyInput) themeFamilyInput.value = data.themeFamily || "neutral";

  if (emailAlertsInput) emailAlertsInput.checked = Boolean(data.emailAlerts);
  if (pushAlertsInput) pushAlertsInput.checked = Boolean(data.pushAlerts);
  if (leadDigestInput) leadDigestInput.checked = Boolean(data.leadDigest);
  if (jobUpdatesInput) jobUpdatesInput.checked = Boolean(data.jobUpdates);

  if (defaultViewInput) defaultViewInput.value = data.defaultView || "overview";
  if (timezoneInput) timezoneInput.value = data.timezone || "America/New_York";
  if (workspaceNoteInput) workspaceNoteInput.value = data.workspaceNote || "";

  renderUiSummary(data);
}

function renderUiSummary(data) {
  const themeLabel = `${capitalize(data.themeFamily || "neutral")} ${data.themeMode === "light" ? "Light" : "Dark"}`;
  const workspaceLabel = capitalize(data.defaultView || "overview");

  if (heroTitle) heroTitle.textContent = "Preferences loaded";
  if (heroText) heroText.textContent = `Theme ${themeLabel} • Default view ${workspaceLabel}`;

  if (themeStat) themeStat.textContent = data.themeMode === "light" ? "Light" : "Dark";
  if (themeMeta) themeMeta.textContent = `${capitalize(data.themeFamily || "neutral")} family`;

  if (emailStat) emailStat.textContent = data.emailAlerts ? "On" : "Off";
  if (emailMeta) emailMeta.textContent = data.emailAlerts ? "Email notifications enabled" : "Email notifications disabled";

  if (pushStat) pushStat.textContent = data.pushAlerts ? "On" : "Off";
  if (pushMeta) pushMeta.textContent = data.pushAlerts ? "Push notifications enabled" : "Push notifications disabled";

  if (workspaceStat) workspaceStat.textContent = workspaceLabel;
  if (workspaceMeta) workspaceMeta.textContent = data.timezone || "America/New_York";

  if (summaryFeed) {
    summaryFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Theme</strong>
        <span>${themeLabel}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Email Alerts</strong>
        <span>${data.emailAlerts ? "Enabled" : "Disabled"}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Push Alerts</strong>
        <span>${data.pushAlerts ? "Enabled" : "Disabled"}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Lead Digest</strong>
        <span>${data.leadDigest ? "Enabled" : "Disabled"}</span>
      </article>

      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Job Updates</strong>
        <span>${data.jobUpdates ? "Enabled" : "Disabled"}</span>
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

async function loadSettings(user) {
  currentUser = user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  const domTheme = readThemePartsFromDom();

  let data;
  if (snap.exists()) {
    const saved = snap.data() || {};
    data = {
      fullName: saved.fullName || saved.displayName || user.displayName || "",
      email: saved.email || user.email || "",
      themeMode: saved.themeMode || domTheme.mode,
      themeFamily: saved.themeFamily || domTheme.family,
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
      fullName: user.displayName || "",
      email: user.email || "",
      themeMode: domTheme.mode,
      themeFamily: domTheme.family,
      emailAlerts: true,
      pushAlerts: true,
      leadDigest: true,
      jobUpdates: true,
      defaultView: "overview",
      timezone: "America/New_York",
      workspaceNote: ""
    };

    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      fullName: user.displayName || "",
      ...data,
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
      themeMode: payload.themeMode,
      themeFamily: payload.themeFamily,
      emailAlerts: payload.emailAlerts,
      pushAlerts: payload.pushAlerts,
      leadDigest: payload.leadDigest,
      jobUpdates: payload.jobUpdates,
      defaultView: payload.defaultView,
      timezone: payload.timezone,
      workspaceNote: payload.workspaceNote,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const nextTheme = buildThemeValue(payload.themeMode, payload.themeFamily);
    document.documentElement.setAttribute("data-theme", nextTheme);

    try {
      localStorage.setItem("evaraos-theme", nextTheme);
    } catch {
      // ignore
    }

    if (window.EvaraTheme?.syncThemeUI) {
      window.EvaraTheme.syncThemeUI();
    }

    applyUserToUi({
      displayName: payload.fullName,
      email: currentUser.email || payload.email || "",
      role: "owner"
    });

    originalSettings = { ...payload };
    renderUiSummary(originalSettings);
    setMessage("Settings saved successfully.");
  } catch (error) {
    console.error("Settings save failed:", error);
    setMessage(error.message || "Unable to save settings.", true);
  }
}

function resetSettings() {
  if (!originalSettings) return;

  populateForm(originalSettings);

  const theme = buildThemeValue(originalSettings.themeMode, originalSettings.themeFamily);
  document.documentElement.setAttribute("data-theme", theme);

  try {
    localStorage.setItem("evaraos-theme", theme);
  } catch {
    // ignore
  }

  if (window.EvaraTheme?.syncThemeUI) {
    window.EvaraTheme.syncThemeUI();
  }

  setMessage("Changes reset.");
}

async function handleSubmit(event) {
  event.preventDefault();
  await saveSettings();
}

function bindEvents() {
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetSettings);
  }

  if (resetBtnTop) {
    resetBtnTop.addEventListener("click", resetSettings);
  }

  if (saveTopBtn) {
    saveTopBtn.addEventListener("click", async () => {
      await saveSettings();
    });
  }

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
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
