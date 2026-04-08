const STORAGE_KEY = "evaraos_theme_v7";

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

const BUBBLE_GROUPS = {
  light: ["light", "dark"],
  dark: ["light", "dark"],
  blue: ["blue-light", "blue-dark"],
  red: ["red-light", "red-dark"],
  pink: ["pink-light", "pink-dark"],
  green: ["green-light", "green-dark"],
  purple: ["purple-light", "purple-dark"],
  yellow: ["yellow-light", "yellow-dark"]
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

function setExpanded(element, isExpanded) {
  if (!element) return;
  element.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function getThemeLabel(theme) {
  const labels = {
    light: "Light",
    dark: "Dark",
    "blue-light": "Blue Light",
    "blue-dark": "Blue Dark",
    "red-light": "Red Light",
    "red-dark": "Red Dark",
    "pink-light": "Pink Light",
    "pink-dark": "Pink Dark",
    "green-light": "Green Light",
    "green-dark": "Green Dark",
    "purple-light": "Purple Light",
    "purple-dark": "Purple Dark",
    "yellow-light": "Yellow Light",
    "yellow-dark": "Yellow Dark"
  };

  return labels[theme] || "Theme";
}

function getDotClass(theme) {
  return `theme-dot-${theme}`;
}

function applyTheme(theme) {
  const nextTheme = isValidTheme(theme) ? theme : "dark";

  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem(STORAGE_KEY, nextTheme);

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const bubbleValue = bubble.getAttribute("data-theme-value");
    const isActive = bubbleValue === nextTheme;
    bubble.classList.toggle("active", isActive);
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    const label = toggle.querySelector(".theme-core-label");
    const dot = toggle.querySelector(".theme-core-dot");

    if (label) {
      label.textContent = getThemeLabel(nextTheme);
    }

    if (dot) {
      dot.className = "theme-core-dot";
      dot.classList.add(getDotClass(nextTheme));
    }
  });
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

function getGroupFromBubble(bubble) {
  const group = bubble.getAttribute("data-theme-group");
  if (group && BUBBLE_GROUPS[group]) return group;

  const value = bubble.getAttribute("data-theme-value");
  if (!value) return null;

  const matched = Object.keys(BUBBLE_GROUPS).find((key) => BUBBLE_GROUPS[key].includes(value));
  return matched || null;
}

function getPairedTheme(group, currentTheme) {
  const pair = BUBBLE_GROUPS[group];
  if (!pair) return currentTheme;

  if (pair.length === 2) {
    return currentTheme === pair[0] ? pair[1] : pair[0];
  }

  return pair[0];
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

    if (window.closeAllNavDropdowns) {
      const insideNavMenu = !!container.closest("[data-nav-menu]");
      if (!insideNavMenu) {
        window.closeAllNavDropdowns();
      }
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

      const theme = bubble.getAttribute("data-theme-value");
      if (isValidTheme(theme)) {
        applyTheme(theme);
      }
    });

    bubble.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const group = getGroupFromBubble(bubble);
      if (!group) return;

      const currentTheme = getCurrentTheme();
      const nextTheme = getPairedTheme(group, currentTheme);

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