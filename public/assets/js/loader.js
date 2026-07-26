(function(){
  const FAST_ID="evaraFastLoader";
  const WELCOME_ID="evaraWelcomeLoader";
  const TRANSITION_ID="evaPageTransition";
  const STYLE_ID="evaraLoaderStyles";
  const CRITICAL_STYLE_ID="evaraLoaderCriticalStyles";
  const INTERNAL_NAV_KEY="evaraos-internal-navigation-v1";
  const EXPERIENCE_CACHE_KEY="evaraos-experience-config-v1";
  const INTERNAL_NAV_TTL=15000;
  const NAV_DELAY=90;
  const FORCE_UNLOCK=6000;
  const WATCHDOG_MS=2600;
  const EXIT_MS=180;
  const DEFAULT_EXPERIENCE=Object.freeze({
    brand:{markUrl:'/assets/brand/evaraos-mark.png?v=brand-png-3',appIconUrl:'/assets/brand/evaraos-app-icon.png?v=brand-png-1'},
    loaderTheme:{accent:'#f2172d',background:'#eef5fb',radius:34,markSize:42,showProgress:true},
    loaders:{
      welcome:{enabled:true,eyebrow:'EVARAOS',title:'Welcome to Evaraos',subtitle:'Preparing your operating system.',minimumMs:1200},
      page:{enabled:true,label:'Loading EvaraOS'},
      resume:{enabled:true,title:'Welcome back to Evaraos',subtitle:'Refreshing your workspace.',minimumAwayMs:45000}
    }
  });
  let experience=readExperienceCache();
  let timer=null,forceTimer=null,watchdogTimer=null,isTransitioning=false,welcomeStartedAt=0,activeWelcomeMinimum=1200,hiddenAt=0;
  let domReady=document.readyState!=="loading";
  let windowLoaded=document.readyState==="complete";
  let navReady=document.documentElement.dataset.evaraosNavReady==="true";
  let sessionReady=false;
  let bootResolved=false;
  let launchMode=document.documentElement.dataset.evaraLaunchMode||"";

  function text(value,fallback,max=500){const clean=String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);return clean||fallback}
  function integer(value,fallback,min,max){const number=Number(value);return Number.isFinite(number)?Math.min(max,Math.max(min,Math.round(number))):fallback}
  function hex(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toLowerCase():fallback}
  function safeAssetUrl(value,fallback){
    const candidate=String(value||'').trim().slice(0,2200);
    if(candidate.startsWith('/assets/'))return candidate;
    try{
      const url=new URL(candidate,location.origin);
      const expectedPrefix='/v0/b/evaraos-web.firebasestorage.app/o/';
      if(url.protocol!=='https:'||url.hostname!=='firebasestorage.googleapis.com')return fallback;
      if(!url.pathname.startsWith(expectedPrefix)||url.searchParams.get('alt')!=='media')return fallback;
      return url.href;
    }catch{return fallback}
  }
  function bool(value,fallback){return typeof value==='boolean'?value:fallback}
  function normalizeExperience(raw={}){
    const defaults=DEFAULT_EXPERIENCE;
    return{
      brand:{
        markUrl:safeAssetUrl(raw?.brand?.markUrl,defaults.brand.markUrl),
        appIconUrl:safeAssetUrl(raw?.brand?.appIconUrl,defaults.brand.appIconUrl)
      },
      loaderTheme:{
        accent:hex(raw?.loaderTheme?.accent,defaults.loaderTheme.accent),
        background:hex(raw?.loaderTheme?.background,defaults.loaderTheme.background),
        radius:integer(raw?.loaderTheme?.radius,defaults.loaderTheme.radius,16,52),
        markSize:integer(raw?.loaderTheme?.markSize,defaults.loaderTheme.markSize,24,96),
        showProgress:bool(raw?.loaderTheme?.showProgress,defaults.loaderTheme.showProgress)
      },
      loaders:{
        welcome:{
          enabled:bool(raw?.loaders?.welcome?.enabled,defaults.loaders.welcome.enabled),
          eyebrow:text(raw?.loaders?.welcome?.eyebrow,defaults.loaders.welcome.eyebrow,80),
          title:text(raw?.loaders?.welcome?.title,defaults.loaders.welcome.title,180),
          subtitle:text(raw?.loaders?.welcome?.subtitle,defaults.loaders.welcome.subtitle,320),
          minimumMs:integer(raw?.loaders?.welcome?.minimumMs,defaults.loaders.welcome.minimumMs,400,5000)
        },
        page:{
          enabled:bool(raw?.loaders?.page?.enabled,defaults.loaders.page.enabled),
          label:text(raw?.loaders?.page?.label,defaults.loaders.page.label,160)
        },
        resume:{
          enabled:bool(raw?.loaders?.resume?.enabled,defaults.loaders.resume.enabled),
          title:text(raw?.loaders?.resume?.title,defaults.loaders.resume.title,180),
          subtitle:text(raw?.loaders?.resume?.subtitle,defaults.loaders.resume.subtitle,320),
          minimumAwayMs:integer(raw?.loaders?.resume?.minimumAwayMs,defaults.loaders.resume.minimumAwayMs,10000,600000)
        }
      }
    }
  }
  function readExperienceCache(){
    try{const stored=JSON.parse(localStorage.getItem(EXPERIENCE_CACHE_KEY)||'null');return normalizeExperience(stored?.config||stored||DEFAULT_EXPERIENCE)}
    catch{return normalizeExperience(DEFAULT_EXPERIENCE)}
  }
  function routeMode(){return document.body?.dataset?.routeGuard||""}
  function routeRequiresSession(){const mode=routeMode();return mode==="private"||mode==="auth"}
  function navRequired(){return Boolean(document.getElementById("universalNavRoot"))}
  function brandMarkSrc(){return experience.brand.markUrl}
  function appIconSrc(){return experience.brand.appIconUrl}
  function markHtml(){return '<img class="evara-loader-mark" src="'+brandMarkSrc()+'" fetchpriority="high" decoding="async" alt="" aria-hidden="true">'}
  function transition(){return document.getElementById(TRANSITION_ID)}
  function authPending(){return document.documentElement.classList.contains('auth-pending')||document.body?.classList.contains('auth-pending')}
  function appPending(){return !bootResolved||authPending()||document.documentElement.classList.contains('boot-pending')||document.body?.classList.contains('app-loading')||isTransitioning}
  function clearTimers(){if(timer)clearTimeout(timer);if(forceTimer)clearTimeout(forceTimer);timer=forceTimer=null}

  function ensureCriticalStyles(){
    if(document.getElementById(CRITICAL_STYLE_ID))return;
    const style=document.createElement('style');
    style.id=CRITICAL_STYLE_ID;
    style.textContent=[
      '#evaraWelcomeLoader,#evaraFastLoader{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483647!important;align-items:center!important;justify-content:center!important}',
      '#evaraWelcomeLoader.active,#evaraFastLoader.active{display:flex!important;opacity:1!important;visibility:visible!important}',
      '#evaraWelcomeLoader{padding:max(20px,env(safe-area-inset-top,0px)) max(20px,env(safe-area-inset-right,0px)) max(20px,env(safe-area-inset-bottom,0px)) max(20px,env(safe-area-inset-left,0px));background:var(--evara-loader-background,var(--bg-primary,#eef5fb))}',
      '#evaraFastLoader{background:color-mix(in srgb,var(--evara-loader-background,var(--bg-primary,#eef5fb)) 34%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}',
      '.evara-welcome-card{width:min(430px,calc(100vw - 40px));min-height:330px;padding:32px 24px;border-radius:var(--evara-loader-radius,34px);display:grid;place-items:center;align-content:center;gap:14px;text-align:center;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.45);box-shadow:0 32px 110px rgba(27,32,48,.24);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%)}',
      '.evara-welcome-brand,.evara-loader-fast-wrap{position:relative;display:grid;place-items:center}',
      '.evara-welcome-brand{width:104px;height:104px}',
      '.evara-loader-fast-wrap{width:76px;height:76px}',
      '.evara-loader-core{display:grid;place-items:center}',
      '.evara-loader-mark{width:var(--evara-loader-mark-size,42px);height:var(--evara-loader-mark-size,42px);object-fit:contain}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureStyles(){
    ensureCriticalStyles();
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
    const mark=brandMarkSrc();
    document.documentElement.style.setProperty('--evaraos-brand-icon','url("'+mark.replaceAll('"','%22')+'")');
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach(node=>{
      node.style.setProperty('--evaraos-brand-icon','url("'+mark.replaceAll('"','%22')+'")');
      node.style.backgroundImage='url("'+mark.replaceAll('"','%22')+'")';
      node.style.backgroundSize='contain';
      node.style.backgroundPosition='center';
      node.style.backgroundRepeat='no-repeat';
    });
    document.querySelectorAll('.evara-loader-mark').forEach(img=>img.src=mark);
    ensureIconLink('icon',appIconSrc());
    ensureIconLink('shortcut icon',appIconSrc());
    ensureIconLink('apple-touch-icon',appIconSrc());
  }

  function applyLoaderSettings(){
    const theme=experience.loaderTheme;
    const welcome=experience.loaders.welcome;
    document.documentElement.style.setProperty('--evara-experience-accent',theme.accent);
    document.documentElement.style.setProperty('--evara-loader-background',theme.background);
    document.documentElement.style.setProperty('--evara-loader-radius',theme.radius+'px');
    document.documentElement.style.setProperty('--evara-loader-mark-size',theme.markSize+'px');
    const welcomeNode=document.getElementById(WELCOME_ID);
    if(welcomeNode)welcomeNode.style.background=theme.background;
    document.querySelectorAll('.evara-welcome-card').forEach(node=>node.style.borderRadius=theme.radius+'px');
    document.querySelectorAll('.evara-loader-mark').forEach(node=>{node.style.width=theme.markSize+'px';node.style.height=theme.markSize+'px'});
    document.querySelectorAll('.evara-welcome-eyebrow').forEach(node=>node.textContent=welcome.eyebrow);
    document.querySelectorAll('[data-evara-welcome-title]').forEach(node=>node.textContent=welcome.title);
    document.querySelectorAll('[data-evara-welcome-subtitle]').forEach(node=>node.textContent=welcome.subtitle);
    document.querySelectorAll('.evara-welcome-progress').forEach(node=>node.hidden=!theme.showProgress);
    document.querySelectorAll('.evara-welcome-progress i').forEach(node=>node.style.background=theme.accent);
    document.querySelectorAll('#evaraFastLoader [role="status"]').forEach(node=>node.setAttribute('aria-label',experience.loaders.page.label));
    if(!welcome.enabled)deactivate(document.getElementById(WELCOME_ID),true);
    if(!experience.loaders.page.enabled)deactivate(document.getElementById(FAST_ID),true);
  }

  function configureExperience(raw){
    experience=normalizeExperience(raw||DEFAULT_EXPERIENCE);
    ensureCriticalStyles();
    applyBrand();
    applyLoaderSettings();
  }

  function markInternalNavigation(){try{sessionStorage.setItem(INTERNAL_NAV_KEY,String(Date.now()))}catch{}}

  function resolveLaunchMode(){
    if(launchMode)return launchMode;
    const preset=document.documentElement.dataset.evaraLaunchMode;
    if(preset){launchMode=preset;return launchMode}
    try{
      const started=Number(sessionStorage.getItem(INTERNAL_NAV_KEY)||0);
      sessionStorage.removeItem(INTERNAL_NAV_KEY);
      const internal=started>0&&Date.now()-started<INTERNAL_NAV_TTL;
      launchMode=internal?'internal':'launch';
    }catch{launchMode='launch'}
    document.documentElement.dataset.evaraLaunchMode=launchMode;
    return launchMode;
  }

  function createFastLoader(){
    const node=document.createElement('div');
    node.id=FAST_ID;
    node.className='evara-loader-fast evara-loader-fast--compact';
    node.setAttribute('aria-hidden','true');
    node.innerHTML='<div class="evara-loader-fast-wrap" role="status" aria-live="polite" aria-label="'+experience.loaders.page.label.replaceAll('"','&quot;')+'"><span class="evara-loader-orbit"></span><span class="evara-loader-core">'+markHtml()+'</span></div>';
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
      '  <span class="evara-welcome-eyebrow"></span>',
      '  <strong data-evara-welcome-title></strong>',
      '  <span data-evara-welcome-subtitle></span>',
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
    applyBrand();
    applyLoaderSettings();
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
    if(!experience.loaders.page.enabled)return;
    deactivate(document.getElementById(WELCOME_ID),true);
    activate(document.getElementById(FAST_ID));
  }

  function showWelcomeLoader(options={}){
    ensure();
    const variant=options.variant==='resume'?'resume':'welcome';
    const settings=experience.loaders[variant];
    if(!settings.enabled)return false;
    const node=document.getElementById(WELCOME_ID);
    const eyebrow=node?.querySelector('.evara-welcome-eyebrow');
    const title=node?.querySelector('[data-evara-welcome-title]');
    const subtitle=node?.querySelector('[data-evara-welcome-subtitle]');
    if(eyebrow)eyebrow.textContent=variant==='welcome'?experience.loaders.welcome.eyebrow:'EVARAOS';
    if(title)title.textContent=options.title||settings.title;
    if(subtitle)subtitle.textContent=options.subtitle||settings.subtitle;
    activeWelcomeMinimum=integer(options.minimumMs,variant==='welcome'?experience.loaders.welcome.minimumMs:Math.min(1600,experience.loaders.welcome.minimumMs),400,5000);
    if(!node?.classList.contains('active')||!welcomeStartedAt)welcomeStartedAt=performance.now();
    deactivate(document.getElementById(FAST_ID),true);
    activate(node);
    return true;
  }

  function hideWelcomeLoader(immediate=false){
    const node=document.getElementById(WELCOME_ID);
    if(!node)return;
    const remaining=immediate?0:Math.max(0,activeWelcomeMinimum-(performance.now()-welcomeStartedAt));
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
    return domReady&&navGate&&sessionGate&&!authPending();
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

  function markNavReady(){navReady=true;document.documentElement.dataset.evaraosNavReady='true';maybeCompleteBoot(false)}
  function markSessionReady(){sessionReady=true;maybeCompleteBoot(false)}

  function beginNavigationLoad(){
    if(isTransitioning)return;
    isTransitioning=true;
    bootResolved=false;
    markInternalNavigation();
    clearTimers();
    ensure();
    document.body?.classList.add('eva-page-leaving');
    transition()?.classList.add('active');
    if(experience.loaders.page.enabled)timer=setTimeout(showFastLoader,NAV_DELAY);
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
      launchMode:resolveLaunchMode(),
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
      brandMark:brandMarkSrc(),
      appIcon:appIconSrc(),
      experience:JSON.parse(JSON.stringify(experience))
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
      import('/assets/js/nav.js?v=nav-v59-experience-builder').catch(error=>console.warn('Nav watchdog import failed:',error));
    }
    window.dispatchEvent(new CustomEvent('evaraos:shell-watchdog',{detail:{...health()}}));
  }

  function handleVisibilityChange(){
    if(document.visibilityState==='hidden'){hiddenAt=Date.now();return}
    if(!hiddenAt||Date.now()-hiddenAt<experience.loaders.resume.minimumAwayMs||isTransitioning)return;
    hiddenAt=0;
    bootResolved=false;
    if(showWelcomeLoader({variant:'resume'}))requestAnimationFrame(()=>maybeCompleteBoot(false));
    else maybeCompleteBoot(true);
  }

  function init(){
    ensureCriticalStyles();
    ensure();
    configureExperience(experience);
    domReady=document.readyState!=='loading';
    windowLoaded=document.readyState==='complete';
    navReady=navReady||document.documentElement.dataset.evaraosNavReady==='true';
    if(!routeRequiresSession())sessionReady=true;
    const welcome=document.getElementById(WELCOME_ID);
    const preRenderedWelcome=welcome?.classList.contains('active')===true;
    const mode=resolveLaunchMode();
    if(!experience.loaders.welcome.enabled&&preRenderedWelcome)deactivate(welcome,true);
    else if(preRenderedWelcome||mode==='launch')showWelcomeLoader({variant:'welcome'});
    else if(document.body?.classList.contains('app-loading'))showFastLoader();
    window.EvaraBrand={
      get mark(){return brandMarkSrc()},
      get appIcon(){return appIconSrc()},
      apply:applyBrand,
      hydrate:async()=>applyBrand()
    };
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
      configure:configureExperience,
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
    addEventListener('evara:experience-config',event=>configureExperience(event.detail?.config||{}));
    addEventListener('load',()=>{windowLoaded=true;applyBrand();maybeCompleteBoot(false)});
    addEventListener('pageshow',event=>{
      windowLoaded=document.readyState==='complete';
      applyBrand();
      if(event.persisted&&(!routeRequiresSession()||sessionReady)&&!authPending()){
        finishLoad(true);
        return;
      }
      if(!maybeCompleteBoot(true)&&appPending()&&!document.querySelector('#evaraFastLoader.active,#evaraWelcomeLoader.active'))showFastLoader();
    });
    addEventListener('pagehide',resetLeavingFrame);
    document.addEventListener('visibilitychange',handleVisibilityChange);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{domReady=true;maybeCompleteBoot(false)},{once:true});
    forceTimer=setTimeout(()=>{
      if(routeRequiresSession()&&(!sessionReady||authPending())){shellWatchdog();return}
      if(!maybeCompleteBoot(true))finishLoad(true);
    },FORCE_UNLOCK);
    watchdogTimer=setTimeout(shellWatchdog,WATCHDOG_MS);
    maybeCompleteBoot(false);
  }

  document.body?init():document.addEventListener('DOMContentLoaded',init,{once:true});
})();
