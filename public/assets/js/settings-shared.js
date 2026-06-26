import {
  APPEARANCE_KEY,
  VALID_MODES,
  DEFAULT_APPEARANCE,
  getAppearance,
  saveAppearance,
  resetAppearance,
  applyAppearance,
  normalizeAppearance,
  resolvedTheme,
  systemTheme
} from "./theme.js";

export const APPEARANCE_STORAGE_KEY = APPEARANCE_KEY;
export { VALID_MODES, DEFAULT_APPEARANCE, getAppearance, saveAppearance, resetAppearance, applyAppearance, systemTheme };

export function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeMode(mode) {
  return VALID_MODES.includes(mode) ? mode : "light";
}

export function getThemeFromAppearance(appearance) {
  return resolvedTheme(normalizeAppearance(appearance).mode);
}

export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function setMessage(id, value) {
  setText(id, value);
}

export function markSettingsReady() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending");

  if (window.EvaraLoader && typeof window.EvaraLoader.markAppReady === "function") {
    window.EvaraLoader.markAppReady();
  } else {
    document.body?.classList.remove("app-loading");
    document.body?.classList.add("app-ready");
  }
}
