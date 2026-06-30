const ADAPTIVE_SELECTOR=[
  ".glass-card",".glass-shell",".liquid-glass",".aurora-card",
  ".dashboard-sidebar-inner",".dashboard-panel",".dashboard-overview",".dashboard-hero",".dashboard-hero-panel",
  ".dashboard-stat-card",".dashboard-list-item",".dashboard-feed-item",".dashboard-role-card",".dashboard-progress-row",".dashboard-state-card",
  ".settings-card",".settings-block",".settings-hub-card",".workspace-block",".qa-card",".application-card",".customer-service-event",
  ".eva-menu-panel",".eva-menu-glass-group",".eva-menu-control",".eva-app-link",".eva-bottom-nav",".eva-bottom-link",
  ".btn",".settings-chip",".role-pill",".role-pill-option",".messages-icon-button",".messages-camera",".messages-send",".messages-compose",
  ".eva-account-action",".eva-profile-trigger","#evaMenuBtn",".eva-top-alert","button:not(.appearance-source-backdrop)","input","textarea","select","[data-glass]"
].join(",");
const SURFACE_POINTS=[[.18,.18],[.5,.16],[.82,.18],[.18,.5],[.5,.5],[.82,.5],[.18,.82],[.5,.84],[.82,.82]];
const TEXT_X=[.04,.27,.5,.73,.96];
const TEXT_Y=[.3,.5,.7];
let fallbackUrl="",image=null,canvas=null,pixels=null,appearance=null,frame=0,installed=false;
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
    x.drawImage(pic,0,0,c.width,c.height);
    image=pic;canvas=c;pixels=x.getImageData(0,0,c.width,c.height).data
  }catch{image=canvas=pixels=null}
}
function positionFactor(value){const [h="center",v="center"]=String(value||"center center").split(/\s+/);return{x:h==="left"?0:h==="right"?1:.5,y:v==="top"?0:v==="bottom"?1:.5}}
function mapPoint(x,y){
  if(!image||!canvas)return null;
  const vw=Math.max(1,innerWidth),vh=Math.max(1,innerHeight),scale=Math.max(vw/image.naturalWidth,vh/image.naturalHeight),rw=image.naturalWidth*scale,rh=image.naturalHeight*scale,p=positionFactor(appearance?.imagePosition),ox=(vw-rw)*p.x,oy=(vh-rh)*p.y;
  return{x:clamp(((x-ox)/scale)*(canvas.width/image.naturalWidth),0,canvas.width-1),y:clamp(((y-oy)/scale)*(canvas.height/image.naturalHeight),0,canvas.height-1)}
}
function linearChannel(value){value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}
function luminance({r,g,b}){return.2126*linearChannel(r)+.7152*linearChannel(g)+.0722*linearChannel(b)}
function readPatch(point){
  if(!pixels||!canvas||!point)return null;
  const radius=1,cx=Math.round(point.x),cy=Math.round(point.y);let r=0,g=0,b=0,count=0;
  for(let y=Math.max(0,cy-radius);y<=Math.min(canvas.height-1,cy+radius);y++){
    for(let x=Math.max(0,cx-radius);x<=Math.min(canvas.width-1,cx+radius);x++){
      const index=(y*canvas.width+x)*4;r+=pixels[index];g+=pixels[index+1];b+=pixels[index+2];count++
    }
  }
  if(!count)return null;
  const dim=clamp(Number(appearance?.wallpaperDim)||0,0,.34);
  return{r:Math.round((r/count)*(1-dim)+4*dim),g:Math.round((g/count)*(1-dim)+8*dim),b:Math.round((b/count)*(1-dim)+18*dim)}
}
function averageColors(colors){
  if(!colors.length)return{r:38,g:48,b:68};
  const sum=colors.reduce((acc,color)=>({r:acc.r+color.r,g:acc.g+color.g,b:acc.b+color.b}),{r:0,g:0,b:0});
  return{r:Math.round(sum.r/colors.length),g:Math.round(sum.g/colors.length),b:Math.round(sum.b/colors.length)}
}
function mix(a,b,amount){return Math.round(a*(1-amount)+b*amount)}
function surfaceTint(surface){
  if(!surface)return 0;
  if(surface.matches(".eva-menu-control,.eva-app-link")&&!surface.matches("[data-active='true'],.is-pressed"))return 0;
  if(surface.matches(".eva-bottom-link")&&!surface.matches(".is-active,[aria-current='page'],.is-pressed"))return 0;
  if(surface.matches("#evaMenuBtn,.eva-profile-trigger")&&!document.body.classList.contains("nav-menu-open"))return 0;
  if(surface.matches(".eva-top-alert")&&surface.getAttribute("aria-expanded")!=="true")return 0;
  if(surface.matches(".eva-menu-panel"))return .32;
  return clamp(Number(appearance?.glassTint)||.46,.18,.76)
}
function effectiveColor(sampleColor,surface){
  const tint=surfaceTint(surface);if(!tint)return sampleColor;
  const sampleLuma=luminance(sampleColor),target=sampleLuma>.34?244:20,materialAmount=.34+tint*.42;
  const glass={r:mix(sampleColor.r,target,materialAmount),g:mix(sampleColor.g,target,materialAmount),b:mix(sampleColor.b,target,materialAmount)};
  return{r:mix(sampleColor.r,glass.r,tint),g:mix(sampleColor.g,glass.g,tint),b:mix(sampleColor.b,glass.b,tint),glass}
}
function chooseInk(color,prior=""){
  const luma=luminance(color),black=(luma+.05)/.05,white=1.05/(luma+.05),difference=Math.abs(black-white);
  let dark=black>white;if(difference<1.05&&prior)dark=prior==="d";
  return{tone:dark?"d":"l",color:dark?"rgb(18 20 24)":"rgb(255 255 255)",contrast:Math.max(black,white)}
}
function sampleSurface(element){
  if(!pixels||!canvas)return{r:38,g:48,b:68};
  const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return{r:38,g:48,b:68};
  const colors=[];
  for(const [px,py] of SURFACE_POINTS){const color=readPatch(mapPoint(rect.left+rect.width*px,rect.top+rect.height*py));if(color)colors.push(color)}
  return averageColors(colors)
}
function applySurfaceTone(element){
  const sampleColor=sampleSurface(element),effective=effectiveColor(sampleColor,element),ink=chooseInk(effective,element.dataset.evaraTone==="dark-ink"?"d":element.dataset.evaraTone==="light-ink"?"l":""),glass=effective.glass||sampleColor;
  element.dataset.evaraTone=ink.tone==="d"?"dark-ink":"light-ink";
  element.style.setProperty("--adaptive-ink-rgb",ink.tone==="d"?"18,20,24":"255,255,255");
  element.style.setProperty("--adaptive-shadow-rgb",ink.tone==="d"?"255,255,255":"0,0,0");
  element.style.setProperty("--adaptive-glass-rgb",`${glass.r},${glass.g},${glass.b}`);
  element.style.setProperty("--adaptive-ambient-rgb",`${sampleColor.r},${sampleColor.g},${sampleColor.b}`);
  element.style.setProperty("--adaptive-luma",luminance(effective).toFixed(3));
  element.style.setProperty("--adaptive-contrast",ink.contrast.toFixed(2))
}
function textStopColor(wrapper,xFactor,surface,prior){
  const rect=wrapper.getBoundingClientRect(),colors=[];
  for(const yFactor of TEXT_Y){const color=readPatch(mapPoint(rect.left+rect.width*xFactor,rect.top+rect.height*yFactor));if(color)colors.push(color)}
  return chooseInk(effectiveColor(averageColors(colors),surface),prior)
}
function applyTextGradient(wrapper){
  if(!(wrapper instanceof HTMLElement)||wrapper.hidden)return;
  const rect=wrapper.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom<-100||rect.top>innerHeight+100)return;
  const surface=wrapper.closest(ADAPTIVE_SELECTOR),prior=(wrapper.dataset.evaraTextTones||"").padEnd(TEXT_X.length,"-").slice(0,TEXT_X.length),stops=[],tones=[];
  TEXT_X.forEach((x,index)=>{const ink=textStopColor(wrapper,x,surface,prior[index]);tones.push(ink.tone);stops.push(`${ink.color} ${Math.round(x*100)}%`)});
  const toneKey=tones.join("");if(wrapper.dataset.evaraTextTones===toneKey)return;
  wrapper.dataset.evaraTextTones=toneKey;
  wrapper.style.setProperty("--adaptive-text-gradient",`linear-gradient(90deg,${stops.join(",")})`)
}
function adapt(){
  frame=0;
  for(const element of document.querySelectorAll(ADAPTIVE_SELECTOR)){
    if(!(element instanceof HTMLElement)||element.hidden)continue;
    const rect=element.getBoundingClientRect();if(rect.bottom<-120||rect.top>innerHeight+120)continue;
    applySurfaceTone(element)
  }
  applySurfaceTone(document.documentElement);
  document.querySelectorAll(".evara-adaptive-text-node").forEach(applyTextGradient)
}
export function refreshAdaptiveGlass(){if(!frame)frame=requestAnimationFrame(adapt)}
function install(){
  if(installed)return;installed=true;
  new MutationObserver(refreshAdaptiveGlass).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","hidden","aria-current","aria-expanded","data-active"]});
  addEventListener("scroll",refreshAdaptiveGlass,{passive:true});addEventListener("resize",refreshAdaptiveGlass,{passive:true});addEventListener("orientationchange",refreshAdaptiveGlass,{passive:true});
  if("PointerEvent"in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
    let pointerFrame=0,pending=null;
    document.addEventListener("pointermove",event=>{
      if(event.pointerType&&event.pointerType!=="mouse"&&event.pointerType!=="pen")return;
      const target=event.target.closest?.(ADAPTIVE_SELECTOR);if(!target)return;
      pending={target,x:event.clientX,y:event.clientY};if(pointerFrame)return;
      pointerFrame=requestAnimationFrame(()=>{
        pointerFrame=0;if(!pending?.target?.isConnected)return;
        const rect=pending.target.getBoundingClientRect();
        pending.target.style.setProperty("--glass-x",`${clamp(((pending.x-rect.left)/Math.max(1,rect.width))*100,0,100).toFixed(1)}%`);
        pending.target.style.setProperty("--glass-y",`${clamp(((pending.y-rect.top)/Math.max(1,rect.height))*100,0,100).toFixed(1)}%`)
      })
    },{passive:true})
  }
}
export async function initAdaptiveGlass(nextAppearance,url){appearance=nextAppearance;if(url!==image?.src)await prepare(url);install();refreshAdaptiveGlass()}
