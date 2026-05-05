(function () {
  const THEME_LINK_ID = "evaraos-theme-css";

  function getMode() {
    try {
      const raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return "light";
      const appearance = JSON.parse(raw);
      if (appearance.mode === "dark") return "dark";
      if (appearance.mode === "light") return "light";
      if (appearance.mode === "custom") return appearance.baseFamily === "light" ? "light" : "dark";
    } catch {}
    return "light";
  }

  function applyTheme() {
    const mode = getMode();
    document.documentElement.setAttribute("data-theme", mode);

    const stale = document.getElementById(THEME_LINK_ID);
    if (stale) stale.remove();
  }

  applyTheme();
  window.addEventListener("storage", applyTheme);
  window.addEventListener("evara:appearance-updated", applyTheme);
})();
