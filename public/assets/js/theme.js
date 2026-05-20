const APPEARANCE_KEY = "evaraos-appearance";
const THEME_KEY = "evaraos-theme";

const DEFAULT_APPEARANCE = {
  mode: "system",
  baseFamily: "system",
  accent: "red",
  updatedAt: null
};

function systemTheme() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function normalizeMode(mode = "system") {
  return ["system", "light", "dark", "custom"].includes(mode) ? mode : "system";
}

function normalizeBaseFamily(baseFamily = "system") {
  return ["system", "light", "dark"].includes(baseFamily) ? baseFamily : "system";
}

function normalizeAppearance(value = {}) {
  const raw = {
    ...DEFAULT_APPEARANCE,
    ...(value || {})
  };

  const mode = normalizeMode(raw.mode);
  const baseFamily = mode === "custom" ? normalizeBaseFamily(raw.baseFamily) : mode;

  return {
    ...raw,
    mode,
    baseFamily,
    updatedAt: raw.updatedAt || new Date().toISOString()
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

export function getThemeFromAppearance(appearance = getAppearance()) {
  const safe = normalizeAppearance(appearance);

  if (safe.mode === "light") return "light";
  if (safe.mode === "dark") return "dark";
  if (safe.mode === "system") return systemTheme();

  if (safe.mode === "custom") {
    if (safe.baseFamily === "light") return "light";
    if (safe.baseFamily === "dark") return "dark";
    return systemTheme();
  }

  return systemTheme();
}

export function getTheme() {
  return getThemeFromAppearance(getAppearance());
}

export function applyTheme(theme = getTheme(), mode = getAppearance().mode) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  const safeMode = normalizeMode(mode);

  document.documentElement.setAttribute("data-theme", safeTheme);
  document.documentElement.setAttribute("data-appearance-mode", safeMode);
  document.documentElement.style.colorScheme = safeTheme;
  document.documentElement.classList.toggle("dark", safeTheme === "dark");

  if (document.body) {
    document.body.setAttribute("data-theme", safeTheme);
    document.body.setAttribute("data-appearance-mode", safeMode);
    document.body.classList.toggle("dark", safeTheme === "dark");
  }

  try {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", safeTheme === "dark" ? "#000000" : "#f7f8fa");
  } catch {}

  try {
    localStorage.setItem(THEME_KEY, safeTheme);
  } catch {}

  window.EvaraLoader?.syncTheme?.(safeTheme);
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme: safeTheme, mode: safeMode } }));
  return safeTheme;
}

export function saveAppearance(nextAppearance = {}) {
  const appearance = normalizeAppearance({
    ...getAppearance(),
    ...nextAppearance,
    updatedAt: new Date().toISOString()
  });
  const theme = getThemeFromAppearance(appearance);

  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    localStorage.setItem(THEME_KEY, theme);
  } catch {}

  applyTheme(theme, appearance.mode);
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { ...appearance, theme, resolvedTheme: theme } }));
  return appearance;
}

export function toggleTheme() {
  const mode = getAppearance().mode;
  const nextMode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
  return saveAppearance({ mode: nextMode, baseFamily: nextMode });
}

applyTheme();

try {
  const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", () => {
    const appearance = getAppearance();
    if (appearance.mode === "system" || appearance.baseFamily === "system") {
      applyTheme(getThemeFromAppearance(appearance), appearance.mode);
      window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { ...appearance, theme: getThemeFromAppearance(appearance), resolvedTheme: getThemeFromAppearance(appearance) } }));
    }
  });
} catch {}

window.addEventListener("DOMContentLoaded", () => applyTheme());
