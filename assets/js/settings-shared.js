export const APPEARANCE_STORAGE_KEY = "evaraos-appearance";

export const DEFAULT_APPEARANCE = {
  mode: "dark",
  baseFamily: "dark",
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

export function getAppearance() {
  const stored = safeJsonParse(localStorage.getItem(APPEARANCE_STORAGE_KEY), null);
  return {
    ...DEFAULT_APPEARANCE,
    ...(stored || {})
  };
}

export function saveAppearance(nextAppearance) {
  const merged = {
    ...DEFAULT_APPEARANCE,
    ...(nextAppearance || {})
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
  const safe = {
    ...DEFAULT_APPEARANCE,
    ...(appearance || {})
  };

  if (safe.mode === "light") return "light";
  if (safe.mode === "galaxy") return "galaxy";

  if (safe.mode === "custom") {
    if (safe.baseFamily === "light") return "light";
    if (safe.baseFamily === "galaxy") return "galaxy";
    return "dark";
  }

  return "dark";
}

export function applyAppearance(appearance) {
  const safe = {
    ...DEFAULT_APPEARANCE,
    ...(appearance || {})
  };

  const theme = getThemeFromAppearance(safe);
  document.documentElement.setAttribute("data-theme", theme);

  document.documentElement.style.setProperty("--user-card-tint", safe.cardTint);
  document.documentElement.style.setProperty("--user-button-tint", safe.buttonTint);
  document.documentElement.style.setProperty("--user-beam-color", safe.beamColor);
  document.documentElement.style.setProperty("--user-background-glow", safe.backgroundGlow);

  if (safe.rainbowBeam && theme !== "galaxy") {
    document.documentElement.setAttribute("data-beam-mode", "rainbow");
  } else {
    document.documentElement.setAttribute("data-beam-mode", "default");
  }

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
