const NAV_BUILD="nav-v31-phone-push";
let NAV_STATE,getNavShell,renderNav,applyProgress,bindScrollBehavior,animateNav;

async function loadCore(){
  const config=await import(`./nav-config.js?v=${NAV_BUILD}`);
  const utils=await import(`./nav-utils.js?v=${NAV_BUILD}`);
  const renderer=await import(`./nav-render.js?v=${NAV_BUILD}`);
  const scroll=await import(`./nav-scroll.js?v=${NAV_BUILD}`);
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
    else{
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}

async function bindSystems(){
  const menu=await optional("./nav-menu.js");
  const events=await optional("./nav-events.js");
  const logout=await optional("./nav-logout.js");
  const session=await optional("./nav-session.js");
  const interactions=await optional("./nav-interactions.js");
  try{events?.bindAllNavEvents?.()}catch{}
  try{logout?.bindLogout?.()}catch(error){console.warn("Logout binding failed:",error)}
  try{menu?.bindMenu?.()}catch{}
  try{interactions?.bindNavInteractions?.()}catch{}
  try{bindScrollBehavior?.()}catch{}
  try{session?.bindRuntimeRefresh?.()}catch{}
  try{
    window.EvaraTheme?.updateThemeControls?.();
    window.EvaraTheme?.refreshAdaptiveGlass?.();
  }catch{}
  const notifications=await optional("../notifications-dropdown.js");
  try{notifications?.startNotificationsDropdown?.()}catch(error){console.warn("Notifications dropdown failed:",error)}
}

export async function initNav(){
  try{
    await loadCore();
    if(NAV_STATE.hasInitialized)return;
    NAV_STATE.hasInitialized=true;
    window.EVARAOS_NAV_BUILD=NAV_BUILD;
    document.documentElement.dataset.evaraosNavBuild=NAV_BUILD;
    if(!renderNav()){ready();return}
    const shell=getNavShell();
    if(shell)shell.dataset.navBuild=NAV_BUILD;
    await bindSystems();
    applyProgress?.();
    animateNav?.();
    ready();
  }catch(error){
    console.error("Evaraos nav failed to boot:",error);
    ready();
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initNav,{once:true});
else initNav();
