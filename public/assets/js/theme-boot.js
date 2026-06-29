(function () {
  var defaults = {
    mode: "light",
    imageTheme: "light",
    imageUrl: "",
    imagePosition: "center center",
    imageOverlay: .28,
    glassTransparency: .62
  };
  var appearance = defaults;

  try {
    var stored = JSON.parse(localStorage.getItem("evaraos-appearance") || "{}");
    appearance = {
      mode: ["light", "dark", "system", "image"].indexOf(stored.mode) >= 0 ? stored.mode : defaults.mode,
      imageTheme: stored.imageTheme === "dark" ? "dark" : "light",
      imageUrl: typeof stored.imageUrl === "string" ? stored.imageUrl : "",
      imagePosition: typeof stored.imagePosition === "string" ? stored.imagePosition : defaults.imagePosition,
      imageOverlay: Number.isFinite(Number(stored.imageOverlay)) ? Math.min(.72, Math.max(.08, Number(stored.imageOverlay))) : defaults.imageOverlay,
      glassTransparency: Number.isFinite(Number(stored.glassTransparency)) ? Math.min(.82, Math.max(.42, Number(stored.glassTransparency))) : defaults.glassTransparency
    };
  } catch (_) {}

  var resolved = appearance.mode;
  if (appearance.mode === "system") {
    resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (appearance.mode === "image") resolved = appearance.imageTheme;
  if (resolved !== "dark") resolved = "light";

  var root = document.documentElement;
  var density = Math.round(appearance.glassTransparency * 100);
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-mode", appearance.mode);
  root.setAttribute("data-image-theme", appearance.imageTheme);
  if (appearance.mode === "image" && appearance.imageUrl) root.setAttribute("data-has-wallpaper", "");
  root.style.colorScheme = resolved;
  root.style.setProperty("--evara-wallpaper-image", appearance.imageUrl ? "url(" + JSON.stringify(appearance.imageUrl) + ")" : "none");
  root.style.setProperty("--evara-wallpaper-position", appearance.imagePosition);
  root.style.setProperty("--evara-wallpaper-overlay", String(appearance.imageOverlay));
  root.style.setProperty("--evara-wallpaper-overlay-pct", Math.round(appearance.imageOverlay * 100) + "%");
  root.style.setProperty("--evara-glass-density", density + "%");
  root.style.setProperty("--evara-glass-clarity", (100 - density) + "%");
  root.classList.add("boot-pending");
})();
