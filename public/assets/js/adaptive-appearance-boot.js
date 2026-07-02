(function(){
  var root=document.documentElement;
  var THEME_CSS="/assets/css/theme.css?v=adaptive-liquid-v7";
  var NAV_CSS="/assets/css/nav.css?v=nav-v25-x-drawer";
  var OPTICS_JS="/assets/js/liquid-optics.js?v=1";
  var THEME_JS="/assets/js/theme.js?v=adaptive-liquid-v7";
  var NAV_JS="/assets/js/nav.js?v=nav-v25-x-drawer";
  var appearance={};
  try{appearance=JSON.parse(localStorage.getItem("evaraos-appearance")||"{}")||{}}catch{}
  var modes=["light","dark","system","image"];
  var mode=modes.indexOf(appearance.mode)>=0?appearance.mode:"system";
  var systemDark=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches;
  var resolved=mode==="system"?(systemDark?"dark":"light"):mode;
  var imageUrl=typeof appearance.imageUrl==="string"?appearance.imageUrl.trim():"";
  if(imageUrl&&!(imageUrl.indexOf("data:image/")===0||/^https?:\/\//i.test(imageUrl)))imageUrl="";
  var positions=["center center","center top","center bottom","left center","right center"];
  var position=positions.indexOf(appearance.imagePosition)>=0?appearance.imagePosition:"center center";
  var dim=Number(appearance.wallpaperDim);if(!Number.isFinite(dim))dim=.08;dim=Math.min(.34,Math.max(0,dim));
  var tint=Number(appearance.glassTint);if(!Number.isFinite(tint))tint=.46;tint=Math.min(.76,Math.max(.18,tint));

  root.dataset.theme=resolved==="image"?"adaptive":resolved;
  root.dataset.themeMode=mode;
  root.dataset.appearance="adaptive-"+mode;
  root.dataset.adaptiveContrast="on";
  root.toggleAttribute("data-has-wallpaper",mode==="image");
  root.classList.add("boot-pending","evara-boot-lock");
  root.style.colorScheme=resolved==="dark"?"dark":"light";
  root.style.setProperty("--evara-wallpaper-position",mode==="image"?position:"center center");
  root.style.setProperty("--evara-wallpaper-dim",String(mode==="image"?dim:0));
  root.style.setProperty("--evara-glass-tint",String(tint));
  root.style.setProperty("--evara-glass-tint-pct",Math.round(tint*100)+"%");
  if(mode==="image"&&imageUrl)root.style.setProperty("--evara-wallpaper-image","url("+JSON.stringify(imageUrl)+")");

  var fallback=resolved==="dark"?"linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)":"linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";
  var critical=document.createElement("style");
  critical.id="evaraCriticalAppearance";
  critical.textContent="html{background:"+(mode==="image"?"#101827 var(--evara-wallpaper-image,"+fallback+")":fallback)+" center/cover fixed no-repeat!important}html.evara-boot-lock body{visibility:hidden!important}html.evara-theme-painted body{visibility:visible!important}body{background:transparent!important}";
  document.head.appendChild(critical);

  function canonicalStylesheet(id,href){var link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href=href;link.dataset.evaraAuthority="true";document.head.appendChild(link);return link}
  function canonicalModule(id,src){var script=document.createElement("script");script.id=id;script.type="module";script.src=src;script.dataset.evaraAuthority="true";document.head.appendChild(script);return script}
  var themeLink=canonicalStylesheet("evaraThemeAuthority",THEME_CSS);
  canonicalStylesheet("evaraNavAuthority",NAV_CSS);
  canonicalModule("evaraLiquidOpticsAuthority",OPTICS_JS);
  canonicalModule("evaraThemeRuntimeAuthority",THEME_JS);
  canonicalModule("evaraNavRuntimeAuthority",NAV_JS);

  function normalize(node){
    if(!(node instanceof Element))return;
    var candidates=[node].concat(Array.from(node.querySelectorAll?node.querySelectorAll("link[href],script[src]"):[]));
    candidates.forEach(function(item){
      if(item.dataset&&item.dataset.evaraAuthority==="true")return;
      if(item.tagName==="LINK"){
        var href=item.getAttribute("href")||"";
        if(href.indexOf("/assets/css/theme.css")>=0||href.indexOf("/assets/css/nav.css")>=0)item.remove();
      }
      if(item.tagName==="SCRIPT"){
        var src=item.getAttribute("src")||"";
        if(src.indexOf("/assets/js/theme.js")>=0||src.indexOf("/assets/js/nav.js")>=0||src.indexOf("/assets/js/liquid-optics.js")>=0||src.indexOf("theme-boot.js")>=0||src.indexOf("appearance-mode-fix.js")>=0)item.remove();
      }
    })
  }
  var observer=new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(normalize)})});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  var revealed=false;
  function reveal(){if(revealed)return;revealed=true;root.classList.remove("evara-boot-lock");root.classList.add("evara-theme-painted")}
  themeLink.addEventListener("load",function(){requestAnimationFrame(function(){requestAnimationFrame(reveal)})},{once:true});
  if(themeLink.sheet)requestAnimationFrame(reveal);
  window.addEventListener("evara:theme-applied",reveal,{once:true});
  window.setTimeout(reveal,2400);
})();
