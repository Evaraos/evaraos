const SURFACE_SELECTOR=[
  ".glass-card",".glass-shell",".liquid-glass",".aurora-card",
  ".dashboard-sidebar-inner",".dashboard-panel",".dashboard-overview",".dashboard-hero",".dashboard-hero-panel",
  ".dashboard-stat-card",".dashboard-list-item",".dashboard-feed-item",".dashboard-role-card",".dashboard-progress-row",".dashboard-state-card",
  ".settings-card",".settings-block",".settings-hub-card",".workspace-block",".qa-card",".application-card",".customer-service-event",
  ".eva-menu-glass-group",".btn",".settings-chip",".role-pill",".role-pill-option",
  ".messages-icon-button",".messages-camera",".messages-send",".messages-compose",".eva-account-action","[data-glass]:not(.eva-menu-panel)"
].join(",");

const states=new WeakMap();
let active=null;
let frame=0;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const lerp=(from,to,amount)=>from+(to-from)*amount;

function stateFor(element){
  let state=states.get(element);
  if(!state){
    state={x:28,y:12,targetX:28,targetY:12,energy:0,targetEnergy:0,press:0,targetPress:0};
    states.set(element,state);
  }
  return state;
}

function write(element,state){
  element.style.setProperty("--lg-light-x",`${state.x.toFixed(2)}%`);
  element.style.setProperty("--lg-light-y",`${state.y.toFixed(2)}%`);
  element.style.setProperty("--lg-glow-alpha",(0.13+state.energy*0.16).toFixed(3));
  element.style.setProperty("--lg-control-glow-alpha",(0.17+state.energy*0.20).toFixed(3));
  element.style.setProperty("--lg-shadow-y",`${(16+state.energy*4).toFixed(2)}px`);
  element.style.setProperty("--lg-shadow-blur",`${(48+state.energy*10).toFixed(2)}px`);
  element.style.setProperty("--lg-control-shadow-y",`${(8+state.energy*2).toFixed(2)}px`);
  element.style.setProperty("--lg-control-shadow-blur",`${(22+state.energy*6).toFixed(2)}px`);
  element.style.setProperty("--lg-card-scale",(1-state.press*0.004).toFixed(4));
  element.style.setProperty("--lg-control-scale",(1-state.press*0.012).toFixed(4));
}

function render(){
  frame=0;
  if(!active?.isConnected)return;
  const state=stateFor(active);
  state.x=lerp(state.x,state.targetX,.12);
  state.y=lerp(state.y,state.targetY,.12);
  state.energy=lerp(state.energy,state.targetEnergy,.16);
  state.press=lerp(state.press,state.targetPress,.18);
  write(active,state);
  if(Math.abs(state.x-state.targetX)>.08||Math.abs(state.y-state.targetY)>.08||Math.abs(state.energy-state.targetEnergy)>.01||Math.abs(state.press-state.targetPress)>.01)frame=requestAnimationFrame(render);
}

function schedule(){if(!frame)frame=requestAnimationFrame(render)}
function activate(element){
  if(active&&active!==element){const old=stateFor(active);old.targetEnergy=0;old.targetPress=0;active.classList.remove("is-liquid-energized");write(active,old)}
  active=element;
  if(!active)return;
  active.classList.add("is-liquid-energized");
  stateFor(active).targetEnergy=.72;
  schedule();
}
function deactivate(element){
  if(!element)return;
  const state=stateFor(element);state.targetEnergy=0;state.targetPress=0;element.classList.remove("is-liquid-energized");
  if(active===element)schedule();
}

export function installLiquidInteraction(){
  if(window.__evaraLiquidInteractionInstalled)return;
  window.__evaraLiquidInteractionInstalled=true;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;

  document.addEventListener("pointerover",event=>{
    if(event.pointerType&&event.pointerType!=="mouse"&&event.pointerType!=="pen")return;
    const element=event.target.closest?.(SURFACE_SELECTOR);if(!element)return;activate(element);
  },{passive:true});

  document.addEventListener("pointermove",event=>{
    if(event.pointerType&&event.pointerType!=="mouse"&&event.pointerType!=="pen")return;
    const element=event.target.closest?.(SURFACE_SELECTOR);if(!element)return;
    if(active!==element)activate(element);
    const rect=element.getBoundingClientRect(),state=stateFor(element);
    const rawX=((event.clientX-rect.left)/Math.max(1,rect.width))*100;
    const rawY=((event.clientY-rect.top)/Math.max(1,rect.height))*100;
    state.targetX=clamp(28+(rawX-50)*.26,14,68);
    state.targetY=clamp(12+(rawY-50)*.14,5,34);
    state.targetEnergy=.72;
    schedule();
  },{passive:true});

  document.addEventListener("pointerout",event=>{
    const from=event.target.closest?.(SURFACE_SELECTOR);if(!from)return;
    const to=event.relatedTarget?.closest?.(SURFACE_SELECTOR);if(to===from)return;
    deactivate(from);
    if(to)activate(to);
  },{passive:true});

  document.addEventListener("pointerdown",event=>{
    const element=event.target.closest?.(SURFACE_SELECTOR);if(!element)return;activate(element);const state=stateFor(element);state.targetEnergy=1;state.targetPress=1;schedule();
  },{passive:true});

  const release=()=>{if(!active)return;const state=stateFor(active);state.targetPress=0;state.targetEnergy=.72;schedule()};
  document.addEventListener("pointerup",release,{passive:true});
  document.addEventListener("pointercancel",release,{passive:true});
}

if(typeof window!=="undefined")installLiquidInteraction();
