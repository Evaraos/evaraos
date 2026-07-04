import { installLiquidInteraction } from "./liquid-interaction.js?v=3";
import { installOnboardingEntry } from "./onboarding-entry.js?v=3";
import "./staff-application-dedupe.js?v=3";
import "./staff-application-experience.js?v=2";
import "./social-links.js?v=2";
import * as Core from "./theme-core-adaptive.js?v=adaptive-liquid-v11";

installLiquidInteraction();
installOnboardingEntry();

export const EVARAOS_THEME_BUILD = "adaptive-liquid-v12-single-authority";
export const applyAppearance = Core.applyAppearance;
export const setAppearance = Core.setAppearance;
export const getAppearance = Core.getAppearance;
export const getTheme = Core.getTheme;
export const getThemeMode = Core.getThemeMode;
export const setTheme = Core.setTheme;
export const setThemeMode = Core.setThemeMode;

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
  document.addEventListener("DOMContentLoaded", function(){ enforceUniversalTheme({}); }, { once: true });
} else {
  enforceUniversalTheme({});
}
