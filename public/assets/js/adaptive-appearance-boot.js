(function(){
  var root=document.documentElement;
  var key="evaraos-appearance";
  var appearance={};
  try{appearance=JSON.parse(localStorage.getItem(key)||"{}")||{}}catch{}
  var imageUrl=typeof appearance.imageUrl==="string"?appearance.imageUrl.trim():"";
  if(imageUrl&&!(imageUrl.indexOf("data:image/")===0||/^https?:\/\//i.test(imageUrl)))imageUrl="";
  var position=["center center","center top","center bottom","left center","right center"].indexOf(appearance.imagePosition)>=0?appearance.imagePosition:"center center";
  var dim=Number(appearance.wallpaperDim);if(!Number.isFinite(dim))dim=.08;dim=Math.min(.34,Math.max(0,dim));
  var tint=Number(appearance.glassTint);if(!Number.isFinite(tint))tint=.46;tint=Math.min(.76,Math.max(.18,tint));
  root.dataset.theme="adaptive";
  root.dataset.themeMode="image";
  root.dataset.appearance="adaptive-image";
  root.dataset.adaptiveContrast="on";
  root.setAttribute("data-has-wallpaper","");
  root.classList.add("boot-pending","evara-boot-lock");
  root.style.colorScheme="normal";
  root.style.setProperty("--evara-wallpaper-position",position);
  root.style.setProperty("--evara-wallpaper-dim",String(dim));
  root.style.setProperty("--evara-glass-tint",String(tint));
  root.style.setProperty("--evara-glass-tint-pct",Math.round(tint*100)+"%");
  if(imageUrl)root.style.setProperty("--evara-wallpaper-image","url("+JSON.stringify(imageUrl)+")");
  var style=document.createElement("style");
  style.id="evaraCriticalAppearance";
  style.textContent="html{background:#101827 var(--evara-wallpaper-image,linear-gradient(135deg,#101827,#345f9c 48%,#d69ba7)) center/cover fixed no-repeat!important}html.evara-boot-lock body{visibility:hidden!important}html.evara-theme-painted body{visibility:visible!important}body{background:transparent!important}";
  document.head.appendChild(style);
  function reveal(){root.classList.remove("evara-boot-lock");root.classList.add("evara-theme-painted")}
  var observer=new MutationObserver(function(){
    var link=document.querySelector('link[rel="stylesheet"][href*="/assets/css/theme.css"]');
    if(!link)return;
    observer.disconnect();
    if(link.sheet)requestAnimationFrame(reveal);else link.addEventListener("load",function(){requestAnimationFrame(reveal)},{once:true});
  });
  observer.observe(document.head,{childList:true,subtree:true});
  window.setTimeout(reveal,1800);
})();
