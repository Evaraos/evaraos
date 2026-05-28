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

function updateThemeControls() {
  const mode = getThemeMode();
  const resolved = getTheme();

  document.querySelectorAll("[data-theme-toggle], [data-theme-label]").forEach((node) => {
    node.setAttribute("data-theme-mode", mode);
    node.setAttribute("data-theme-resolved", resolved);

    const textNode = node.querySelector("[data-theme-text]");
    const iconNode = node.querySelector(".eva-theme-nav-icon");

    let label = "System mode";
    let icon = "◐";

    if (mode === "light") {
      label = "Light mode";
      icon = "☀";
    } else if (mode === "dark") {
      label = "Dark mode";
      icon = "☾";
    }

    if (textNode) textNode.textContent = label;
    if (iconNode) iconNode.textContent = icon;

    if (!textNode && node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
      node.textContent = label;
    }

    node.setAttribute("aria-label", `Theme mode: ${label}`);
  });
}

export function applyTheme(theme = getTheme()) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  const mode = getThemeMode();

  document.documentElement.setAttribute("data-theme", safeTheme);
  document.documentElement.setAttribute("data-theme-mode", mode);
  document.documentElement.style.colorScheme = safeTheme;

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    safeTheme === "dark" ? "#060814" : "#f4f7f6"
  );

  updateThemeControls();

  window.dispatchEvent(
    new CustomEvent("evara:theme-applied", {
      detail: { theme: safeTheme, mode }
    })
  );

  return safeTheme;
}

export function saveAppearance(nextAppearance = {}) {
  const appearance = normalizeAppearance({ ...getAppearance(), ...nextAppearance });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));

  const theme = applyTheme(resolvedTheme(appearance.mode));

  window.dispatchEvent(
    new CustomEvent("evara:appearance-updated", {
      detail: { ...appearance, theme }
    })
  );

  return appearance;
}

export function setThemeMode(mode = "light") {
  return saveAppearance({
    mode: normalizeMode(mode),
    updatedAt: new Date().toISOString()
  });
}

export function toggleTheme() {
  const current = getThemeMode();
  const next = current === "light"
    ? "dark"
    : current === "dark"
      ? "system"
      : "light";

  return setThemeMode(next);
}

function bindThemeControls() {
  if (window.__EVARA_THEME_BOUND__) return;
  window.__EVARA_THEME_BOUND__ = true;

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(
      "[data-theme-toggle], .theme-toggle, #themeToggle, .eva-theme-toggle"
    );

    if (!trigger) return;

    event.preventDefault();
    toggleTheme();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === APPEARANCE_KEY) {
      applyTheme();
    }
  });
}

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeMode() === "system") applyTheme(systemTheme());
  });
} catch {}

bindThemeControls();
applyTheme();