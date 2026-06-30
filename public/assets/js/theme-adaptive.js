const ADAPTIVE_SELECTOR=[
  ".glass-card",".glass-shell",".liquid-glass",".aurora-card",
  ".dashboard-sidebar-inner",".dashboard-panel",".dashboard-overview",".dashboard-hero",".dashboard-hero-panel",
  ".dashboard-stat-card",".dashboard-list-item",".dashboard-feed-item",".dashboard-role-card",".dashboard-progress-row",".dashboard-state-card",
  ".settings-card",".settings-block",".settings-hub-card",".workspace-block",".qa-card",".application-card",".customer-service-event",
  ".eva-menu-panel",".eva-menu-card",".eva-bottom-nav",".btn",".settings-chip",".role-pill",".role-pill-option",
  ".messages-icon-button",".messages-camera",".messages-send",".messages-compose",".eva-account-action",".eva-profile-trigger",
  "#evaMenuBtn",".eva-top-alert",".eva-bottom-link","button:not(.appearance-source-backdrop)","[data-glass]"
].join(",");
const POINTS=[[.22,.22],[.78,.22],[.5,.5],[.22,.78],[.78,.78]];
let fallbackUrl="",image=null,canvas=null,context=null,appearance=null,frame=0,installed=false;

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
  image=canvas=context=null;
  try{
    const pic=await load(url),scale=Math.min(1,720/Math.max(pic.naturalWidth,pic.naturalHeight)),c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(pic.naturalWidth*scale));c.height=Math.max(1,Math.round(pic.naturalHeight*scale));
    const x=c.getContext("2d",{willReadFrequently:true});if(!x)return;x.drawImage(pic,0,0,c.width,c.height);image=pic;canvas=c;context=x
  }catch{}
}
function positionFactor(value){const [h="center",v="center"]=String(value||"center center").split(/\s+/);return{x:h==="left"?0:h==="right"?1:.5,y:v==="top"?0:v==="bottom"?1:.5}}
function mapPoint(x,y){
  if(!image||!canvas)return null;
  const vw=Math.max(1,innerWidth),vh=Math.max(1,innerHeight),scale=Math.max(vw/image.naturalWidth,vh/image.naturalHeight),rw=image.naturalWidth*scale,rh=image.naturalHeight*scale,p=positionFactor(appearance?.imagePosition),ox=(vw-rw)*p.x,oy=(vh-rh)*p.y;
  return{x:Math.max(0,Math.min(canvas.width-1,((x-ox)/scale)*(canvas.width/image.naturalWidth))),y:Math.max(0,Math.min(canvas.height-1,((y-oy)/scale)*(canvas.height/image.naturalHeight)))}
}
function luminance(r,g,b){const f=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};return.2126*f(r)+.7152*f(g)+.0722*f(b)}
function sample(element){
  if(!context||!canvas)return.25;
  const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return.25;
  let total=0,count=0;
  for(const [px,py] of POINTS){
    const point=mapPoint(rect.left+rect.width*px,rect.top+rect.height*py);if(!point)continue;
    try{const d=context.getImageData(Math.round(point.x),Math.round(point.y),1,1).data;total+=luminance(d[0],d[1],d[2]);count++}catch{return.25}
  }
  return count?total/count:.25
}
function tone(element,luma){
  const bright=appearance?.adaptiveContrast!==false&&luma>.42;
  element.dataset.evaraTone=bright?"dark-ink":"light-ink";
  element.style.setProperty("--adaptive-ink-rgb",bright?"18,20,24":"255,255,255");
  element.style.setProperty("--adaptive-shadow-rgb",bright?"255,255,255":"0,0,0");
  element.style.setProperty("--adaptive-luma",luma.toFixed(3));
  element.style.setProperty("--adaptive-tint-bias",String(luma>.7?.11:bright?.07:.03))
}
function adapt(){
  frame=0;
  for(const el of document.querySelectorAll(ADAPTIVE_SELECTOR)){
    if(!(el instanceof HTMLElement)||el.hidden)continue;
    const r=el.getBoundingClientRect();if(r.bottom<-100||r.top>innerHeight+100)continue;
    tone(el,sample(el))
  }
  tone(document.documentElement,sample(document.documentElement))
}
export function refreshAdaptiveGlass(){if(!frame)frame=requestAnimationFrame(adapt)}
function install(){
  if(installed)return;installed=true;
  new MutationObserver(refreshAdaptiveGlass).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","hidden"]});
  addEventListener("scroll",refreshAdaptiveGlass,{passive:true});addEventListener("resize",refreshAdaptiveGlass,{passive:true});addEventListener("orientationchange",refreshAdaptiveGlass,{passive:true});
  if("PointerEvent"in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
    let pointerFrame=0,pending=null;
    document.addEventListener("pointermove",event=>{
      if(event.pointerType&&event.pointerType!=="mouse"&&event.pointerType!=="pen")return;
      const target=event.target.closest?.(ADAPTIVE_SELECTOR);if(!target)return;
      pending={target,x:event.clientX,y:event.clientY};if(pointerFrame)return;
      pointerFrame=requestAnimationFrame(()=>{
        pointerFrame=0;if(!pending?.target?.isConnected)return;
        const r=pending.target.getBoundingClientRect();
        pending.target.style.setProperty("--glass-x",`${Math.max(0,Math.min(100,((pending.x-r.left)/r.width)*100)).toFixed(1)}%`);
        pending.target.style.setProperty("--glass-y",`${Math.max(0,Math.min(100,((pending.y-r.top)/r.height)*100)).toFixed(1)}%`)
      })
    },{passive:true})
  }
}
export async function initAdaptiveGlass(nextAppearance,url){appearance=nextAppearance;if(url!==image?.src)await prepare(url);install();refreshAdaptiveGlass()}
