/* =========================
   EVARAOS THEME ENGINE
========================= */

const THEME_STORAGE_KEY = "evaraos_theme";

/* =========================
   DEFAULT
========================= */

const DEFAULT_THEME = "dark";

/* =========================
   APPLY THEME
========================= */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  updateThemeUI(theme);
}

/* =========================
   GET CURRENT
========================= */

function getCurrentTheme() {
  return (
    localStorage.getItem(THEME_STORAGE_KEY) ||
    DEFAULT_THEME
  );
}

/* =========================
   TOGGLE LIGHT/DARK
========================= */

function toggleCoreTheme() {
  const current = getCurrentTheme();

  // switch ONLY between base modes
  if (current.includes("dark")) {
    applyTheme("light");
  } else {
    applyTheme("dark");
  }
}

/* =========================
   COLOR THEMES
========================= */

function applyColorTheme(color) {
  const current = getCurrentTheme();

  const isDark = current.includes("dark");

  let finalTheme = `${color}-${isDark ? "dark" : "light"}`;

  applyTheme(finalTheme);
}

/* =========================
   UI STATE UPDATE
========================= */

function updateThemeUI(theme) {
  const bubbles = document.querySelectorAll(".theme-bubble");
  const coreLabel = document.getElementById("theme-core-label");
  const coreDot = document.getElementById("theme-core-dot");

  // reset bubbles
  bubbles.forEach(b => b.classList.remove("active"));

  // detect base + color
  let base = theme.includes("dark") ? "dark" : "light";
  let color = theme.replace("-dark", "").replace("-light", "");

  // activate correct bubble
  bubbles.forEach(b => {
    if (b.dataset.theme === color) {
      b.classList.add("active");
    }
  });

  // update main toggle display
  if (coreLabel) {
    coreLabel.textContent =
      base.charAt(0).toUpperCase() + base.slice(1);
  }

  // animate dot color
  if (coreDot) {
    coreDot.style.background = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-1");
  }
}

/* =========================
   INIT
========================= */

function initThemeSystem() {
  const saved = getCurrentTheme();
  applyTheme(saved);

  /* ===== CORE TOGGLE ===== */
  const coreToggle = document.getElementById("theme-core-toggle");

  if (coreToggle) {
    coreToggle.addEventListener("click", toggleCoreTheme);
  }

  /* ===== COLOR BUBBLES ===== */
  const bubbles = document.querySelectorAll(".theme-bubble");

  bubbles.forEach(bubble => {
    bubble.addEventListener("click", () => {
      const color = bubble.dataset.theme;
      applyColorTheme(color);
    });
  });
}

/* =========================
   LOAD
========================= */

document.addEventListener("DOMContentLoaded", initThemeSystem);