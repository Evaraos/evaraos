const NAV_BUILD="nav-v58-critical-shell";
let NAV_STATE,getNavShell,renderNav,applyProgress,bindScrollBehavior,animateNav;
let accountSystemsPromise=null;

async function loadCore(){
  const [config,utils,renderer]=await Promise.all([
    import(`./nav-config.js?v=${NAV_BUILD}`),
    import(`./nav-utils.js?v=${NAV_BUILD}`),
    import(`./nav-render.js?v=${NAV_BUILD}`)
  ]);
  NAV_STATE=config.NAV_STATE;
  getNavShell=utils.getNavShell;
  renderNav=renderer.renderNav;
}

async function optional(path){
  try{return await import(`${path}?v=${NAV_BUILD}`)}
  catch(error){console.warn("Optional nav module failed:",path,error);return null}
}

async function loadMotionSystems(){
  const scroll=await optional("./nav-scroll.js");
  if(!scroll)return;
  applyProgress=scroll.applyProgress;
  bindScrollBehavior=scroll.bindScrollBehavior;
  animateNav=scroll.animateNav;
}

function isPublicHome(){
  const mode=document.body?.dataset?.routeGuard||"";
  const path=location.pathname.toLowerCase();
  return mode==="public"&&(path==="/"||path.endsWith("/index.html"));
}

function ready(){
  requestAnimationFrame(()=>{
    document.documentElement.dataset.evaraosNavReady="true";
    window.EvaraLoader?.markNavReady?.();
    window.dispatchEvent(new CustomEvent("evara:nav-ready",{detail:{build:NAV_BUILD,at:Date.now()}}));
    if(!window.EvaraLoader){
      const mode=document.body?.dataset?.routeGuard||"";
      if(mode!=="private"&&mode!=="auth"){
        document.body?.classList.remove("app-loading");
        document.body?.classList.add("app-ready");
      }
    }
  });
}

function keepVisible(){
  [document.getElementById("evaNavShell"),document.getElementById("evaMenuBtn"),document.getElementById("globalNotificationsBell")].filter(Boolean).forEach(node=>{
    node.style.visibility="visible";
    node.style.opacity="1";
    node.style.pointerEvents=node.id==="evaNavShell"?"none":"auto";
  });
}

async function bindCoreSystems(){
  const [menu,events,session,interactions]=await Promise.all([
    optional("./nav-menu.js"),
    optional("./nav-events.js"),
    optional("./nav-session.js"),
    optional("./nav-interactions.js")
  ]);
  try{events?.bindAllNavEvents?.()}catch(error){console.warn("Nav events binding failed:",error)}
  try{menu?.bindMenu?.()}catch(error){console.warn("Menu binding failed:",error)}
  try{interactions?.bindNavInteractions?.()}catch(error){console.warn("Nav interactions failed:",error)}
  try{session?.bindRuntimeRefresh?.()}catch(error){console.warn("Nav session refresh failed:",error)}
  try{window.EvaraBrand?.apply?.();window.EvaraTheme?.updateThemeControls?.();window.EvaraTheme?.refreshAdaptiveGlass?.()}catch(error){console.warn("Nav theme refresh failed:",error)}
}

function bindAccountSystems(){
  if(accountSystemsPromise)return accountSystemsPromise;
  accountSystemsPromise=Promise.all([
    optional("./nav-logout.js"),
    optional("../notifications-dropdown.js")
  ]).then(([logout,notifications])=>{
    try{logout?.bindLogout?.()}catch(error){console.warn("Logout binding failed:",error)}
    try{notifications?.startNotificationsDropdown?.()}catch(error){console.warn("Notifications dropdown failed:",error)}
  });
  return accountSystemsPromise;
}

function scheduleAccountSystems(){
  if(!isPublicHome()){
    bindAccountSystems().catch(error=>console.warn("Account nav systems failed:",error));
    return;
  }
  const load=()=>bindAccountSystems().catch(error=>console.warn("Deferred account nav systems failed:",error));
  if("requestIdleCallback" in window)requestIdleCallback(load,{timeout:2400});
  else setTimeout(load,1200);
}

async function bindSystems(){
  await loadMotionSystems();
  try{applyProgress?.()}catch(error){console.warn("Nav progress binding failed:",error)}
  try{animateNav?.()}catch(error){console.warn("Nav animation failed:",error)}
  try{bindScrollBehavior?.()}catch(error){console.warn("Nav scroll binding failed:",error)}
  await bindCoreSystems();
  scheduleAccountSystems();
}

export async function initNav(){
  try{
    await loadCore();
    window.EVARAOS_NAV_BUILD=NAV_BUILD;
    document.documentElement.dataset.evaraosNavBuild=NAV_BUILD;
    if(NAV_STATE.hasInitialized){keepVisible();ready();return}
    NAV_STATE.hasInitialized=true;
    if(!renderNav()){ready();return}
    const shell=getNavShell();
    if(shell)shell.dataset.navBuild=NAV_BUILD;
    keepVisible();
    setTimeout(keepVisible,600);
    ready();
    bindSystems().catch(error=>console.warn("Deferred nav systems failed:",error));
  }catch(error){
    console.error("Evaraos nav failed to boot:",error);
    ready();
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initNav,{once:true});else initNav();
