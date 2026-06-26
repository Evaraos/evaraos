import { setMessage, markSettingsReady } from "./settings-shared.js";

const STORAGE_KEY = "evaraos-workspace-settings";
const DEFAULTS = { defaultView: "dashboard", timezone: "America/New_York", note: "" };
let timer = 0;
function byId(id) { return document.getElementById(id); }
function readSettings() { try { const raw = localStorage.getItem(STORAGE_KEY); return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) }; } catch { return { ...DEFAULTS }; } }
function current() { return { defaultView: byId("workspaceDefaultView")?.value || DEFAULTS.defaultView, timezone: byId("workspaceTimezone")?.value || DEFAULTS.timezone, note: byId("workspaceNote")?.value || "" }; }
function apply(settings) { const safe = { ...DEFAULTS, ...(settings || {}) }; if (byId("workspaceDefaultView")) byId("workspaceDefaultView").value = safe.defaultView; if (byId("workspaceTimezone")) byId("workspaceTimezone").value = safe.timezone; if (byId("workspaceNote")) byId("workspaceNote").value = safe.note || ""; }
function persist() {
  const value = { ...DEFAULTS, ...current(), updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("evara:workspace-settings-updated", { detail: value }));
  setMessage("workspaceSaveMessage", "Saved automatically.");
}
function schedule() { clearTimeout(timer); setMessage("workspaceSaveMessage", "Saving..."); timer = window.setTimeout(persist, 450); }
function bind() {
  byId("saveWorkspaceBtn")?.addEventListener("click", persist);
  ["workspaceDefaultView", "workspaceTimezone", "workspaceNote"].forEach((id) => {
    byId(id)?.addEventListener("input", schedule);
    byId(id)?.addEventListener("change", schedule);
  });
}
function init() { apply(readSettings()); bind(); setMessage("workspaceSaveMessage", "Preferences loaded. Changes save automatically."); markSettingsReady(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
