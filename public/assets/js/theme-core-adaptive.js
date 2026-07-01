import { initAdaptiveGlass, refreshAdaptiveGlass, getEffectiveWallpaper } from "./theme-adaptive.js?v=adaptive-liquid-v7";
import { installUniversalTextInversion } from "./theme-text-inversion.js?v=adaptive-liquid-v7";

export const APPEARANCE_KEY="evaraos-appearance";
export const VALID_MODES=Object.freeze(["light","dark","system","image"]);
export const IMAGE_POSITIONS=Object.freeze(["center center","center top","center bottom","left center","right center"]);
export const DEFAULT_APPEARANCE=Object.freeze({mode:"system",imageUrl:"",imagePosition:"center center",wallpaperDim:.08,glassTint:.46,adaptiveContrast:true,updatedAt:null});
const THEME_STYLESHEET="/assets/css/theme.css?v=adaptive-liquid-v7";
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
let presetCache=new Map();

function normalizeImageUrl(value){
  const source=String(value||"").trim();
  if(!source)return"";
  if(source.startsWith("data:image/")&&!source.startsWith("data:image/svg"))return source;
  try{const url=new URL(source,location.origin);return["http:","https:"].includes(url.protocol)?url.href:""}catch{return""}
}

export function normalizeAppearance(value={}){
  const mode=VALID_MODES.includes(value.mode)?value.mode:DEFAULT_APPEARANCE.mode;
  const oldOverlay=Number(value.imageOverlay),oldDensity=Number(value.glassTransparency);
  const migratedDim=Number.isFinite(oldOverlay)?Math.min(.34,Math.max(0,oldOverlay*.34)):DEFAULT_APPEARANCE.wallpaperDim;
  const migratedTint=Number.isFinite(oldDensity)?Math.min(.76,Math.max(.18,oldDensity*.74)):DEFAULT_APPEARANCE.glassTint;
  return{mode,imageUrl:normalizeImageUrl(value.imageUrl),imagePosition:IMAGE_POSITIONS.includes(value.imagePosition)?value.imagePosition:DEFAULT_APPEARANCE.imagePosition,wallpaperDim:clamp(value.wallpaperDim,0,.34,migratedDim),glassTint:clamp(value.glassTint,.18,.76,migratedTint),adaptiveContrast:value.adaptiveContrast!==false,updatedAt:value.updatedAt||null};
}

export function getAppearance(){try{return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY)||"{}"))}catch{return{...DEFAULT_APPEARANCE}}}
export function systemTheme(){return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}
export function resolvedTheme(value=getAppearance()){return value.mode==="system"?systemTheme():value.mode}
export function getThemeMode(){return getAppearance().mode}
export function getTheme(){return resolvedTheme()==="image"?"adaptive":resolvedTheme()}

function presetWallpaper(mode){
  const resolved=mode==="system"?systemTheme():mode;
  if(presetCache.has(resolved))return presetCache.get(resolved);
  const c=document.createElement("canvas");c.width=1200;c.height=1600;
  const x=c.getContext("2d",{alpha:false});if(!x)return"";
  const dark=resolved==="dark";
  const g=x.createLinearGradient(0,0,c.width,c.height);
  if(dark){g.addColorStop(0,"#080b12");g.addColorStop(.42,"#151b28");g.addColorStop(.72,"#232b3d");g.addColorStop(1,"#080b12")}else{g.addColorStop(0,"#f7fbff");g.addColorStop(.42,"#dbe9f7");g.addColorStop(.72,"#f6e9ec");g.addColorStop(1,"#eef5fb")}
  x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  const blobs=dark?[[220,280,620,"rgba(71,119,210,.34)"],[1000,460,700,"rgba(117,74,182,.28)"],[650,1380,760,"rgba(201,58,95,.18)"]]:[[180,240,620,"rgba(134,205,255,.48)"],[1020,460,720,"rgba(186,164,255,.34)"],[650,1360,760,"rgba(255,178,190,.32)"]];
  for(const [cx,cy,r,color] of blobs){const q=x.createRadialGradient(cx,cy,0,cx,cy,r);q.addColorStop(0,color);q.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=q;x.fillRect(cx-r,cy-r,r*2,r*2)}
  const url=c.toDataURL("image/webp",.84);presetCache.set(resolved,url);return url
}

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
  const appearance=getAppearance(),resolved=resolvedTheme(appearance);
  document.querySelectorAll("#evaThemeToggle,#evaThemePillToggle,[data-theme-toggle]").forEach(node=>{
    node.dataset.themeMode=appearance.mode;node.dataset.themeResolved=resolved;node.title=`Appearance: ${appearance.mode}`;
    node.setAttribute("aria-label",`Current appearance: ${appearance.mode}`)
  });
  document.querySelectorAll("[data-theme-label]").forEach(node=>node.textContent=appearance.mode[0].toUpperCase()+appearance.mode.slice(1))
}

