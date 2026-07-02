import {installLiquidOptics} from "./liquid-optics.js?v=1";
import {installOnboardingEntry} from "./onboarding-entry.js?v=2";
import "./staff-application-dedupe.js?v=1";
import * as Core from "./theme-core-adaptive.js?v=adaptive-liquid-v7";
installLiquidOptics();
installOnboardingEntry();
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
  if(window.EvaraTheme)window.EvaraTheme.getTheme=()=>"adaptive";
}

const root=document.documentElement;
new MutationObserver(()=>{
  if(root.dataset.theme!=="adaptive")enforceUniversalTheme();
}).observe(root,{attributes:true,attributeFilter:["data-theme"]});

addEventListener("evara:theme-applied",event=>enforceUniversalTheme(event.detail));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>enforceUniversalTheme(),{once:true});else enforceUniversalTheme();
