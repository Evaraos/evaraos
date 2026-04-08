const STORAGE_KEY = "evaraos_theme";

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem(STORAGE_KEY, nextTheme);

  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
    toggle.setAttribute("aria-pressed", String(nextTheme === "light"));
    toggle.setAttribute(
      "aria-label",
      nextTheme === "light" ? "Switch to dark mode" : "Switch to light mode"
    );
  });
}

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function bindThemeToggles() {
  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(getInitialTheme());
  bindThemeToggles();
});

export { applyTheme };
