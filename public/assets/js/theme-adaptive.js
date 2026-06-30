const SURFACE_SELECTOR=[
  ".glass-card",".glass-shell",".liquid-glass",".aurora-card",
  ".dashboard-sidebar-inner",".dashboard-panel",".dashboard-overview",".dashboard-hero",".dashboard-hero-panel",
  ".dashboard-stat-card",".dashboard-list-item",".dashboard-feed-item",".dashboard-role-card",".dashboard-progress-row",".dashboard-state-card",
  ".settings-card",".settings-block",".settings-hub-card",".workspace-block",".qa-card",".application-card",".customer-service-event",
  ".eva-menu-panel",".eva-menu-glass-group",".eva-menu-control",".eva-app-link",".eva-bottom-nav",".eva-bottom-link",
  ".btn",".settings-chip",".role-pill",".role-pill-option",".messages-icon-button",".messages-camera",".messages-send",".messages-compose",
  ".eva-account-action",".eva-profile-trigger","#evaMenuBtn",".eva-top-alert","button:not(.appearance-source-backdrop)","input","textarea","select","[data-glass]"
].join(",");
const SURFACE_POINTS=[[.16,.16],[.5,.16],[.84,.16],[.16,.5],[.5,.5],[.84,.5],[.16,.84],[.5,.84],[.84,.84]];
const TEXT_X=[.02,.18,.34,.5,.66,.82,.98];
const TEXT_Y=[.28,.5,.72];
const DEFAULT_COLOR={r:38,g:48,b:68,a:1};
let fallbackUrl="",image=null,canvas=null,pixels=null,appearance=null,frame=0,installed=false;
let styleCache=new WeakMap();
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

function defaultWallpaper(){
  if(fallbackUrl)return fallbackUrl;
  const c=document.createElement("canvas");c.width=1080;c.height=1440;
  const x=c.getContext("2d",{alpha:false});if(!x)return"";
  const g=x.createLinearGradient(0,0,c.width,c.height);
  g.addColorStop(0,"#0d1428");g.addColorStop(.32,"#345f9c");g.addColorStop(.6,"#9bc7d3");g.addColorStop(.8,"#d69ba7");g.addColorStop(1,"#4b1c3c");
  x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  for(const [cx,cy,r,color] of [[170,220,500,"rgba(190,232,255,.62)"],[910,330,560,"rgba(103,83,219,.58)"],[650,1180,640,"rgba(255,105,128,.46)"]]){
    const q=x.createRadialGradient(cx,cy,0,cx,cy,r);q.addColorStop(0,color);q.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=q;x.fillRect(cx-r,cy-r,r*2,r*2)
  }
  x.save();x.globalAlpha=.22;x.translate(540,760);x.rotate(-.25);
  for(let i=0;i<4;i++){x.beginPath();x.ellipse(0,i*150-230,760-i*70,150-i*12,0,0,Math.PI*2);x.strokeStyle=i%2?"rgba(255,255,255,.54)":"rgba(10,20,44,.48)";x.lineWidth=64-i*8;x.stroke()}
  x.restore();
  try{fallbackUrl=c.toDataURL("image/webp",.8)}catch{fallbackUrl=c.toDataURL("image/jpeg",.84)}
  return fallbackUrl
}
export const getEffectiveWallpaper=url=>url||defaultWallpaper();

