export const APPEARANCE_STORAGE_KEY = "evaraos-appearance";

export const DEFAULT_APPEARANCE = {
  mode: "system",
  baseFamily: "system",
  cardTint: "#ffffff",
  buttonTint: "#ffffff",
  beamColor: "#7c3aed",
  backgroundGlow: "#7c3aed",
  rainbowBeam: false
};

export function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function systemTheme() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function normalizeAppearanceMode(mode = "system") {
  const value = String(mode || "system").trim().toLowerCase();
  if (["light", "dark", "system", "custom", "galaxy"].includes(value)) return value;
  return "system";
}

export function getAppearance() {
  const stored = safeJsonParse(localStorage.getItem(APPEARANCE_STORAGE_KEY), null);
  const merged = {
    ...DEFAULT_APPEARANCE,
    ...(stored || {})
  };

  merged.mode = normalizeAppearanceMode(merged.mode);
  if (!merged.baseFamily) merged.baseFamily = merged.mode;
  return merged;
}

export function saveAppearance(nextAppearance) {
  const merged = {
    ...DEFAULT_APPEARANCE,
    ...(nextAppearance || {})
  };

  merged.mode = normalizeAppearanceMode(merged.mode);
  if (merged.mode !== "custom") merged.baseFamily = merged.mode;
  if (merged.mode === "custom" && !merged.baseFamily) merged.baseFamily = systemTheme();
  merged.updatedAt = new Date().toISOString();

  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(merged));
  localStorage.setItem("evaraos-theme", getThemeFromAppearance(merged));
  applyAppearance(merged);
  return merged;
}

export function resetAppearance() {
  const reset = {
    ...DEFAULT_APPEARANCE,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(reset));
  localStorage.setItem("evaraos-theme", getThemeFromAppearance(reset));
  applyAppearance(reset);
  return { ...reset };
}

export function getThemeFromAppearance(appearance) {
  const safe = {
    ...DEFAULT_APPEARANCE,
    ...(appearance || {})
  };

  const mode = normalizeAppearanceMode(safe.mode);

  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (mode === "system") return systemTheme();
  if (mode === "galaxy") return "dark";

  if (mode === "custom") {
    if (safe.baseFamily === "light") return "light";
    if (safe.baseFamily === "system") return systemTheme();
    return "dark";
  }

  return systemTheme();
}

export function applyAppearance(appearance) {
  const safe = {
    ...DEFAULT_APPEARANCE,
    ...(appearance || {})
  };

  safe.mode = normalizeAppearanceMode(safe.mode);
  const theme = getThemeFromAppearance(safe);
  const root = document.documentElement;

  root.setAttribute("data-theme", theme);
  root.setAttribute("data-appearance-mode", safe.mode);
  root.style.colorScheme = theme;
  root.classList.toggle("dark", theme === "dark");

  if (document.body) {
    document.body.setAttribute("data-theme", theme);
    document.body.setAttribute("data-appearance-mode", safe.mode);
    document.body.classList.toggle("dark", theme === "dark");
  }

  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#020307" : "#f4f7f6");
  } catch {}

  root.style.setProperty("--user-card-tint", safe.cardTint);
  root.style.setProperty("--user-button-tint", safe.buttonTint);
  root.style.setProperty("--user-beam-color", safe.beamColor);
  root.style.setProperty("--user-background-glow", safe.backgroundGlow);

  if (safe.rainbowBeam && theme !== "dark") {
    root.setAttribute("data-beam-mode", "rainbow");
  } else {
    root.setAttribute("data-beam-mode", "default");
  }

  window.EvaraLoader?.syncTheme?.(theme);
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", {
    detail: { ...safe, theme, mode: safe.mode, resolvedTheme: theme }
  }));
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme, mode: safe.mode } }));

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

applyAppearance(getAppearance());

try {
  const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (media) {
    media.addEventListener?.("change", () => {
      const appearance = getAppearance();
      if (appearance.mode === "system" || appearance.baseFamily === "system") applyAppearance(appearance);
    });
  }
} catch {}
