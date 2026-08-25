const NAV_BUILD="nav-v60-shell-recovery";
const PUBLIC_HOME_SHELL_STYLESHEET="/assets/css/nav/nav-shell.css?v=home-1";
let NAV_STATE,getNavShell,renderNav,applyProgress,bindScrollBehavior,animateNav,isCanonicalPublicRoute,isVerifiedSession;
let accountSystemsPromise=null;
let sessionLifecycleBound=false;
let publicMenu=null;

async function loadCore(){
  const [config,utils,renderer]=await Promise.all([
    import(`./nav-config.js?v=${NAV_BUILD}`),
    import(`./nav-utils.js?v=${NAV_BUILD}`),
    import(`./nav-render.js?v=${NAV_BUILD}`)
  ]);
  NAV_STATE=config.NAV_STATE;
  getNavShell=utils.getNavShell;
  isCanonicalPublicRoute=utils.isCanonicalPublicRoute;
  isVerifiedSession=utils.isVerifiedSession;
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

function ensurePublicHomeShellStyles(){
  const existing=document.getElementById("evaPublicHomeShellStyles");
  if(existing)return Promise.resolve(existing);
  return new Promise(resolve=>{
    const link=document.createElement("link");
    link.id="evaPublicHomeShellStyles";
    link.rel="stylesheet";
    link.href=PUBLIC_HOME_SHELL_STYLESHEET;
    link.addEventListener("load",()=>resolve(link),{once:true});
    link.addEventListener("error",()=>resolve(link),{once:true});
    document.head.appendChild(link);
  });
}

function ready(){
  requestAnimationFrame(()=>{
    document.documentElement.dataset.evaraosNavReady="true";
    window.EvaraLoader?.markNavReady?.();
    revealPublicHomeShell();
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

function isCanonicalPublicPage(){
  return isCanonicalPublicRoute?.()===true;
}

function revealPublicHomeShell(){
  if(!isPublicHome())return;
  // Home may render its universal shell before Firebase finishes enriching an
  // optional session. Its presentation is public, so it must not inherit a
  // lingering auth/loading lock from that asynchronous work.
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending","app-loading");
  document.body?.classList.add("app-ready");
  window.EvaraLoader?.completeNavigationLoad?.();
}

function bindPublicGuestControls(menu){
  const close=document.querySelector("[data-public-home-menu-close]");
  if(!close||close.dataset.publicGuestCloseBound==="true")return;
  close.dataset.publicGuestCloseBound="true";
  close.addEventListener("click",event=>{
    event.preventDefault();
    menu?.closeMenu?.();
  });
}

function bindSessionLifecycle(){
  if(sessionLifecycleBound)return;
  sessionLifecycleBound=true;
  window.addEventListener("evara:session-ready",()=>{
    if(isCanonicalPublicPage())requestAnimationFrame(()=>bindPublicGuestControls(publicMenu));
    if(isVerifiedSession?.())scheduleAccountSystems();
  });
}

async function bindCoreSystems(){
  if(isCanonicalPublicPage()){
    const [menu,session]=await Promise.all([
      optional("./nav-menu.js"),
      optional("./nav-session.js")
    ]);
    publicMenu=menu;
    try{menu?.bindMenu?.();bindPublicGuestControls(menu)}catch(error){console.warn("Public guest menu binding failed:",error)}
    try{session?.bindRuntimeRefresh?.()}catch(error){console.warn("Nav session refresh failed:",error)}
    bindSessionLifecycle();
    try{session?.startVerifiedPublicHomeSession?.()}catch(error){console.warn("Verified public Home session failed:",error)}
    try{window.EvaraBrand?.apply?.();window.EvaraTheme?.updateThemeControls?.();window.EvaraTheme?.refreshAdaptiveGlass?.()}catch(error){console.warn("Nav theme refresh failed:",error)}
    return;
  }
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
  bindSessionLifecycle();
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
  if(!isVerifiedSession?.())return;
  bindAccountSystems().catch(error=>console.warn("Account nav systems failed:",error));
}

async function bindMotionSystems(){
  await loadMotionSystems();
  try{applyProgress?.()}catch(error){console.warn("Nav progress binding failed:",error)}
  try{animateNav?.()}catch(error){console.warn("Nav animation failed:",error)}
  try{bindScrollBehavior?.()}catch(error){console.warn("Nav scroll binding failed:",error)}
}

async function bindSystems(){
  await bindCoreSystems();
  scheduleAccountSystems();
  bindMotionSystems().catch(error=>console.warn("Deferred nav motion failed:",error));
}

export async function initNav(){
  try{
    if(isPublicHome())await ensurePublicHomeShellStyles();
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