function load(url){return new Promise((resolve,reject)=>{const pic=new Image();if(/^https?:/i.test(url))pic.crossOrigin="anonymous";pic.onload=()=>resolve(pic);pic.onerror=reject;pic.src=url})}
async function prepare(url){
  image=canvas=pixels=null;
  try{
    const pic=await load(url),scale=Math.min(1,720/Math.max(pic.naturalWidth,pic.naturalHeight)),c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(pic.naturalWidth*scale));c.height=Math.max(1,Math.round(pic.naturalHeight*scale));
    const x=c.getContext("2d",{willReadFrequently:true});if(!x)return;
    x.drawImage(pic,0,0,c.width,c.height);image=pic;canvas=c;pixels=x.getImageData(0,0,c.width,c.height).data
  }catch{image=canvas=pixels=null}
}
function positionFactor(value){const [h="center",v="center"]=String(value||"center center").split(/\s+/);return{x:h==="left"?0:h==="right"?1:.5,y:v==="top"?0:v==="bottom"?1:.5}}
function mapPoint(x,y){
  if(!image||!canvas)return null;
  const vw=Math.max(1,innerWidth),vh=Math.max(1,innerHeight),scale=Math.max(vw/image.naturalWidth,vh/image.naturalHeight),rw=image.naturalWidth*scale,rh=image.naturalHeight*scale,p=positionFactor(appearance?.imagePosition),ox=(vw-rw)*p.x,oy=(vh-rh)*p.y;
  return{x:clamp(((x-ox)/scale)*(canvas.width/image.naturalWidth),0,canvas.width-1),y:clamp(((y-oy)/scale)*(canvas.height/image.naturalHeight),0,canvas.height-1)}
}
function readPatch(point){
  if(!pixels||!canvas||!point)return{...DEFAULT_COLOR};
  const radius=1,cx=Math.round(point.x),cy=Math.round(point.y);let r=0,g=0,b=0,count=0;
  for(let y=Math.max(0,cy-radius);y<=Math.min(canvas.height-1,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<=Math.min(canvas.width-1,cx+radius);x++){
    const index=(y*canvas.width+x)*4;r+=pixels[index];g+=pixels[index+1];b+=pixels[index+2];count++
  }
  if(!count)return{...DEFAULT_COLOR};
  const dim=clamp(Number(appearance?.wallpaperDim)||0,0,.34);
  return{r:Math.round((r/count)*(1-dim)+4*dim),g:Math.round((g/count)*(1-dim)+8*dim),b:Math.round((b/count)*(1-dim)+18*dim),a:1}
}
function parseColor(value){
  const match=String(value||"").match(/rgba?\(([^)]+)\)/i);if(!match)return null;
  const parts=match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);if(parts.length<3||parts.slice(0,3).some(Number.isNaN))return null;
  return{r:clamp(parts[0],0,255),g:clamp(parts[1],0,255),b:clamp(parts[2],0,255),a:clamp(Number.isFinite(parts[3])?parts[3]:1,0,1)}
}
function composite(over,under){const a=over.a+(under.a||1)*(1-over.a);if(a<=0)return{r:0,g:0,b:0,a:0};return{r:(over.r*over.a+under.r*(under.a||1)*(1-over.a))/a,g:(over.g*over.a+under.g*(under.a||1)*(1-over.a))/a,b:(over.b*over.a+under.b*(under.a||1)*(1-over.a))/a,a}}
function styleOf(element){let style=styleCache.get(element);if(!style){style=getComputedStyle(element);styleCache.set(element,style)}return style}
function ancestors(element){const list=[];for(let node=element?.parentElement;node;node=node.parentElement)list.push(node);return list.reverse()}
function linearChannel(value){value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}
function luminance({r,g,b}){return.2126*linearChannel(r)+.7152*linearChannel(g)+.0722*linearChannel(b)}
function mix(a,b,amount){return Math.round(a*(1-amount)+b*amount)}
function average(colors){if(!colors.length)return{...DEFAULT_COLOR};const sum=colors.reduce((a,c)=>({r:a.r+c.r,g:a.g+c.g,b:a.b+c.b}),{r:0,g:0,b:0});return{r:sum.r/colors.length,g:sum.g/colors.length,b:sum.b/colors.length,a:1}}
function surfaceTint(surface){
  if(!surface)return 0;
  if(surface.matches(".eva-menu-control,.eva-app-link")&&!surface.matches("[data-active='true'],.is-pressed"))return 0;
  if(surface.matches(".eva-bottom-link")&&!surface.matches(".is-active,[aria-current='page'],.is-pressed"))return 0;
  if(surface.matches("#evaMenuBtn,.eva-profile-trigger")&&surface.getAttribute("aria-expanded")!=="true")return 0;
  if(surface.matches(".eva-top-alert")&&surface.getAttribute("aria-expanded")!=="true")return 0;
  if(surface.matches(".eva-menu-panel"))return .32;
  return clamp(Number(appearance?.glassTint)||.46,.18,.76)
}
function applyGlass(base,surface){
  const tint=surfaceTint(surface);if(!tint)return base;
  const target=luminance(base)>.34?244:20,material=.34+tint*.42;
  const glass={r:mix(base.r,target,material),g:mix(base.g,target,material),b:mix(base.b,target,material),a:1};
  return{r:mix(base.r,glass.r,tint),g:mix(base.g,glass.g,tint),b:mix(base.b,glass.b,tint),a:1,glass}
}
function backgroundAt(element,x,y,includeSurface=true){
  let color=readPatch(mapPoint(x,y));
  const surface=element?.closest?.(SURFACE_SELECTOR)||null;
  for(const node of ancestors(element)){
    if(node===surface){if(includeSurface)color=applyGlass(color,surface);continue}
    const background=parseColor(styleOf(node).backgroundColor);if(background&&background.a>.015)color=composite(background,color)
  }
  return color
}
function chooseInk(color,prior=""){
  const l=luminance(color),black=(l+.05)/.05,white=1.05/(l+.05);
  if(prior){const current=prior==="d"?black:white,alternate=prior==="d"?white:black;if(alternate-current<1.2)return{tone:prior,color:prior==="d"?"rgb(18 20 24)":"rgb(255 255 255)",contrast:current}}
  const dark=black>=white;return{tone:dark?"d":"l",color:dark?"rgb(18 20 24)":"rgb(255 255 255)",contrast:Math.max(black,white)}
}
function applySurfaceTone(element){
  const rect=element.getBoundingClientRect(),samples=[];if(!rect.width||!rect.height)return;
  for(const [px,py] of SURFACE_POINTS)samples.push(backgroundAt(element,rect.left+rect.width*px,rect.top+rect.height*py,false));
  const base=average(samples),effective=applyGlass(base,element),ink=chooseInk(effective,element.dataset.evaraTone==="dark-ink"?"d":element.dataset.evaraTone==="light-ink"?"l":""),glass=effective.glass||base;
  element.dataset.evaraTone=ink.tone==="d"?"dark-ink":"light-ink";
  element.style.setProperty("--adaptive-ink-rgb",ink.tone==="d"?"18,20,24":"255,255,255");
  element.style.setProperty("--adaptive-shadow-rgb",ink.tone==="d"?"255,255,255":"0,0,0");
  element.style.setProperty("--adaptive-glass-rgb",`${Math.round(glass.r)},${Math.round(glass.g)},${Math.round(glass.b)}`);
  element.style.setProperty("--adaptive-ambient-rgb",`${Math.round(base.r)},${Math.round(base.g)},${Math.round(base.b)}`);
  element.style.setProperty("--adaptive-luma",luminance(effective).toFixed(3));element.style.setProperty("--adaptive-contrast",ink.contrast.toFixed(2))
}
function applyTextGradient(wrapper){
  if(!(wrapper instanceof HTMLElement)||wrapper.hidden)return;
  const rect=wrapper.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom<-120||rect.top>innerHeight+120)return;
  const prior=(wrapper.dataset.evaraTextTones||"").padEnd(TEXT_X.length,"-").slice(0,TEXT_X.length),tones=[],colors=[];
  TEXT_X.forEach((factor,index)=>{const samples=TEXT_Y.map(y=>backgroundAt(wrapper,rect.left+rect.width*factor,rect.top+rect.height*y,true)),ink=chooseInk(average(samples),prior[index]);tones.push(ink.tone);colors.push(ink.color)});
  const key=tones.join("");if(wrapper.dataset.evaraTextTones===key)return;
  wrapper.dataset.evaraTextTones=key;colors.forEach((color,index)=>wrapper.style.setProperty(`--adaptive-text-c${index}`,color))
}
function adapt(){
  frame=0;styleCache=new WeakMap();
  for(const element of document.querySelectorAll(SURFACE_SELECTOR)){
    if(!(element instanceof HTMLElement)||element.hidden)continue;const rect=element.getBoundingClientRect();if(rect.bottom<-140||rect.top>innerHeight+140)continue;applySurfaceTone(element)
  }
  document.querySelectorAll(".evara-adaptive-text-node").forEach(applyTextGradient)
}
export function refreshAdaptiveGlass(){if(!frame)frame=requestAnimationFrame(adapt)}
function install(){
  if(installed)return;installed=true;
  new MutationObserver(refreshAdaptiveGlass).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","hidden","aria-current","aria-expanded","data-active"]});
  addEventListener("scroll",refreshAdaptiveGlass,{passive:true});addEventListener("resize",refreshAdaptiveGlass,{passive:true});addEventListener("orientationchange",refreshAdaptiveGlass,{passive:true});
  if("PointerEvent"in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){let pointerFrame=0,pending=null;document.addEventListener("pointermove",event=>{if(event.pointerType&&event.pointerType!=="mouse"&&event.pointerType!=="pen")return;const target=event.target.closest?.(SURFACE_SELECTOR);if(!target)return;pending={target,x:event.clientX,y:event.clientY};if(pointerFrame)return;pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;if(!pending?.target?.isConnected)return;const rect=pending.target.getBoundingClientRect();pending.target.style.setProperty("--glass-x",`${clamp(((pending.x-rect.left)/Math.max(1,rect.width))*100,0,100).toFixed(1)}%`);pending.target.style.setProperty("--glass-y",`${clamp(((pending.y-rect.top)/Math.max(1,rect.height))*100,0,100).toFixed(1)}%`)})},{passive:true})}
}
export async function initAdaptiveGlass(nextAppearance,url){appearance=nextAppearance;if(url!==image?.src)await prepare(url);install();refreshAdaptiveGlass()}
