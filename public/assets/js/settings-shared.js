export const APPEARANCE_STORAGE_KEY = "evaraos-appearance";
export const VALID_MODES = Object.freeze(["light", "dark", "system", "image"]);
export const DEFAULT_APPEARANCE = Object.freeze({
  mode: "light",
  imageUrl: "",
  imagePosition: "center center",
  imageOverlay: 0.36,
  updatedAt: null
});

function engine() {
  return window.EvaraTheme || null;
}

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

export function systemTheme() {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function getAppearance() {
  return engine()?.getAppearance?.() || { ...DEFAULT_APPEARANCE };
}

export function saveAppearance(value) {
  return engine()?.saveAppearance?.(value) || { ...DEFAULT_APPEARANCE };
}

export function resetAppearance() {
  return engine()?.resetAppearance?.() || { ...DEFAULT_APPEARANCE };
}

export function applyAppearance(value) {
  return engine()?.applyAppearance?.(value) || value;
}

export function getThemeFromAppearance(appearance) {
  const mode = normalizeMode(appearance?.mode);
  if (mode === "system") return systemTheme();
  if (mode === "image") return "dark";
  return mode;
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
