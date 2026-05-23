// Evaraos shared first-paint theme boot
// Supports only light, dark, and system.
(function () {
  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function resolveTheme() {
    try {
      var raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return "light";
      var appearance = JSON.parse(raw);
      if (appearance && appearance.mode === "dark") return "dark";
      if (appearance && appearance.mode === "system") return systemTheme();
      return "light";
    } catch (error) {
      return "light";
    }
  }

  var theme = resolveTheme();
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.add("boot-pending");
})();
