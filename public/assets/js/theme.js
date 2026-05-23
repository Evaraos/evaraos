const APPEARANCE_KEY = "evaraos-appearance";
const VALID_MODES = ["light", "dark", "system"];

const DEFAULT_APPEARANCE = {
  mode: "light",
  updatedAt: null
};

function systemTheme() {
  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    return media.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function normalizeMode(mode) {
  return VALID_MODES.includes(mode) ? mode : "light";
}

function resolvedTheme(mode) {
  const safeMode = normalizeMode(mode);
  return safeMode === "system" ? systemTheme() : safeMode;
}

function normalizeAppearance(value = {}) {
  const mode = normalizeMode(value.mode);
  return {
    mode,
    updatedAt: value.updatedAt || new Date().toISOString()
  };
}

export function getAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function getThemeMode() {
  return getAppearance().mode;
}

export function getTheme() {
  return resolvedTheme(getThemeMode());
}

export function applyTheme(theme = getTheme()) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  const mode = getThemeMode();

  document.documentElement.setAttribute("data-theme", safeTheme);
  document.documentElement.setAttribute("data-theme-mode", mode);
  document.documentElement.style.colorScheme = safeTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", safeTheme === "dark" ? "#060814" : "#f4f7f6");
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme: safeTheme, mode } }));
  return safeTheme;
}

export function saveAppearance(nextAppearance = {}) {
  const appearance = normalizeAppearance({ ...getAppearance(), ...nextAppearance });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  const theme = applyTheme(resolvedTheme(appearance.mode));
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { ...appearance, theme } }));
  return appearance;
}

export function setThemeMode(mode = "light") {
  return saveAppearance({ mode: normalizeMode(mode), updatedAt: new Date().toISOString() });
}

export function toggleTheme() {
  const current = getThemeMode();
  const next = current === "light" ? "dark" : current === "dark" ? "system" : "light";
  return setThemeMode(next);
}

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeMode() === "system") applyTheme(systemTheme());
  });
} catch {}

applyTheme();
