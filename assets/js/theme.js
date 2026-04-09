const STORAGE_KEY = "evaraos-theme";

const DEFAULT_THEME = "dark";
const DEFAULT_MODE = "dark";
const DEFAULT_GROUP = "neutral";

const VALID_GROUPS = ["neutral", "blue", "red", "pink", "green", "purple", "yellow"];
const VALID_MODES = ["dark", "light"];

function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
}

function isValidTheme(theme = "") {
  if (theme === "dark" || theme === "light") return true;

  return VALID_GROUPS.some((group) => {
    if (group === "neutral") return false;
    return theme === `${group}-dark` || theme === `${group}-light`;
  });
}

function normalizeTheme(theme = "") {
  const value = String(theme || "").trim().toLowerCase();
  return isValidTheme(value) ? value : DEFAULT_THEME;
}

function getThemeParts(theme = DEFAULT_THEME) {
  const safeTheme = normalizeTheme(theme);

  if (safeTheme === "dark") {
    return { theme: safeTheme, mode: "dark", group: "neutral" };
  }

  if (safeTheme === "light") {
    return { theme: safeTheme, mode: "light", group: "neutral" };
  }

  const [group, mode] = safeTheme.split("-");
  return {
    theme: safeTheme,
    mode: VALID_MODES.includes(mode) ? mode : DEFAULT_MODE,
    group: VALID_GROUPS.includes(group) ? group : DEFAULT_GROUP
  };
}

function buildTheme(group = DEFAULT_GROUP, mode = DEFAULT_MODE) {
  const safeGroup = VALID_GROUPS.includes(group) ? group : DEFAULT_GROUP;
  const safeMode = VALID_MODES.includes(mode) ? mode : DEFAULT_MODE;

  if (safeGroup === "neutral") return safeMode;
  return `${safeGroup}-${safeMode}`;
}

function getModeLabel(mode = "dark") {
  return mode === "light" ? "Light" : "Dark";
}

function getGroupLabel(group = "neutral") {
  if (group === "neutral") return "Neutral";
  return group.charAt(0).toUpperCase() + group.slice(1);
}

function getHintLabel(mode = "dark") {
  return mode === "light" ? "tap" : "tap";
}

function syncThemeControls(theme = getStoredTheme()) {
  const { mode, group } = getThemeParts(theme);

  document.querySelectorAll("[data-theme-mode-text]").forEach((el) => {
    el.textContent = getModeLabel(mode);
  });

  document.querySelectorAll("[data-theme-group-text]").forEach((el) => {
    el.textContent = getGroupLabel(group);
  });

  document.querySelectorAll("[data-theme-hint-text]").forEach((el) => {
    el.textContent = getHintLabel(mode);
  });

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const bubbleGroup = bubble.getAttribute("data-theme-group") || "neutral";
    const isActive = bubbleGroup === group;
    bubble.classList.toggle("active", isActive);
    bubble.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    toggle.setAttribute(
      "aria-label",
      `Theme mode ${getModeLabel(mode)}. Current color ${getGroupLabel(group)}. Tap to switch light and dark mode.`
    );
    toggle.dataset.themeMode = mode;
    toggle.dataset.themeGroup = group;
  });
}

function applyTheme(theme) {
  const safeTheme = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safeTheme);
  setStoredTheme(safeTheme);
  syncThemeControls(safeTheme);
  return safeTheme;
}

function toggleMode() {
  const current = getThemeParts(getStoredTheme());
  const nextMode = current.mode === "dark" ? "light" : "dark";
  const nextTheme = buildTheme(current.group, nextMode);
  return applyTheme(nextTheme);
}

function setThemeGroup(group) {
  const current = getThemeParts(getStoredTheme());
  const safeGroup = VALID_GROUPS.includes(group) ? group : DEFAULT_GROUP;
  const nextTheme = buildTheme(safeGroup, current.mode);
  return applyTheme(nextTheme);
}

function pulseElement(el) {
  if (!el) return;
  el.classList.add("active-glow");
  setTimeout(() => el.classList.remove("active-glow"), 240);
}

function bindThemeControlBlock(block) {
  if (!block || block.dataset.themeBound === "true") return;
  block.dataset.themeBound = "true";

  const coreToggle = block.querySelector("[data-theme-core-toggle]");
  const bubbles = block.querySelectorAll("[data-theme-bubble]");

  if (coreToggle) {
    coreToggle.addEventListener("click", () => {
      toggleMode();
      pulseElement(coreToggle);
    });
  }

  bubbles.forEach((bubble) => {
    bubble.addEventListener("click", () => {
      const group = bubble.getAttribute("data-theme-group") || "neutral";
      setThemeGroup(group);
      pulseElement(bubble);
    });
  });
}

function bindAllThemeControls() {
  document.querySelectorAll("[data-theme-control]").forEach((block) => {
    bindThemeControlBlock(block);
  });
}

function initTheme() {
  const applied = applyTheme(getStoredTheme());
  bindAllThemeControls();
  syncThemeControls(applied);
}

window.closeAllThemeMenus = function closeAllThemeMenus() {
  document.querySelectorAll("[data-theme-control]").forEach((block) => {
    block.classList.remove("open");
  });
};

window.EvaraTheme = {
  applyTheme,
  toggleMode,
  setThemeGroup,
  getStoredTheme,
  getThemeParts,
  buildTheme,
  syncThemeControls,
  bindAllThemeControls,
  initTheme
};

document.addEventListener("DOMContentLoaded", initTheme);

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest("#universalNav")) {
    setTimeout(() => {
      bindAllThemeControls();
      syncThemeControls(getStoredTheme());
    }, 0);
  }
});