const STORAGE_KEY = "evaraos_theme_v4";
const DEFAULT_THEME = "dark";
const COLOR_THEMES = ["blue", "red", "pink", "green", "purple"];

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved || DEFAULT_THEME;
}

function applyTheme(theme) {
  const nextTheme = theme || DEFAULT_THEME;
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
      if (nextTheme === "light") {
        label.textContent = "Light";
      } else if (nextTheme === "dark") {
        label.textContent = "Dark";
      } else {
        label.textContent = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
      }
    }

    if (dot) {
      dot.className = "theme-core-dot";
      dot.classList.add(`theme-dot-${nextTheme}`);
    }
  });
}

function closeAllThemeControls() {
  document.querySelectorAll("[data-theme-control]").forEach((control) => {
    control.classList.remove("open");

    const toggle = control.querySelector("[data-theme-core-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function cycleLightDark(currentTheme) {
  return currentTheme === "light" ? "dark" : "light";
}

function bindThemeControls() {
  document.querySelectorAll("[data-theme-control]").forEach((control) => {
    const toggle = control.querySelector("[data-theme-core-toggle]");
    const bubbles = control.querySelector("[data-theme-bubbles]");

    if (!toggle || !bubbles) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentTheme = document.documentElement.getAttribute("data-theme") || DEFAULT_THEME;
      const nextLightDark = cycleLightDark(currentTheme === "light" ? "light" : "dark");
      const currentlyOpen = control.classList.contains("open");

      applyTheme(nextLightDark);

      document.querySelectorAll("[data-theme-control]").forEach((item) => {
        item.classList.remove("open");
        const itemToggle = item.querySelector("[data-theme-core-toggle]");
        if (itemToggle) itemToggle.setAttribute("aria-expanded", "false");
      });

      if (window.closeAllNavDropdowns) {
        window.closeAllNavDropdowns();
      }

      if (!currentlyOpen) {
        control.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    bubbles.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    control.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
      bubble.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const value = bubble.getAttribute("data-theme-value");
        if (!COLOR_THEMES.includes(value)) return;

        applyTheme(value);
      });
    });
  });
}

window.closeAllThemeControls = closeAllThemeControls;

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(getSavedTheme());
  bindThemeControls();

  document.addEventListener("click", () => {
    closeAllThemeControls();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllThemeControls();
    }
  });
});

export { applyTheme };