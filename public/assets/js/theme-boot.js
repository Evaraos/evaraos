// Evaraos shared first-paint appearance boot.
(function () {
  var VALID_MODES = ["light", "dark", "system", "image"];
  var VALID_IMAGE_THEMES = ["light", "dark"];
  var VALID_POSITIONS = ["center center", "center top", "center bottom", "left center", "right center"];

  function systemTheme() {
    try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    catch { return "light"; }
  }

  function validImageUrl(value) {
    var source = String(value || "").trim();
    if (!source) return "";
    if (/^data:image\/(?:avif|gif|jpeg|jpg|png|webp);base64,/i.test(source)) return source;
    try {
      var url = new URL(source, window.location.origin);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  }

  function loadAppearance() {
    var fallback = { mode: "light", imageTheme: "dark", imageUrl: "", imagePosition: "center center", imageOverlay: 0.36 };
    try {
      var raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return fallback;
      var stored = JSON.parse(raw) || {};
      var overlay = Number(stored.imageOverlay);
      return {
        mode: VALID_MODES.indexOf(stored.mode) >= 0 ? stored.mode : "light",
        imageTheme: VALID_IMAGE_THEMES.indexOf(stored.imageTheme) >= 0 ? stored.imageTheme : "dark",
        imageUrl: validImageUrl(stored.imageUrl),
        imagePosition: VALID_POSITIONS.indexOf(stored.imagePosition) >= 0 ? stored.imagePosition : "center center",
        imageOverlay: Number.isFinite(overlay) ? Math.min(0.72, Math.max(0.08, overlay)) : 0.36
      };
    } catch { return fallback; }
  }

  function resolvedTheme(appearance) {
    if (appearance.mode === "system") return systemTheme();
    if (appearance.mode === "image") return appearance.imageTheme;
    return appearance.mode === "dark" ? "dark" : "light";
  }

  var appearance = loadAppearance();
  var theme = resolvedTheme(appearance);
  var root = document.documentElement;
  var hasImage = appearance.mode === "image" && Boolean(appearance.imageUrl);
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-theme-mode", appearance.mode);
  root.setAttribute("data-image-theme", appearance.imageTheme);
  root.toggleAttribute("data-has-wallpaper", hasImage);
  root.style.colorScheme = theme;
  root.style.setProperty("--evara-wallpaper-image", appearance.imageUrl ? "url(" + JSON.stringify(appearance.imageUrl) + ")" : "none");
  root.style.setProperty("--evara-wallpaper-position", appearance.imagePosition);
  root.style.setProperty("--evara-wallpaper-overlay", String(appearance.imageOverlay));
  root.classList.add("boot-pending");
})();
