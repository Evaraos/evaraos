/*
 * Legacy compatibility bridge.
 * Theme resolution, persistence, controls, and DOM state are owned by theme.js.
 */
(function () {
  function syncFromThemeEngine() {
    try {
      window.EvaraTheme?.applyTheme?.();
    } catch (error) {
      console.warn("Theme compatibility sync failed:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromThemeEngine, { once: true });
  } else {
    queueMicrotask(syncFromThemeEngine);
  }
})();
