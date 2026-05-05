import {
  setMessage,
  markSettingsReady
} from "./settings-shared.js";

const STORAGE_KEY = "evaraos-workspace-settings";

const DEFAULTS = {
  defaultView: "dashboard",
  timezone: "America/New_York",
  note: ""
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

function applySettings(settings) {
  const safe = {
    ...DEFAULTS,
    ...(settings || {})
  };

  const defaultView = byId("workspaceDefaultView");
  const timezone = byId("workspaceTimezone");
  const note = byId("workspaceNote");

  if (defaultView) defaultView.value = safe.defaultView;
  if (timezone) timezone.value = safe.timezone;
  if (note) note.value = safe.note || "";
}

function getCurrentFormSettings() {
  return {
    defaultView: byId("workspaceDefaultView")?.value || DEFAULTS.defaultView,
    timezone: byId("workspaceTimezone")?.value || DEFAULTS.timezone,
    note: byId("workspaceNote")?.value || ""
  };
}

function bindWorkspace() {
  const saveBtn = byId("saveWorkspaceBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveSettings(getCurrentFormSettings());
      setMessage("workspaceSaveMessage", "Workspace preferences saved.");
    });
  }

  ["workspaceDefaultView", "workspaceTimezone", "workspaceNote"].forEach((id) => {
    const el = byId(id);
    if (!el) return;

    el.addEventListener("input", () => {
      setMessage("workspaceSaveMessage", "Unsaved workspace changes.");
    });

    el.addEventListener("change", () => {
      setMessage("workspaceSaveMessage", "Unsaved workspace changes.");
    });
  });
}

function init() {
  applySettings(readSettings());
  bindWorkspace();
  setMessage("workspaceSaveMessage", "Workspace preferences loaded.");
  markSettingsReady();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
