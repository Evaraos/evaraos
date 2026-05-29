(function () {
  const THEME_LINK_ID = "evaraos-theme-css";

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function resolveTheme() {
    try {
      const raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return "light";

      const appearance = JSON.parse(raw);
      if (appearance && appearance.mode === "dark") return "dark";
      if (appearance && appearance.mode === "system") return systemTheme();
      return "light";
    } catch {
      return "light";
    }
  }

  function applyTheme() {
    const theme = resolveTheme();
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;

    const stale = document.getElementById(THEME_LINK_ID);
    if (stale) stale.remove();
  }

  applyTheme();
  window.addEventListener("storage", applyTheme);
  window.addEventListener("evara:appearance-updated", applyTheme);
})();
