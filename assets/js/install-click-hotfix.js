(function(){
  var fallbackTimer=null;

  function updateAppleLabel(){
    var apple=document.getElementById("evaInstallApple");
    var label=apple&&apple.querySelector(".eva-install-copy small");
    if(label) label.textContent="Coming Soon";
  }

  function ensureNoticeStyles(){
    if(document.getElementById("evaraInstallFallbackStyles")) return;
    var style=document.createElement("style");
    style.id="evaraInstallFallbackStyles";
    style.textContent=[
      ".evara-install-notice{position:fixed!important;left:50%!important;bottom:max(118px,calc(env(safe-area-inset-bottom) + 96px))!important;z-index:2147483647!important;width:min(92vw,430px)!important;display:grid!important;place-items:center!important;opacity:0;pointer-events:none!important;transform:translateX(-50%) translateY(16px) scale(.98)!important;transition:opacity .18s ease,transform .18s ease!important;}",
      ".evara-install-notice.show{opacity:1!important;transform:translateX(-50%) translateY(0) scale(1)!important;}",
      ".evara-install-notice-card{width:100%!important;display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:12px!important;padding:13px!important;border-radius:26px!important;background:rgba(255,255,255,.94)!important;border:1px solid rgba(255,255,255,.96)!important;box-shadow:0 20px 58px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.98)!important;backdrop-filter:blur(30px) saturate(180%)!important;-webkit-backdrop-filter:blur(30px) saturate(180%)!important;pointer-events:auto!important;}",
      ".evara-install-notice-icon{width:42px!important;height:42px!important;border-radius:16px!important;background:rgba(255,255,255,.78) url('/evaraos/assets/img/evaraos_logo.png') center/78% 78% no-repeat!important;border:1px solid rgba(255,255,255,.92)!important;box-shadow:0 10px 22px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.96)!important;}",
      ".evara-install-notice-copy strong{display:block!important;font-weight:950!important;font-size:1rem!important;line-height:1.05!important;letter-spacing:-.035em!important;color:#101917!important;}",
      ".evara-install-notice-copy small{display:block!important;margin-top:3px!important;font-weight:800!important;font-size:.76rem!important;line-height:1.15!important;color:rgba(60,60,67,.68)!important;}",
      ".evara-install-notice-close{width:40px!important;height:40px!important;border:0!important;border-radius:999px!important;background:rgba(120,120,128,.13)!important;color:#101917!important;font-size:1.18rem!important;font-weight:950!important;display:flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;}",
      "@media(max-width:480px){.evara-install-notice{bottom:max(104px,calc(env(safe-area-inset-bottom) + 86px))!important;width:min(92vw,410px)!important;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function makeNotice(){
    var notice=document.getElementById("evaraInstallNotice");
    if(notice) return notice;
    ensureNoticeStyles();
    notice=document.createElement("div");
    notice.id="evaraInstallNotice";
    notice.className="evara-install-notice";
    notice.setAttribute("role","status");
    notice.setAttribute("aria-live","polite");
    notice.innerHTML='<div class="evara-install-notice-card"><span class="evara-install-notice-icon" aria-hidden="true"></span><span class="evara-install-notice-copy"><strong></strong><small></small></span><button type="button" class="evara-install-notice-close" aria-label="Close"><span aria-hidden="true">×</span></button></div>';
    notice.querySelector(".evara-install-notice-close").addEventListener("click",function(){notice.classList.remove("show");});
    document.body.appendChild(notice);
    return notice;
  }

  function showFallbackNotice(title,message){
    var notice=makeNotice();
    var strong=notice.querySelector("strong");
    var small=notice.querySelector("small");
    if(strong) strong.textContent=title;
    if(small) small.textContent=message;
    clearTimeout(fallbackTimer);
    requestAnimationFrame(function(){notice.classList.add("show");});
    fallbackTimer=setTimeout(function(){notice.classList.remove("show");},5200);
  }

  function clickFallback(event){
    var apple=event.target.closest&&event.target.closest("#evaInstallApple");
    var android=event.target.closest&&event.target.closest("#evaInstallAndroid");
    if(!apple&&!android) return;

    updateAppleLabel();

    if(apple){
      setTimeout(function(){
        if(!document.getElementById("evaraIOSInstallGuide")&&window.EvaraInstall&&typeof window.EvaraInstall.openIOSInstallGuide==="function"){
          window.EvaraInstall.openIOSInstallGuide();
        }
      },60);
      return;
    }

    if(android){
      setTimeout(function(){
        var notice=document.getElementById("evaraInstallNotice");
        if(notice&&notice.classList.contains("show")) return;
        showFallbackNotice("Android Install","Open Chrome menu and tap Install app.");
      },120);
    }
  }

  function boot(){
    updateAppleLabel();
    document.addEventListener("click",clickFallback,true);
    if(document.body){
      new MutationObserver(updateAppleLabel).observe(document.body,{childList:true,subtree:true});
    }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
