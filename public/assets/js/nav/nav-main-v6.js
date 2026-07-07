const NAV_BUILD="nav-v39-role-visibility";
let NAV_STATE,getNavShell,renderNav,applyProgress,bindScrollBehavior,animateNav;

async function loadCore(){
  const [config,utils,renderer,scroll]=await Promise.all([
    import(`./nav-config.js?v=${NAV_BUILD}`),
    import(`./nav-utils.js?v=${NAV_BUILD}`),
    import(`./nav-render.js?v=${NAV_BUILD}`),
    import(`./nav-scroll.js?v=${NAV_BUILD}`)
  ]);
  NAV_STATE=config.NAV_STATE;
  getNavShell=utils.getNavShell;
  renderNav=renderer.renderNav;
  applyProgress=scroll.applyProgress;
  bindScrollBehavior=scroll.bindScrollBehavior;
  animateNav=scroll.animateNav;
}

async function optional(path){
  try{return await import(`${path}?v=${NAV_BUILD}`)}
  catch(error){console.warn("Optional nav module failed:",path,error);return null}
}

function ready(){
  requestAnimationFrame(()=>{
    if(window.EvaraLoader?.markAppReady)window.EvaraLoader.markAppReady();
    else{document.body.classList.remove("app-loading");document.body.classList.add("app-ready")}
    document.documentElement.dataset.evaraosNavReady="true";
  });
}

function keepVisible(){
  [document.getElementById("evaNavShell"),document.getElementById("evaMenuBtn"),document.getElementById("globalNotificationsBell")].filter(Boolean).forEach(node=>{
    node.style.visibility="visible";
    node.style.opacity="1";
    node.style.pointerEvents=node.id==="evaNavShell"?"none":"auto";
  });
}

async function bindSystems(){
  const [menu,events,logout,session,interactions,notifications]=await Promise.all([
    optional("./nav-menu.js"),
    optional("./nav-events.js"),
    optional("./nav-logout.js"),
    optional("./nav-session.js"),
    optional("./nav-interactions.js"),
    optional("../notifications-dropdown.js")
  ]);
  try{events?.bindAllNavEvents?.()}catch(error){console.warn("Nav events binding failed:",error)}
  try{logout?.bindLogout?.()}catch(error){console.warn("Logout binding failed:",error)}
  try{menu?.bindMenu?.()}catch(error){console.warn("Menu binding failed:",error)}
  try{interactions?.bindNavInteractions?.()}catch(error){console.warn("Nav interactions failed:",error)}
  try{bindScrollBehavior?.()}catch(error){console.warn("Nav scroll binding failed:",error)}
  try{session?.bindRuntimeRefresh?.()}catch(error){console.warn("Nav session refresh failed:",error)}
  try{notifications?.startNotificationsDropdown?.()}catch(error){console.warn("Notifications dropdown failed:",error)}
  try{window.EvaraBrand?.apply?.();window.EvaraTheme?.updateThemeControls?.();window.EvaraTheme?.refreshAdaptiveGlass?.()}catch(error){console.warn("Nav theme refresh failed:",error)}
}

export async function initNav(){
  try{
    await loadCore();
    if(NAV_STATE.hasInitialized){keepVisible();ready();return}
    NAV_STATE.hasInitialized=true;
    window.EVARAOS_NAV_BUILD=NAV_BUILD;
    document.documentElement.dataset.evaraosNavBuild=NAV_BUILD;
    if(!renderNav()){ready();return}
    const shell=getNavShell();
    if(shell)shell.dataset.navBuild=NAV_BUILD;
    await bindSystems();
    applyProgress?.();
    animateNav?.();
    keepVisible();
    setTimeout(keepVisible,600);
    ready();
  }catch(error){
    console.error("Evaraos nav failed to boot:",error);
    ready();
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initNav,{once:true});else initNav();