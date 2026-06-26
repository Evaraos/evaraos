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
    var fallback = { mode: "light", imageTheme: "dark", imageUrl: "", imagePosition: "center center", imageOverlay: 0.36, glassTransparency: 0.72 };
    try {
      var raw = localStorage.getItem("evaraos-appearance");
      if (!raw) return fallback;
      var stored = JSON.parse(raw) || {};
      var overlay = Number(stored.imageOverlay);
      var transparency = Number(stored.glassTransparency);
      return {
        mode: VALID_MODES.indexOf(stored.mode) >= 0 ? stored.mode : "light",
        imageTheme: VALID_IMAGE_THEMES.indexOf(stored.imageTheme) >= 0 ? stored.imageTheme : "dark",
        imageUrl: validImageUrl(stored.imageUrl),
        imagePosition: VALID_POSITIONS.indexOf(stored.imagePosition) >= 0 ? stored.imagePosition : "center center",
        imageOverlay: Number.isFinite(overlay) ? Math.min(0.72, Math.max(0.08, overlay)) : 0.36,
        glassTransparency: Number.isFinite(transparency) ? Math.min(1, Math.max(0.28, transparency)) : 0.72
      };
    } catch { return fallback; }
  }

  function resolvedTheme(appearance) {
    if (appearance.mode === "system") return systemTheme();
    if (appearance.mode === "image") return appearance.imageTheme;
    return appearance.mode === "dark" ? "dark" : "light";
  }

  function injectCriticalNavigation() {
    if (document.getElementById("evaraCriticalNavStyle")) return;
    var style = document.createElement("style");
    style.id = "evaraCriticalNavStyle";
    style.textContent = ".legacy-nav,.topbar,.navbar,.dashboard-topbar,.old-nav-shell{visibility:hidden!important;opacity:0!important}#universalNavRoot{position:fixed;inset:0;z-index:2147483647;pointer-events:none}#universalNavRoot:empty:before,#universalNavRoot:empty:after{content:'';position:fixed;top:calc(env(safe-area-inset-top,0px) + 9px);width:48px;height:48px;z-index:2147483647;pointer-events:none}#universalNavRoot:empty:before{left:max(12px,env(safe-area-inset-left));border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(255,255,255,.18));border:1px solid rgba(255,255,255,.48);box-shadow:0 12px 30px rgba(0,0,0,.14);backdrop-filter:blur(20px)}#universalNavRoot:empty:after{right:max(14px,env(safe-area-inset-right));background:radial-gradient(circle,currentColor 0 22%,transparent 24%);opacity:.82}html[data-theme='dark'] #universalNavRoot:empty:before{background:linear-gradient(145deg,rgba(30,30,30,.74),rgba(18,18,18,.56));border-color:rgba(255,255,255,.16)}";
    document.head.appendChild(style);
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
  root.style.setProperty("--evara-glass-strength", Math.round(appearance.glassTransparency * 100) + "%");
  root.style.setProperty("--evara-glass-strength-soft", Math.round(Math.max(0.18, appearance.glassTransparency * 0.72) * 100) + "%");
  injectCriticalNavigation();
  root.classList.add("boot-pending");
})();
