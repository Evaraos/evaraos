const STORAGE_KEY = "evaraos_theme_v2";

const THEMES = ["dark", "light", "blue", "red", "pink", "purple"];

function applyTheme(theme) {
  const nextTheme = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem(STORAGE_KEY, nextTheme);

  document.querySelectorAll("[data-theme-chip]").forEach((chip) => {
    const chipTheme = chip.getAttribute("data-theme-value");
    chip.classList.toggle("active", chipTheme === nextTheme);
  });
}

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEMES.includes(saved) ? saved : "dark";
}

function closeThemeMenu() {
  document.querySelectorAll("[data-theme-menu]").forEach((menu) => {
    menu.classList.remove("open");
  });
  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
    toggle.setAttribute("aria-expanded", "false");
  });
}

function bindThemeMenus() {
  document.querySelectorAll("[data-theme-wrapper]").forEach((wrapper) => {
    const toggle = wrapper.querySelector("[data-theme-toggle]");
    const menu = wrapper.querySelector("[data-theme-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = menu.classList.contains("open");
      closeThemeMenu();

      if (!isOpen) {
        menu.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    menu.querySelectorAll("[data-theme-chip]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const value = chip.getAttribute("data-theme-value");
        applyTheme(value);
        closeThemeMenu();
      });
    });
  });

  document.addEventListener("click", () => {
    closeThemeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeThemeMenu();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(getInitialTheme());
  bindThemeMenus();
});

export { applyTheme };