import {installLiquidOptics} from "./liquid-optics.js?v=1";
import * as Core from "./theme-core-adaptive.js?v=adaptive-liquid-v7";
installLiquidOptics();
export const EVARAOS_THEME_BUILD="adaptive-liquid-v7";
export * from "./theme-core-adaptive.js?v=adaptive-liquid-v7";

function enforceUniversalTheme(detail={}){
  const root=document.documentElement;
  const appearance=Core.getAppearance();
  const environment=detail.resolved||detail.environment||Core.resolvedTheme(appearance);
  root.dataset.theme="adaptive";
  root.dataset.environment=environment;
  root.dataset.themeMode=appearance.mode;
  root.dataset.appearance=`adaptive-${appearance.mode}`;
}
addEventListener("evara:theme-applied",event=>enforceUniversalTheme(event.detail));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>enforceUniversalTheme(),{once:true});else enforceUniversalTheme();
