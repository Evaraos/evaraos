import { initAdaptiveGlass, refreshAdaptiveGlass, getEffectiveWallpaper } from "./theme-adaptive.js";

export const APPEARANCE_KEY="evaraos-appearance";
export const VALID_MODES=Object.freeze(["image"]);
export const IMAGE_POSITIONS=Object.freeze(["center center","center top","center bottom","left center","right center"]);
export const DEFAULT_APPEARANCE=Object.freeze({mode:"image",imageUrl:"",imagePosition:"center center",wallpaperDim:.08,glassTint:.46,adaptiveContrast:true,updatedAt:null});
const THEME_STYLESHEET="/assets/css/theme.css?v=adaptive-liquid-v2";
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};

function normalizeImageUrl(value){
  const source=String(value||"").trim();
  if(!source)return"";
  if(source.startsWith("data:image/")&&!source.startsWith("data:image/svg"))return source;
  try{const url=new URL(source,location.origin);return["http:","https:"].includes(url.protocol)?url.href:""}catch{return""}
}

export function normalizeAppearance(value={}){
  const oldOverlay=Number(value.imageOverlay),oldDensity=Number(value.glassTransparency);
  const migratedDim=Number.isFinite(oldOverlay)?Math.min(.28,Math.max(0,oldOverlay*.34)):DEFAULT_APPEARANCE.wallpaperDim;
  const migratedTint=Number.isFinite(oldDensity)?Math.min(.76,Math.max(.18,oldDensity*.74)):DEFAULT_APPEARANCE.glassTint;
  return{mode:"image",imageUrl:normalizeImageUrl(value.imageUrl),imagePosition:IMAGE_POSITIONS.includes(value.imagePosition)?value.imagePosition:DEFAULT_APPEARANCE.imagePosition,wallpaperDim:clamp(value.wallpaperDim,0,.34,migratedDim),glassTint:clamp(value.glassTint,.18,.76,migratedTint),adaptiveContrast:value.adaptiveContrast!==false,updatedAt:value.updatedAt||null};
}

export function getAppearance(){try{return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY)||"{}"))}catch{return{...DEFAULT_APPEARANCE}}}
export const getThemeMode=()=>"image";
export const getTheme=()=>"adaptive";
export const resolvedTheme=()=>"adaptive";
export const systemTheme=()=>"adaptive";

function ensureThemeLink(){
  const links=[...document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/theme.css"]')];
  let active=links.pop();links.forEach(link=>link.remove());
  if(!active){active=document.createElement("link");active.rel="stylesheet";document.head.appendChild(active)}
  const desired=new URL(THEME_STYLESHEET,location.origin).href;
  if(active.href!==desired)active.href=desired;
  if(active!==document.head.lastElementChild)document.head.appendChild(active)
}
const cssUrl=value=>value?`url(${JSON.stringify(value)})`:"none";

export function updateThemeControls(){
  document.querySelectorAll("#evaThemeToggle,#evaThemePillToggle,[data-theme-toggle],[data-theme-label]").forEach(node=>{
    node.dataset.themeMode="image";node.dataset.themeResolved="adaptive";node.title="Adaptive Liquid Glass";
    node.setAttribute("aria-label","Adaptive Liquid Glass appearance");
    if(node.matches("[data-theme-label]"))node.textContent="Adaptive"
  })
}

export async function applyAppearance(value=getAppearance()){
  ensureThemeLink();
  const appearance=normalizeAppearance(value),wallpaperUrl=getEffectiveWallpaper(appearance.imageUrl),root=document.documentElement;
  root.dataset.theme="adaptive";root.dataset.themeMode="image";root.dataset.appearance="adaptive-image";
  root.dataset.adaptiveContrast=appearance.adaptiveContrast?"on":"off";root.setAttribute("data-has-wallpaper","");root.style.colorScheme="only light";
  root.style.setProperty("--evara-wallpaper-image",cssUrl(wallpaperUrl));
  root.style.setProperty("--evara-wallpaper-position",appearance.imagePosition);
  root.style.setProperty("--evara-wallpaper-dim",String(appearance.wallpaperDim));
  root.style.setProperty("--evara-glass-tint",String(appearance.glassTint));
  root.style.setProperty("--evara-glass-tint-pct",`${Math.round(appearance.glassTint*100)}%`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content","#111827");
  updateThemeControls();await initAdaptiveGlass(appearance,wallpaperUrl);
  root.dataset.evaraThemeReady="true";root.classList.remove("boot-pending");
  const detail={...appearance,theme:"adaptive",wallpaperUrl};
  dispatchEvent(new CustomEvent("evara:theme-applied",{detail}));dispatchEvent(new CustomEvent("evara:appearance-updated",{detail}));
  return appearance
}

export const applyTheme=()=>applyAppearance();
export function saveAppearance(value={}){const appearance=normalizeAppearance({...getAppearance(),...value,mode:"image",adaptiveContrast:true,updatedAt:new Date().toISOString()});localStorage.setItem(APPEARANCE_KEY,JSON.stringify(appearance));void applyAppearance(appearance);return appearance}
export const setThemeMode=()=>saveAppearance({mode:"image"});
export const setImageTheme=()=>saveAppearance({mode:"image"});
export function resetAppearance(){localStorage.removeItem(APPEARANCE_KEY);const appearance={...DEFAULT_APPEARANCE,updatedAt:new Date().toISOString()};void applyAppearance(appearance);return appearance}

if(typeof window!=="undefined"){
  window.EvaraTheme={...(window.EvaraTheme||{}),APPEARANCE_KEY,VALID_MODES,IMAGE_POSITIONS,DEFAULT_APPEARANCE,normalizeAppearance,resolvedTheme,systemTheme,getAppearance,getThemeMode,getTheme,applyAppearance,applyTheme,saveAppearance,setThemeMode,setImageTheme,resetAppearance,updateThemeControls,refreshAdaptiveGlass};
  const init=()=>void applyAppearance();
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
  addEventListener("storage",event=>{if(event.key===APPEARANCE_KEY)void applyAppearance()});
  addEventListener("pageshow",init)
}
