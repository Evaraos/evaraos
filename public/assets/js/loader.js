(function(){
  const FAST_ID="evaraFastLoader";
  const TRANSITION_ID="evaPageTransition";
  const NAV_DELAY=650;
  const FORCE_UNLOCK=2600;
  const EXIT_MS=160;
  const MARK='<svg class="evara-loader-mark" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M86 410c41-45 79-85 114-120 47-46 96-91 148-134h70c6 0 9 7 5 12l-41 53c-4 5-9 8-16 8h-85c-17 14-32 28-46 42h136c6 0 10 7 6 12l-39 51c-4 5-9 8-16 8H176c-27 28-55 59-84 93-6 7-17 3-17-7 0-6 4-14 11-18Z"/><path d="M94 173c29-31 60-55 94-73h218c7 0 10 8 6 14l-39 51c-4 5-9 8-16 8H94Z"/><path d="M98 252h236c6 0 10 7 6 12l-38 50c-4 5-9 8-16 8H98Z"/></svg>';
  let timer=null,forceTimer=null,isTransitioning=false,created=false;

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
  function init(){
    ensure();document.getElementById("evaraGlobalLoader")?.remove();
    window.EvaraLoader={beginNavigationLoad,completeNavigationLoad:()=>hideAll(false),showFastLoader:show,hideFastLoader:hide,showFullLoader:show,hideFullLoader:hide,hideAllLoaders:hideAll,markAppReady:()=>hideAll(false),getState:()=>({isTransitioning,appPending:pending(),loadersCreated:created})};
    document.addEventListener("click",event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=event.target.closest("a[href]");if(!shouldIntercept(anchor))return;event.preventDefault();beginNavigationLoad();setTimeout(()=>location.assign(anchor.href),80)});
    addEventListener("evara:session-ready",()=>hideAll(false));
    addEventListener("load",()=>{if(!pending())hideAll(false)});
    addEventListener("pageshow",()=>hideAll(true));
    addEventListener("pagehide",resetLeavingFrame);
    forceTimer=setTimeout(()=>hideAll(true),FORCE_UNLOCK);
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();