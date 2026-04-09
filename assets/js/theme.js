const STORAGE_KEY = "evaraos_theme_v9";

const ALL_THEMES = [
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

const COLOR_GROUPS = {
  neutral: {
    dark: "dark",
    light: "light",
    label: "Neutral"
  },
  blue: {
    dark: "blue-dark",
    light: "blue-light",
    label: "Blue"
  },
  red: {
    dark: "red-dark",
    light: "red-light",
    label: "Red"
  },
  pink: {
    dark: "pink-dark",
    light: "pink-light",
    label: "Pink"
  },
  green: {
    dark: "green-dark",
    light: "green-light",
    label: "Green"
  },
  purple: {
    dark: "purple-dark",
    light: "purple-light",
    label: "Purple"
  },
  yellow: {
    dark: "yellow-dark",
    light: "yellow-light",
    label: "Yellow"
  }
};

function isValidTheme(theme) {
  return ALL_THEMES.includes(theme);
}

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isValidTheme(saved) ? saved : "dark";
}

function getCurrentTheme() {
  const attrTheme = document.documentElement.getAttribute("data-theme");
  return isValidTheme(attrTheme) ? attrTheme : getSavedTheme();
}

function getThemeMode(theme) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return theme.endsWith("-light") ? "light" : "dark";
}

function getThemeGroup(theme) {
  if (theme === "dark" || theme === "light") return "neutral";
  return theme.split("-")[0];
}

function getThemeFromGroup(group, mode) {
  const config = COLOR_GROUPS[group] || COLOR_GROUPS.neutral;
  return config[mode] || config.dark;
}

function getGroupLabel(group) {
  return (COLOR_GROUPS[group] || COLOR_GROUPS.neutral).label;
}

function setExpanded(el, value) {
  if (!el) return;
  el.setAttribute("aria-expanded", value ? "true" : "false");
}

function updateThemeUI(theme) {
  const group = getThemeGroup(theme);
  const mode = getThemeMode(theme);

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const bubbleGroup = bubble.getAttribute("data-theme-group");
    bubble.classList.toggle("active", bubbleGroup === group);
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    const label = toggle.querySelector("[data-theme-mode-text]");
    const groupText = toggle.querySelector("[data-theme-group-text]");
    const dot = toggle.querySelector(".theme-core-dot");

    if (label) {
      label.textContent = mode === "dark" ? "Dark" : "Light";
    }

    if (groupText) {
      groupText.textContent = getGroupLabel(group);
    }

    if (dot) {
      dot.className = "theme-core-dot";
      dot.classList.add(`theme-dot-${theme}`);
    }

    toggle.dataset.currentTheme = theme;
    toggle.dataset.currentGroup = group;
    toggle.dataset.currentMode = mode;
  });
}

function applyTheme(theme) {
  const finalTheme = isValidTheme(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", finalTheme);
  localStorage.setItem(STORAGE_KEY, finalTheme);
  updateThemeUI(finalTheme);
}

function toggleModeForCurrentGroup() {
  const current = getCurrentTheme();
  const currentGroup = getThemeGroup(current);
  const currentMode = getThemeMode(current);
  const nextMode = currentMode === "dark" ? "light" : "dark";
  const nextTheme = getThemeFromGroup(currentGroup, nextMode);
  applyTheme(nextTheme);
}

function closeAllThemeMenus() {
  document.querySelectorAll("[data-theme-control], .menu-theme-block").forEach((container) => {
    container.classList.remove("open");
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    setExpanded(toggle, false);
  });
}

function bindThemeContainer(container) {
  if (!container || container.dataset.themeBound === "true") return;

  const coreToggle = container.querySelector("[data-theme-core-toggle]");
  const bubblesWrap = container.querySelector("[data-theme-bubbles]");
  const bubbles = container.querySelectorAll("[data-theme-bubble]");

  if (!coreToggle || !bubblesWrap || !bubbles.length) return;

  container.dataset.themeBound = "true";

  coreToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleModeForCurrentGroup();
  });

  bubblesWrap.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  bubbles.forEach((bubble) => {
    bubble.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const group = bubble.getAttribute("data-theme-group") || "neutral";
      const currentMode = getThemeMode(getCurrentTheme());
      const nextTheme = getThemeFromGroup(group, currentMode);

      applyTheme(nextTheme);
    });
  });
}

function bindAllThemeControls(root = document) {
  root.querySelectorAll(".menu-theme-block, [data-theme-control]").forEach(bindThemeContainer);
}

function initTheme() {
  applyTheme(getSavedTheme());
  bindAllThemeControls();
}

window.applyTheme = applyTheme;
window.initTheme = initTheme;
window.closeAllThemeMenus = closeAllThemeMenus;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  document.addEventListener("click", () => {
    closeAllThemeMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllThemeMenus();
    }
  });
});