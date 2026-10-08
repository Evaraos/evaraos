import * as Core from "./theme-core-adaptive.js?v=adaptive-liquid-v14-universal";

export const EVARAOS_THEME_BUILD = "adaptive-liquid-v16-universal";
export const applyAppearance = Core.applyAppearance;
export const setAppearance = Core.setAppearance;
export const saveAppearance = Core.saveAppearance;
export const resetAppearance = Core.resetAppearance;
export const VALID_MODES = Core.VALID_MODES;
export const getEffectiveWallpaper = Core.getEffectiveWallpaper;
export const getAppearance = Core.getAppearance;
export const getTheme = Core.getTheme;
export const getThemeMode = Core.getThemeMode;
export const setTheme = Core.setTheme;
export const setThemeMode = Core.setThemeMode;

function runIdle(task, timeout = 1800) {
  if ("requestIdleCallback" in window) requestIdleCallback(task, { timeout });
  else setTimeout(task, 260);
}

function loadOptional(path) {
  return import(path).catch((error) => console.warn("Optional theme module failed:", path, error));
}

async function loadPageEnhancements() {
  const body = document.body;
  if (!body) return;

  const isEntryPage = body.matches(".login-page,.signup-page,.staff-application-page");
  const isStaffApplication = body.classList.contains("staff-application-page");

  if (isEntryPage) await loadOptional("./onboarding-entry.js?v=3");
  if (isStaffApplication) {
    await loadOptional("./staff-application-dedupe.js?v=3");
    await loadOptional("./staff-application-experience.js?v=2");
  }

  runIdle(() => loadOptional("./liquid-interaction.js?v=3").then((module) => module?.installLiquidInteraction?.()));

  if (document.querySelector(".site-footer-right,.social-link")) {
    runIdle(() => loadOptional("./social-links.js?v=2"), 2400);
  }
}

addEventListener("pageshow", () => Core.applyAppearance(Core.getAppearance(), { force: true }));
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function(){ loadPageEnhancements(); }, { once: true });
} else {
  loadPageEnhancements();
}
