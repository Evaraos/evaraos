// Evaraos shared first-paint theme boot
// Keep this tiny and dependency-free so it can run before CSS/JS app modules.
(function () {
  function resolveTheme() {
    try {
      var raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return "light";

      var appearance = JSON.parse(raw);
      return appearance && appearance.mode === "dark" ? "dark" : "light";
    } catch (error) {
      return "light";
    }
  }

  var theme = resolveTheme();
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.add("boot-pending");
})();
