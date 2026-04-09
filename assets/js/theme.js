const STORAGE_KEY = "evaraos_theme_v8";

const ALL_THEMES = [
  "light",
  "dark",
  "blue-light",
  "blue-dark",
  "red-light",
  "red-dark",
  "pink-light",
  "pink-dark",
  "green-light",
  "green-dark",
  "purple-light",
  "purple-dark",
  "yellow-light",
  "yellow-dark"
];

const COLOR_GROUPS = {
  neutral: { light: "light", dark: "dark", label: "Neutral" },
  blue: { light: "blue-light", dark: "blue-dark", label: "Blue" },
  red: { light: "red-light", dark: "red-dark", label: "Red" },
  pink: { light: "pink-light", dark: "pink-dark", label: "Pink" },
  green: { light: "green-light", dark: "green-dark", label: "Green" },
  purple: { light: "purple-light", dark: "purple-dark", label: "Purple" },
  yellow: { light: "yellow-light", dark: "yellow-dark", label: "Yellow" }
};

function isValidTheme(theme) {
  return ALL_THEMES.includes(theme);
}

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isValidTheme(saved) ? saved : "dark";
}

function getCurrentTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  return isValidTheme(current) ? current : getSavedTheme();
}

function getThemeMode(theme) {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return theme.endsWith("-light") ? "light" : "dark";
}

function getThemeGroup(theme) {
  if (theme === "light" || theme === "dark") return "neutral";
  return theme.split("-")[0];
}

function getThemeFromGroup(group, mode) {
  const entry = COLOR_GROUPS[group] || COLOR_GROUPS.neutral;
  return entry[mode] || entry.dark;
}

function getGroupLabel(group) {
  return (COLOR_GROUPS[group] || COLOR_GROUPS.neutral).label;
}

function setExpanded(element, isExpanded) {
  if (!element) return;
  element.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function updateThemeUI(theme) {
  const group = getThemeGroup(theme);
  const mode = getThemeMode(theme);

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const bubbleGroup = bubble.getAttribute("data-theme-group");
    bubble.classList.toggle("active", bubbleGroup === group);
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    const label = toggle.querySelector(".theme-core-label");
    const dot = toggle.querySelector(".theme-core-dot");
    const modeText = toggle.querySelector("[data-theme-mode-text]");
    const groupText = toggle.querySelector("[data-theme-group-text]");

    if (label) {
      label.textContent = `${mode === "dark" ? "Dark" : "Light"}`;
    }

    if (modeText) {
      modeText.textContent = mode === "dark" ? "Dark" : "Light";
    }

    if (groupText) {
      groupText.textContent = getGroupLabel(group);
    }

    if (dot) {
      dot.className = "theme-core-dot";
      dot.classList.add(`theme-dot-${theme}`);
    }

    toggle.dataset.currentGroup = group;
    toggle.dataset.currentMode = mode;
  });
}

function applyTheme(theme) {
  const nextTheme = isValidTheme(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem(STORAGE_KEY, nextTheme);
  updateThemeUI(nextTheme);
}

function closeAllThemeMenus() {
  document.querySelectorAll("[data-theme-control], .menu-theme-block").forEach((container) => {
    container.classList.remove("open");
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    setExpanded(toggle, false);
  });
}

function toggleThemeMenu(container) {
  if (!container) return;

  const toggle = container.querySelector("[data-theme-core-toggle]");
  const isOpen = container.classList.contains("open");

  closeAllThemeMenus();

  if (!isOpen) {
    container.classList.add("open");
    setExpanded(toggle, true);
  }
}

function bindThemeContainer(container) {
  if (!container || container.dataset.themeBound === "true") return;

  const toggle = container.querySelector("[data-theme-core-toggle]");
  const bubblesWrap = container.querySelector("[data-theme-bubbles]");

  if (!toggle || !bubblesWrap) return;

  container.dataset.themeBound = "true";

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentTheme = getCurrentTheme();
    const currentGroup = getThemeGroup(currentTheme);
    const currentMode = getThemeMode(currentTheme);
    const nextMode = currentMode === "dark" ? "light" : "dark";
    const nextTheme = getThemeFromGroup(currentGroup, nextMode);

    applyTheme(nextTheme);
  });

  toggle.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (window.closeAllNavDropdowns) {
      const insideNavMenu = !!container.closest("[data-nav-menu]");
      if (!insideNavMenu) window.closeAllNavDropdowns();
    }

    toggleThemeMenu(container);
  });

  bubblesWrap.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  container.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
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

function bindThemeControls(root = document) {
  root.querySelectorAll("[data-theme-control], .menu-theme-block").forEach(bindThemeContainer);
}

function initTheme() {
  applyTheme(getSavedTheme());
  bindThemeControls();
}

window.applyTheme = applyTheme;
window.closeAllThemeMenus = closeAllThemeMenus;
window.initTheme = initTheme;

window.addEventListener("DOMContentLoaded", () => {
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

export { applyTheme, initTheme };