export async function applyAppearance(value=getAppearance()){
  ensureThemeLink();
  const appearance=normalizeAppearance(value),resolved=resolvedTheme(appearance),root=document.documentElement;
  const wallpaperUrl=appearance.mode==="image"?getEffectiveWallpaper(appearance.imageUrl):presetWallpaper(resolved);
  root.dataset.theme=resolved==="image"?"adaptive":resolved;
  root.dataset.themeMode=appearance.mode;
  root.dataset.appearance=`adaptive-${appearance.mode}`;
  root.dataset.adaptiveContrast=appearance.adaptiveContrast?"on":"off";
  root.toggleAttribute("data-has-wallpaper",appearance.mode==="image");
  root.style.colorScheme=resolved==="dark"?"dark":"light";
  root.style.setProperty("--evara-wallpaper-image",cssUrl(wallpaperUrl));
  root.style.setProperty("--evara-wallpaper-position",appearance.mode==="image"?appearance.imagePosition:"center center");
  root.style.setProperty("--evara-wallpaper-dim",String(appearance.mode==="image"?appearance.wallpaperDim:0));
  root.style.setProperty("--evara-glass-tint",String(appearance.glassTint));
  root.style.setProperty("--evara-glass-tint-pct",`${Math.round(appearance.glassTint*100)}%`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",resolved==="dark"?"#0b0f17":"#eef5fb");
  updateThemeControls();installUniversalTextInversion();await initAdaptiveGlass(appearance,wallpaperUrl);
  root.dataset.evaraThemeReady="true";root.classList.remove("boot-pending","evara-boot-lock");root.classList.add("evara-theme-painted");
  const detail={...appearance,resolved,theme:root.dataset.theme,wallpaperUrl};
  dispatchEvent(new CustomEvent("evara:theme-applied",{detail}));dispatchEvent(new CustomEvent("evara:appearance-updated",{detail}));
  return appearance
}

export const applyTheme=mode=>applyAppearance(mode?{...getAppearance(),mode}:getAppearance());
export function saveAppearance(value={}){const appearance=normalizeAppearance({...getAppearance(),...value,updatedAt:new Date().toISOString()});localStorage.setItem(APPEARANCE_KEY,JSON.stringify(appearance));void applyAppearance(appearance);return appearance}
export const setThemeMode=mode=>saveAppearance({mode});
export const setImageTheme=imageUrl=>saveAppearance({mode:"image",imageUrl:imageUrl||getAppearance().imageUrl});
export function resetAppearance(){localStorage.removeItem(APPEARANCE_KEY);const appearance={...DEFAULT_APPEARANCE,updatedAt:new Date().toISOString()};void applyAppearance(appearance);return appearance}

if(typeof window!=="undefined"){
  window.EvaraTheme={...(window.EvaraTheme||{}),APPEARANCE_KEY,VALID_MODES,IMAGE_POSITIONS,DEFAULT_APPEARANCE,normalizeAppearance,resolvedTheme,systemTheme,getAppearance,getThemeMode,getTheme,applyAppearance,applyTheme,saveAppearance,setThemeMode,setImageTheme,resetAppearance,updateThemeControls,refreshAdaptiveGlass};
  const init=()=>{installUniversalTextInversion();void applyAppearance()};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
  addEventListener("storage",event=>{if(event.key===APPEARANCE_KEY)void applyAppearance()});
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(getAppearance().mode==="system")void applyAppearance()});
  addEventListener("pageshow",init)
}
