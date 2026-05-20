// Evaraos shared first-paint theme boot
// Dependency-free: runs before CSS/modules to prevent dark/light flash.
(function () {
  var STORAGE_THEME = "evaraos-theme";
  var STORAGE_APPEARANCE = "evaraos-appearance";

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (error) {
      return "light";
    }
  }

  function normalizeTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function resolveTheme() {
    try {
      var rawAppearance = localStorage.getItem(STORAGE_APPEARANCE);
      if (rawAppearance) {
        var appearance = JSON.parse(rawAppearance);
        if (appearance && appearance.mode === "dark") return "dark";
        if (appearance && appearance.mode === "light") return "light";
        if (appearance && appearance.mode === "system") return systemTheme();
        if (appearance && appearance.mode === "custom") return normalizeTheme(appearance.baseFamily);
      }

      var rawTheme = localStorage.getItem(STORAGE_THEME);
      if (rawTheme === "dark" || rawTheme === "light") return rawTheme;
    } catch (error) {}

    return systemTheme();
  }

  var theme = resolveTheme();
  var root = document.documentElement;

  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.add("boot-pending");

  try {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#020307" : "#f4f7f6");
  } catch (error) {}
})();
