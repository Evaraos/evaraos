(function(){
  const FAST_ID="evaraFastLoader";
  const TRANSITION_ID="evaPageTransition";
  const NAV_DELAY=650;
  const FORCE_UNLOCK=2400;
  const WATCHDOG_MS=3200;
  const EXIT_MS=160;
  const BRAND_MARK='/assets/brand/evaraos-mark.png?v=brand-png-1';
  const APP_ICON='/assets/brand/evaraos-app-icon.png?v=brand-png-1';
  const MARK='<img class="evara-loader-mark" src="'+BRAND_MARK+'" alt="" aria-hidden="true">';
  let timer=null,forceTimer=null,watchdogTimer=null,isTransitioning=false,created=false;

  function applyBrand(){
    document.documentElement.style.setProperty('--evaraos-brand-icon','url("'+BRAND_MARK+'")');
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach(node=>node.style.setProperty('--evaraos-brand-icon','url("'+BRAND_MARK+'")'));
    const links=[['icon','image/png',BRAND_MARK],['shortcut icon','image/png',BRAND_MARK],['apple-touch-icon','image/png',APP_ICON]];
    links.forEach(([rel,type,href])=>{
      let link=document.querySelector('link[rel="'+rel+'"]');
      if(!link){link=document.createElement('link');link.rel=rel;document.head.appendChild(link)}
      link.type=type;link.href=href;
    });
  }
  function transition(){return document.getElementById(TRANSITION_ID)}
  function clearTimers(){if(timer)clearTimeout(timer);if(forceTimer)clearTimeout(forceTimer);timer=forceTimer=null}
  function unlock(){
    document.documentElement.classList.remove("boot-pending","auth-pending","eva-transitioning","evara-boot-lock");
    document.documentElement.classList.add("evara-theme-painted");
    document.body?.classList.remove("auth-pending","app-loading","eva-page-leaving");
    document.body?.classList.add("app-ready");
    transition()?.classList.remove("active");
    isTransitioning=false;
  }
  function ensure(){
    if(created)return;
    if(!transition()){
      const node=document.createElement("div");node.id=TRANSITION_ID;node.className="eva-page-transition";node.setAttribute("aria-hidden","true");document.body.appendChild(node);
    }
    if(!document.getElementById(FAST_ID)){
      const node=document.createElement("div");node.id=FAST_ID;node.className="evara-loader-fast evara-loader-fast--compact";node.setAttribute("aria-hidden","true");node.innerHTML='<div class="evara-loader-fast-wrap" aria-label="Loading Evaraos"><span class="evara-loader-orbit"></span><span class="evara-loader-core">'+MARK+'</span></div>';document.body.appendChild(node);
    }
    document.getElementById("evaraGlobalLoader")?.remove();
    created=true;
  }
  function show(){ensure();const node=document.getElementById(FAST_ID);node?.classList.remove("is-exiting");node?.classList.add("active","is-entering");node?.setAttribute("aria-hidden","false");requestAnimationFrame(()=>node?.classList.remove("is-entering"))}
  function hide(immediate=false){const node=document.getElementById(FAST_ID);if(!node)return;if(immediate){node.classList.remove("active","is-entering","is-exiting");node.setAttribute("aria-hidden","true");return}node.classList.add("is-exiting");setTimeout(()=>{node.classList.remove("active","is-exiting");node.setAttribute("aria-hidden","true")},EXIT_MS)}
  function hideAll(immediate=false){clearTimers();hide(immediate);document.getElementById("evaraGlobalLoader")?.remove();unlock()}
  function pending(){return document.documentElement.classList.contains("boot-pending")||document.documentElement.classList.contains("auth-pending")||document.body?.classList.contains("auth-pending")||document.body?.classList.contains("app-loading")||isTransitioning}
  function beginNavigationLoad(){if(isTransitioning)return;isTransitioning=true;clearTimers();ensure();document.body?.classList.add("eva-page-leaving");transition()?.classList.add("active");timer=setTimeout(()=>{if(pending())show()},NAV_DELAY);forceTimer=setTimeout(()=>hideAll(true),FORCE_UNLOCK)}
  function shouldIntercept(anchor){if(!anchor)return false;const href=anchor.getAttribute("href")||"";if(!href||href.startsWith("#")||href.startsWith("mailto:")||href.startsWith("tel:")||anchor.hasAttribute("download")||(anchor.target&&anchor.target!=="_self"))return false;try{const url=new URL(anchor.href,location.origin);return url.origin===location.origin&&!(url.pathname===location.pathname&&url.hash)}catch{return false}}
  function resetLeavingFrame(){clearTimers();transition()?.classList.remove("active");hide(true);document.body?.classList.remove("eva-page-leaving");isTransitioning=false}
  function shellWatchdog(){
    applyBrand();
    if(document.body?.classList.contains("app-loading")||document.documentElement.classList.contains("auth-pending"))hideAll(true);
    const root=document.getElementById("universalNavRoot");
    if(root&&!root.querySelector(".eva-nav-layer")&&!document.documentElement.dataset.evaraosNavReady){
      import('/assets/js/nav.js?v=nav-v37-shell-watchdog').catch(error=>console.warn('Nav watchdog import failed:',error));
    }
    window.dispatchEvent(new CustomEvent('evaraos:shell-watchdog',{detail:{navReady:document.documentElement.dataset.evaraosNavReady==='true',appReady:document.body?.classList.contains('app-ready')}}));
  }
  function init(){
    applyBrand();ensure();document.getElementById("evaraGlobalLoader")?.remove();
    window.EvaraBrand={mark:BRAND_MARK,appIcon:APP_ICON,apply:applyBrand};
    window.EvaraLoader={beginNavigationLoad,completeNavigationLoad:()=>hideAll(false),showFastLoader:show,hideFastLoader:hide,showFullLoader:show,hideFullLoader:hide,hideAllLoaders:hideAll,markAppReady:()=>hideAll(false),runShellWatchdog:shellWatchdog,getState:()=>({isTransitioning,appPending:pending(),loadersCreated:created,navReady:document.documentElement.dataset.evaraosNavReady==='true'})};
    document.addEventListener("click",event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=event.target.closest("a[href]");if(!shouldIntercept(anchor))return;event.preventDefault();beginNavigationLoad();setTimeout(()=>location.assign(anchor.href),80)});
    addEventListener("evara:session-ready",()=>hideAll(false));
    addEventListener("load",()=>{applyBrand();if(!pending())hideAll(false);shellWatchdog()});
    addEventListener("pageshow",()=>{applyBrand();hideAll(true);setTimeout(shellWatchdog,180)});
    addEventListener("pagehide",resetLeavingFrame);
    forceTimer=setTimeout(()=>hideAll(true),FORCE_UNLOCK);
    watchdogTimer=setTimeout(shellWatchdog,WATCHDOG_MS);
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
