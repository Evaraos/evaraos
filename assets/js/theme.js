const STORAGE_KEY = "evaraos_theme_v6";
const DEFAULT_THEME = "dark";
const ALL_THEMES = ["light", "dark", "blue", "red", "pink", "green", "purple"];

function isValidTheme(theme) {
  return ALL_THEMES.includes(theme);
}

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isValidTheme(saved) ? saved : DEFAULT_THEME;
}

function getCurrentTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  return isValidTheme(current) ? current : getSavedTheme();
}

function setExpanded(element, isExpanded) {
  if (!element) return;
  element.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function applyTheme(theme) {
  const nextTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;

  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem(STORAGE_KEY, nextTheme);

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    const value = bubble.getAttribute("data-theme-value");
    bubble.classList.toggle("active", value === nextTheme);
  });

  document.querySelectorAll("[data-theme-core-toggle]").forEach((toggle) => {
    const label = toggle.querySelector(".theme-core-label");
    const dot = toggle.querySelector(".theme-core-dot");

    if (label) {
      label.textContent = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
    }

    if (dot) {
      dot.className = "theme-core-dot";
      dot.classList.add(`theme-dot-${nextTheme}`);
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
      // keep nav open if theme is inside menu-theme-block
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
      applyTheme(theme);
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