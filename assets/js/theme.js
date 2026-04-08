const STORAGE_KEY = "evaraos_theme_v5";
const DEFAULT_THEME = "dark";
const ALL_THEMES = ["light", "dark", "blue", "red", "pink", "green", "purple"];

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return ALL_THEMES.includes(saved) ? saved : DEFAULT_THEME;
}

function applyTheme(theme) {
  const nextTheme = ALL_THEMES.includes(theme) ? theme : DEFAULT_THEME;
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

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(getSavedTheme());

  document.querySelectorAll("[data-theme-bubble]").forEach((bubble) => {
    bubble.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const theme = bubble.getAttribute("data-theme-value");
      applyTheme(theme);
    });
  });
});

export { applyTheme };