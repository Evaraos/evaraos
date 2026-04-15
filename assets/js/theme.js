const STORAGE_KEY = "evaraos-theme";

const DEFAULT_THEME = "dark";
const VALID_THEMES = [
  "dark",
  "light",
  "blue-dark",
  "blue-light",
  "red-dark",
  "red-light",
  "pink-dark",
  "pink-light",
  "green-dark",
  "green-light",
  "purple-dark",
  "purple-light",
  "yellow-dark",
  "yellow-light"
];

function normalizeTheme(theme = "") {
  const value = String(theme || "").trim().toLowerCase();
  return VALID_THEMES.includes(value) ? value : DEFAULT_THEME;
}

function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);
  } catch {
    return DEFAULT_THEME;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeTheme(theme));
  } catch {
    // ignore
  }
}

function getThemeParts(theme = DEFAULT_THEME) {
  const safe = normalizeTheme(theme);

  if (safe === "dark") return { mode: "dark", family: "neutral" };
  if (safe === "light") return { mode: "light", family: "neutral" };

  const [family, mode] = safe.split("-");
  return {
    family: family || "neutral",
    mode: mode === "light" ? "light" : "dark"
  };
}

function buildTheme(family = "neutral", mode = "dark") {
  const safeMode = mode === "light" ? "light" : "dark";
  if (family === "neutral") return safeMode === "light" ? "light" : "dark";
  const candidate = `${family}-${safeMode}`;
  return VALID_THEMES.includes(candidate) ? candidate : DEFAULT_THEME;
}

function applyTheme(theme) {
  const safe = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safe);
  setStoredTheme(safe);
  syncThemeUi();
}

function toggleMode() {
  const current = getThemeParts(getStoredTheme());
  const nextMode = current.mode === "dark" ? "light" : "dark";
  applyTheme(buildTheme(current.family, nextMode));
}

function setFamily(family) {
  const current = getThemeParts(getStoredTheme());
  applyTheme(buildTheme(family, current.mode));
}

function pulse(el) {
  if (!el) return;
  el.classList.remove("active-glow");
  void el.offsetWidth;
  el.classList.add("active-glow");
  setTimeout(() => el.classList.remove("active-glow"), 220);
}

function syncThemeUi() {
  const currentTheme = getStoredTheme();
  const current = getThemeParts(currentTheme);

  document.querySelectorAll("[data-theme-mode-text]").forEach((el) => {
    el.textContent = current.mode === "dark" ? "Dark" : "Light";
  });

  document.querySelectorAll("[data-theme-group-text]").forEach((el) => {
    const label =
      current.family === "neutral"
        ? "Neutral"
        : current.family.charAt(0).toUpperCase() + current.family.slice(1);
    el.textContent = label;
  });

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const family = bubble.getAttribute("data-theme-family") || "neutral";
    const active = family === current.family;
    bubble.classList.toggle("active", active);
    bubble.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function bindThemeControls() {
  document.querySelectorAll("[data-theme-pill]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", () => {
      toggleMode();
      pulse(button);
    });
  });

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    if (bubble.dataset.bound === "true") return;
    bubble.dataset.bound = "true";

    bubble.addEventListener("click", () => {
      const family = bubble.getAttribute("data-theme-family") || "neutral";
      setFamily(family);
      pulse(bubble);
    });
  });
}

function initTheme() {
  applyTheme(getStoredTheme());
  bindThemeControls();
}

window.EvaraTheme = {
  initTheme,
  bindThemeControls,
  syncThemeUi,
  toggleMode,
  setFamily,
  applyTheme
};

document.addEventListener("DOMContentLoaded", initTheme);