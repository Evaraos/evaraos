const APPEARANCE_KEY = "evaraos-appearance";

const DEFAULT_APPEARANCE = {
  mode: "light",
  baseFamily: "light",
  accent: "red",
  updatedAt: null
};

function normalizeAppearance(value = {}) {
  const mode = value.mode === "dark" ? "dark" : "light";
  return {
    ...DEFAULT_APPEARANCE,
    ...value,
    mode,
    baseFamily: mode,
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

export function getTheme() {
  return getAppearance().mode === "dark" ? "dark" : "light";
}

export function applyTheme(theme = getTheme()) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", safeTheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", safeTheme === "dark" ? "#060814" : "#f4f7f6");
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme: safeTheme } }));
  return safeTheme;
}

export function saveAppearance(nextAppearance = {}) {
  const appearance = normalizeAppearance({ ...getAppearance(), ...nextAppearance });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  applyTheme(appearance.mode);
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: appearance }));
  return appearance;
}

export function toggleTheme() {
  const current = getTheme();
  return saveAppearance({ mode: current === "dark" ? "light" : "dark" });
}

applyTheme();
