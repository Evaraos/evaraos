import { setMessage, markSettingsReady } from "./settings-shared.js";

const STORAGE_KEY = "evaraos-notification-settings";
const DEFAULTS = { system: true, leads: true, jobs: true, digests: false };
function byId(id) { return document.getElementById(id); }
function readSettings() { try { const raw = localStorage.getItem(STORAGE_KEY); return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) }; } catch { return { ...DEFAULTS }; } }
function saveSettings(settings) {
  const value = { ...DEFAULTS, ...(settings || {}), updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("evara:notification-settings-updated", { detail: value }));
  return value;
}
function current() { return { system: !!byId("notifySystem")?.checked, leads: !!byId("notifyLeads")?.checked, jobs: !!byId("notifyJobs")?.checked, digests: !!byId("notifyDigests")?.checked }; }
function apply(settings) {
  const safe = { ...DEFAULTS, ...(settings || {}) };
  [["notifySystem","system"],["notifyLeads","leads"],["notifyJobs","jobs"],["notifyDigests","digests"]].forEach(([id,key]) => { const el = byId(id); if (el) el.checked = !!safe[key]; });
}
function persist() {
  saveSettings(current());
  setMessage("notificationsSaveMessage", "Saved automatically.");
}
function bind() {
  byId("saveNotificationsBtn")?.addEventListener("click", persist);
  ["notifySystem", "notifyLeads", "notifyJobs", "notifyDigests"].forEach((id) => byId(id)?.addEventListener("change", persist));
}
function init() { apply(readSettings()); bind(); setMessage("notificationsSaveMessage", "Preferences loaded. Changes save automatically."); markSettingsReady(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
