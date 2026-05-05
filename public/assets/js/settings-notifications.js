import {
  setMessage,
  markSettingsReady
} from "./settings-shared.js";

const STORAGE_KEY = "evaraos-notification-settings";

const DEFAULTS = {
  system: true,
  leads: true,
  jobs: true,
  digests: false
};

function byId(id) {
  return document.getElementById(id);
}

function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      ...DEFAULTS,
      ...(raw ? JSON.parse(raw) : {})
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...DEFAULTS,
    ...(settings || {})
  }));
}

function getCurrentFormSettings() {
  return {
    system: !!byId("notifySystem")?.checked,
    leads: !!byId("notifyLeads")?.checked,
    jobs: !!byId("notifyJobs")?.checked,
    digests: !!byId("notifyDigests")?.checked
  };
}

function applySettings(settings) {
  const safe = {
    ...DEFAULTS,
    ...(settings || {})
  };

  const system = byId("notifySystem");
  const leads = byId("notifyLeads");
  const jobs = byId("notifyJobs");
  const digests = byId("notifyDigests");

  if (system) system.checked = !!safe.system;
  if (leads) leads.checked = !!safe.leads;
  if (jobs) jobs.checked = !!safe.jobs;
  if (digests) digests.checked = !!safe.digests;
}

function bindNotifications() {
  const saveBtn = byId("saveNotificationsBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveSettings(getCurrentFormSettings());
      setMessage("notificationsSaveMessage", "Notification preferences saved.");
    });
  }

  ["notifySystem", "notifyLeads", "notifyJobs", "notifyDigests"].forEach((id) => {
    const el = byId(id);
    if (!el) return;

    el.addEventListener("change", () => {
      setMessage("notificationsSaveMessage", "Unsaved notification changes.");
    });
  });
}

function init() {
  applySettings(readSettings());
  bindNotifications();
  setMessage("notificationsSaveMessage", "Notification preferences loaded.");
  markSettingsReady();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
