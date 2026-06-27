(function(){
  var mode="light";
  var imageTheme="light";
  try{
    var stored=JSON.parse(localStorage.getItem("evaraos-appearance")||"{}");
    mode=["light","dark","system","image"].indexOf(stored.mode)>=0?stored.mode:"light";
    imageTheme=stored.imageTheme==="dark"?"dark":"light";
  }catch{}
  var resolved=mode;
  if(mode==="system")resolved=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  if(mode==="image")resolved=imageTheme;
  if(resolved!=="dark")resolved="light";
  var root=document.documentElement;
  root.setAttribute("data-theme",resolved);
  root.setAttribute("data-theme-mode",mode);
  root.style.colorScheme=resolved;
  root.classList.add("boot-pending");
})();
