export const APPEARANCE_STORAGE_KEY = "evaraos-appearance";
export const VALID_MODES = ["light", "dark", "system"];

export const DEFAULT_APPEARANCE = {
  mode: "light",
  updatedAt: null
};

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
  const stored = safeJsonParse(localStorage.getItem(APPEARANCE_STORAGE_KEY), null);

  return {
    mode: normalizeMode(stored?.mode),
    updatedAt: stored?.updatedAt || null
  };
}

export function saveAppearance(nextAppearance) {
  const merged = {
    mode: normalizeMode(nextAppearance?.mode),
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(merged));
  applyAppearance(merged);
  return merged;
}

export function resetAppearance() {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(DEFAULT_APPEARANCE));
  applyAppearance(DEFAULT_APPEARANCE);
  return { ...DEFAULT_APPEARANCE };
}

export function getThemeFromAppearance(appearance) {
  const mode = normalizeMode(appearance?.mode);
  return mode === "system" ? systemTheme() : mode;
}

export function applyAppearance(appearance) {
  const safe = {
    mode: normalizeMode(appearance?.mode),
    updatedAt: appearance?.updatedAt || null
  };

  const theme = getThemeFromAppearance(safe);

  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-theme-mode", safe.mode);
  document.documentElement.style.colorScheme = theme;
  document.documentElement.setAttribute("data-beam-mode", "default");

  document.documentElement.style.removeProperty("--user-card-tint");
  document.documentElement.style.removeProperty("--user-button-tint");
  document.documentElement.style.removeProperty("--user-beam-color");
  document.documentElement.style.removeProperty("--user-background-glow");

  return safe;
}

export function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
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

try {
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    if (getAppearance().mode === "system") {
      applyAppearance(getAppearance());
    }
  });
} catch {}

applyAppearance(getAppearance());
