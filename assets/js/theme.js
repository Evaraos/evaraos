// assets/js/theme.js

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
  const safeTheme = normalizeTheme(theme);

  if (safeTheme === "dark") {
    return { mode: "dark", family: "neutral", theme: "dark" };
  }

  if (safeTheme === "light") {
    return { mode: "light", family: "neutral", theme: "light" };
  }

  const [family, mode] = safeTheme.split("-");
  return {
    mode: mode === "light" ? "light" : "dark",
    family: family || "neutral",
    theme: safeTheme
  };
}

function buildTheme(family = "neutral", mode = "dark") {
  const safeMode = mode === "light" ? "light" : "dark";
  const safeFamily = String(family || "neutral").trim().toLowerCase();

  if (safeFamily === "neutral") {
    return safeMode;
  }

  const candidate = `${safeFamily}-${safeMode}`;
  return VALID_THEMES.includes(candidate) ? candidate : DEFAULT_THEME;
}

function setTheme(theme) {
  const safeTheme = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safeTheme);
  setStoredTheme(safeTheme);
  syncThemeUI();
}

function toggleMode() {
  const current = getThemeParts(getStoredTheme());
  const nextMode = current.mode === "dark" ? "light" : "dark";
  setTheme(buildTheme(current.family, nextMode));
}

function setThemeFamily(family) {
  const current = getThemeParts(getStoredTheme());
  setTheme(buildTheme(family, current.mode));
}

function syncThemeUI() {
  const current = getThemeParts(getStoredTheme());

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

  document.querySelectorAll("[data-theme-hint-text]").forEach((el) => {
    el.textContent = current.mode === "dark" ? "tap" : "tap";
  });

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const family = bubble.getAttribute("data-theme-family") || "neutral";
    const active = family === current.family;
    bubble.classList.toggle("active", active);
    bubble.setAttribute("aria-pressed", active ? "true" : "false");
  });

  document.querySelectorAll("[data-theme-pill]").forEach((button) => {
    button.classList.toggle("theme-is-light", current.mode === "light");
  });
}

function pulse(el) {
  if (!el) return;
  el.classList.remove("active-glow");
  void el.offsetWidth;
  el.classList.add("active-glow");
  setTimeout(() => el.classList.remove("active-glow"), 260);
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
      setThemeFamily(family);
      pulse(bubble);
    });
  });
}

function bindAllThemeControls() {
  bindThemeControls();
  syncThemeUI();
}

function initTheme() {
  setTheme(getStoredTheme());
  bindAllThemeControls();
}

window.EvaraTheme = {
  initTheme,
  setTheme,
  toggleMode,
  setThemeFamily,
  getStoredTheme,
  getThemeParts,
  buildTheme,
  bindThemeControls,
  bindAllThemeControls,
  syncThemeUI,
  syncThemeControls: syncThemeUI
};

document.addEventListener("DOMContentLoaded", initTheme);