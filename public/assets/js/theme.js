import * as Core from "./theme-core-adaptive.js?v=adaptive-liquid-v18-surface-text";

export const EVARAOS_THEME_BUILD = "adaptive-liquid-v13-public-critical";
export const applyAppearance = Core.applyAppearance;
export const setAppearance = Core.setAppearance;
export const getAppearance = Core.getAppearance;
export const VALID_MODES = Core.VALID_MODES;
export const saveAppearance = (value = {}) => {
  const appearance = Core.normalizeAppearance({ ...Core.getAppearance(), ...value, updatedAt: value.updatedAt || new Date().toISOString() });
  void Core.setAppearance(appearance);
  return appearance;
};
export const resetAppearance = () => saveAppearance({ ...Core.DEFAULT_APPEARANCE });
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

function enforceUniversalTheme(detail) {
  const root = document.documentElement;
  const appearance = Core.getAppearance();
  const environment = detail && (detail.resolved || detail.environment) ? (detail.resolved || detail.environment) : Core.resolvedTheme(appearance);
  root.dataset.theme = "adaptive";
  root.dataset.environment = environment;
  root.dataset.themeMode = appearance.mode;
  root.dataset.appearance = "adaptive-" + appearance.mode;
  root.dataset.evaraThemeAuthority = "runtime";
  root.style.colorScheme = environment === "dark" ? "dark" : "light";
  if (window.EvaraTheme) window.EvaraTheme.getTheme = function(){ return "adaptive"; };
}

addEventListener("evara:theme-applied", function(event){ enforceUniversalTheme(event.detail || {}); });
addEventListener("pageshow", function(){ enforceUniversalTheme({}); });
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function(){ enforceUniversalTheme({}); loadPageEnhancements(); }, { once: true });
} else {
  enforceUniversalTheme({});
  loadPageEnhancements();
}
