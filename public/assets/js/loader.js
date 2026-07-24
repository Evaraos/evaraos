(function(){
  const FAST_ID="evaraFastLoader";
  const WELCOME_ID="evaraWelcomeLoader";
  const TRANSITION_ID="evaPageTransition";
  const STYLE_ID="evaraLoaderStyles";
  const WELCOME_SESSION_KEY="evaraos-welcome-loader-session-v3";
  const NAV_DELAY=90;
  const FORCE_UNLOCK=8000;
  const WATCHDOG_MS=3200;
  const EXIT_MS=180;
  const WELCOME_MIN_MS=1200;
  const BRAND_MARK_SRC='/assets/brand/evaraos-mark.png?v=brand-png-2';
  const APP_ICON_SRC='/assets/brand/evaraos-app-icon.png?v=brand-png-1';
  let timer=null,forceTimer=null,watchdogTimer=null,isTransitioning=false,welcomeStartedAt=0;
  let domReady=document.readyState!=="loading";
  let windowLoaded=document.readyState==="complete";
  let navReady=document.documentElement.dataset.evaraosNavReady==="true";
  let sessionReady=!routeRequiresSession();
  let bootResolved=false;

  function routeMode(){return document.body?.dataset?.routeGuard||""}
  function routeRequiresSession(){const mode=document.body?.dataset?.routeGuard||"";return mode==="private"||mode==="auth"}
  function navRequired(){return Boolean(document.getElementById("universalNavRoot"))}
  function markHtml(){return '<img class="evara-loader-mark" src="'+BRAND_MARK_SRC+'" alt="" aria-hidden="true">'}
  function transition(){return document.getElementById(TRANSITION_ID)}
  function authPending(){return document.documentElement.classList.contains('auth-pending')||document.body?.classList.contains('auth-pending')}
  function appPending(){return !bootResolved||authPending()||document.documentElement.classList.contains('boot-pending')||document.body?.classList.contains('app-loading')||isTransitioning}
  function clearTimers(){if(timer)clearTimeout(timer);if(forceTimer)clearTimeout(forceTimer);timer=forceTimer=null}

  function ensureStyles(){
    if(document.getElementById(STYLE_ID)||document.querySelector('link[href*="/assets/css/loaders/loader-viewport.css"]'))return;
    const link=document.createElement('link');
    link.id=STYLE_ID;
    link.rel='stylesheet';
    link.href='/assets/css/loaders/loader-viewport.css?v=3';
    document.head.appendChild(link);
  }

  function ensureIconLink(rel,href){
    let link=document.querySelector('link[rel="'+rel+'"]');
    if(!link){link=document.createElement('link');link.rel=rel;document.head.appendChild(link)}
    link.type='image/png';
    link.href=href;
  }

  function applyBrand(){
    document.documentElement.style.setProperty('--evaraos-brand-icon','url("'+BRAND_MARK_SRC+'")');
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach(node=>{
      node.style.setProperty('--evaraos-brand-icon','url("'+BRAND_MARK_SRC+'")');
      node.style.backgroundImage='url("'+BRAND_MARK_SRC+'")';
      node.style.backgroundSize='contain';
      node.style.backgroundPosition='center';
      node.style.backgroundRepeat='no-repeat';
    });
    document.querySelectorAll('.evara-loader-mark').forEach(img=>img.src=BRAND_MARK_SRC);
    ensureIconLink('icon',APP_ICON_SRC);
    ensureIconLink('shortcut icon',APP_ICON_SRC);
    ensureIconLink('apple-touch-icon',APP_ICON_SRC);
  }

  function createFastLoader(){
    const node=document.createElement('div');
    node.id=FAST_ID;
    node.className='evara-loader-fast evara-loader-fast--compact';
    node.setAttribute('aria-hidden','true');
    node.innerHTML='<div class="evara-loader-fast-wrap" role="status" aria-live="polite" aria-label="Loading EvaraOS"><span class="evara-loader-orbit"></span><span class="evara-loader-core">'+markHtml()+'</span></div>';
    node.style.display='none';
    document.body.appendChild(node);
  }

  function createWelcomeLoader(){
    const node=document.createElement('div');
    node.id=WELCOME_ID;
    node.className='evara-welcome-loader';
    node.setAttribute('aria-hidden','true');
    node.innerHTML=[
      '<section class="evara-welcome-card" role="status" aria-live="polite" aria-label="Opening EvaraOS">',
      '  <div class="evara-welcome-brand"><span class="evara-loader-orbit"></span><span class="evara-loader-core">'+markHtml()+'</span></div>',
      '  <span class="evara-welcome-eyebrow">EVARAOS</span>',
      '  <strong data-evara-welcome-title>Welcome to Evaraos</strong>',
      '  <span data-evara-welcome-subtitle>Preparing your operating system.</span>',
      '  <span class="evara-welcome-progress" aria-hidden="true"><i></i></span>',
      '</section>'
    ].join('');
    node.style.display='none';
    document.body.appendChild(node);
  }

  function ensure(){
    ensureStyles();
    if(!transition()){
      const node=document.createElement('div');
      node.id=TRANSITION_ID;
      node.className='eva-page-transition';
      node.setAttribute('aria-hidden','true');
      document.body.appendChild(node);
    }
    if(!document.getElementById(FAST_ID))createFastLoader();
    if(!document.getElementById(WELCOME_ID))createWelcomeLoader();
  }

  function activate(node){
    if(!node)return;
    node.style.display='flex';
    node.classList.remove('is-exiting');
    node.classList.add('active','is-entering');
    node.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>node.classList.remove('is-entering'));
  }

  function deactivate(node,immediate=false){
    if(!node)return;
    const finish=()=>{
      node.classList.remove('active','is-entering','is-exiting');
      node.setAttribute('aria-hidden','true');
      node.style.display='none';
    };
    if(immediate){finish();return}
    node.classList.add('is-exiting');
    setTimeout(finish,EXIT_MS);
  }

  function showFastLoader(){
    ensure();
    deactivate(document.getElementById(WELCOME_ID),true);
    activate(document.getElementById(FAST_ID));
  }

  function showWelcomeLoader(options={}){
    ensure();
    const node=document.getElementById(WELCOME_ID);
    const title=node?.querySelector('[data-evara-welcome-title]');
    const subtitle=node?.querySelector('[data-evara-welcome-subtitle]');
    if(title)title.textContent=options.title||'Welcome to Evaraos';
    if(subtitle)subtitle.textContent=options.subtitle||'Preparing your operating system.';
    if(!node?.classList.contains('active')||!welcomeStartedAt)welcomeStartedAt=performance.now();
    deactivate(document.getElementById(FAST_ID),true);
    activate(node);
  }

  function hideWelcomeLoader(immediate=false){
    const node=document.getElementById(WELCOME_ID);
    if(!node)return;
    const remaining=immediate?0:Math.max(0,WELCOME_MIN_MS-(performance.now()-welcomeStartedAt));
    setTimeout(()=>deactivate(node,immediate),remaining);
  }

  function unlockVisualShell(){
    document.documentElement.classList.remove('boot-pending','eva-transitioning','evara-boot-lock');
    document.documentElement.classList.add('evara-theme-painted');
    document.body?.classList.remove('eva-page-leaving');
    transition()?.classList.remove('active');
    isTransitioning=false;
    if(!authPending()){
      document.body?.classList.remove('app-loading');
      document.body?.classList.add('app-ready');
    }
  }

  function finishLoad(immediate=false){
    clearTimers();
    bootResolved=true;
    deactivate(document.getElementById(FAST_ID),immediate);
    hideWelcomeLoader(immediate);
    unlockVisualShell();
  }

  function criticalReady(){
    const navGate=!navRequired()||navReady||document.documentElement.dataset.evaraosNavReady==='true';
    const sessionGate=!routeRequiresSession()||sessionReady;
    return domReady&&windowLoaded&&navGate&&sessionGate&&!authPending();
  }

  function maybeCompleteBoot(immediate=false){
    if(bootResolved||isTransitioning||!criticalReady())return false;
    finishLoad(immediate);
    return true;
  }

  function completeNavigationLoad(immediate=false){
    if(isTransitioning){finishLoad(immediate);return}
    maybeCompleteBoot(immediate);
  }

  function markNavReady(){
    navReady=true;
    document.documentElement.dataset.evaraosNavReady='true';
    maybeCompleteBoot(false);
  }

  function markSessionReady(){
    sessionReady=true;
    maybeCompleteBoot(false);
  }

  function firstBootThisSession(){
    try{
      if(sessionStorage.getItem(WELCOME_SESSION_KEY)==='1')return false;
      sessionStorage.setItem(WELCOME_SESSION_KEY,'1');
      return true;
    }catch{return true}
  }

  function beginNavigationLoad(options={}){
    if(isTransitioning)return;
    isTransitioning=true;
    bootResolved=false;
    clearTimers();
    ensure();
    document.body?.classList.add('eva-page-leaving');
    transition()?.classList.add('active');
    timer=setTimeout(()=>showFastLoader(options),NAV_DELAY);
    forceTimer=setTimeout(()=>{if(authPending())showFastLoader();else finishLoad(true)},FORCE_UNLOCK);
  }

  function shouldIntercept(anchor){
    if(!anchor)return false;
    const href=anchor.getAttribute('href')||'';
    if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return false;
    try{const url=new URL(anchor.href,location.origin);return url.origin===location.origin&&!(url.pathname===location.pathname&&url.hash)}catch{return false}
  }

  function resetLeavingFrame(){
    clearTimers();
    transition()?.classList.remove('active');
    deactivate(document.getElementById(FAST_ID),true);
    document.body?.classList.remove('eva-page-leaving');
    isTransitioning=false;
  }

  function health(){
    return{
      path:location.pathname,
      routeMode:routeMode(),
      appReady:document.body?.classList.contains('app-ready')===true,
      pending:appPending(),
      authPending:authPending(),
      domReady,
      windowLoaded,
      navReady:navReady||document.documentElement.dataset.evaraosNavReady==='true',
      sessionReady,
      criticalReady:criticalReady(),
      navBuild:document.documentElement.dataset.evaraosNavBuild||window.EVARAOS_NAV_BUILD||'',
      duplicateLoaders:document.querySelectorAll('#evaraFastLoader,#evaraWelcomeLoader,#evaraGlobalLoader').length,
      welcomeVisible:document.getElementById(WELCOME_ID)?.classList.contains('active')===true,
      compactVisible:document.getElementById(FAST_ID)?.classList.contains('active')===true,
      brandMark:BRAND_MARK_SRC,
      appIcon:APP_ICON_SRC
    };
  }

  function shellWatchdog(){
    applyBrand();
    domReady=document.readyState!=='loading';
    windowLoaded=document.readyState==='complete';
    navReady=navReady||document.documentElement.dataset.evaraosNavReady==='true';
    if(maybeCompleteBoot(false))return;
    if(appPending()&&!document.querySelector('#evaraFastLoader.active,#evaraWelcomeLoader.active'))showFastLoader();
    const root=document.getElementById('universalNavRoot');
    if(root&&!root.querySelector('.eva-nav-layer')&&!document.documentElement.dataset.evaraosNavReady){
      import('/assets/js/nav.js?v=nav-v57-loader-gate').catch(error=>console.warn('Nav watchdog import failed:',error));
    }
    window.dispatchEvent(new CustomEvent('evaraos:shell-watchdog',{detail:{...health()}}));
  }

  function init(){
    applyBrand();
    ensure();
    domReady=document.readyState!=='loading';
    windowLoaded=document.readyState==='complete';
    navReady=navReady||document.documentElement.dataset.evaraosNavReady==='true';
    sessionReady=sessionReady||!routeRequiresSession();
    const welcome=document.getElementById(WELCOME_ID);
    const preRenderedWelcome=welcome?.classList.contains('active')===true;
    const firstBoot=preRenderedWelcome||firstBootThisSession();
    if(document.body?.classList.contains('app-loading')){
      if(firstBoot)showWelcomeLoader();
      else showFastLoader();
    }
    window.EvaraBrand={mark:BRAND_MARK_SRC,appIcon:APP_ICON_SRC,apply:applyBrand,hydrate:async()=>applyBrand()};
    window.EvaraLoader={
      beginNavigationLoad,
      completeNavigationLoad,
      showFastLoader,
      hideFastLoader:(immediate=false)=>deactivate(document.getElementById(FAST_ID),immediate),
      showFullLoader:showWelcomeLoader,
      hideFullLoader:hideWelcomeLoader,
      hideAllLoaders:completeNavigationLoad,
      markNavReady,
      markSessionReady,
      markAppReady:()=>maybeCompleteBoot(false),
      runShellWatchdog:shellWatchdog,
      getState:health,
      health
    };
    document.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=event.target.closest('a[href]');
      if(!shouldIntercept(anchor))return;
      event.preventDefault();
      beginNavigationLoad();
      setTimeout(()=>location.assign(anchor.href),80);
    });
    addEventListener('evara:nav-ready',markNavReady);
    addEventListener('evara:session-ready',markSessionReady);
    addEventListener('load',()=>{windowLoaded=true;applyBrand();if(!maybeCompleteBoot(false))shellWatchdog()});
    addEventListener('pageshow',event=>{
      windowLoaded=document.readyState==='complete';
      applyBrand();
      if(event.persisted&&!authPending()){
        bootResolved=true;
        finishLoad(true);
        return;
      }
      if(!maybeCompleteBoot(true)&&appPending()&&!document.querySelector('#evaraFastLoader.active,#evaraWelcomeLoader.active'))showFastLoader();
    });
    addEventListener('pagehide',resetLeavingFrame);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{domReady=true;maybeCompleteBoot(false)},{once:true});
    forceTimer=setTimeout(()=>{
      if(routeRequiresSession()&&authPending()){
        shellWatchdog();
        return;
      }
      if(!maybeCompleteBoot(true))finishLoad(true);
    },FORCE_UNLOCK);
    watchdogTimer=setTimeout(shellWatchdog,WATCHDOG_MS);
    maybeCompleteBoot(false);
  }

  document.body?init():document.addEventListener('DOMContentLoaded',init,{once:true});
})();