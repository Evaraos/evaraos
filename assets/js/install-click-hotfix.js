(function(){
  function bindInstallButtons(){
    var ids=["evaInstallApple","evaInstallAndroid"];
    ids.forEach(function(id){
      var btn=document.getElementById(id);
      if(!btn||btn.dataset.evaraClickHotfix==="true") return;
      btn.dataset.evaraClickHotfix="true";
      btn.addEventListener("click",function(event){
        event.stopPropagation();
      },true);
    });
  }

  function boot(){
    bindInstallButtons();
    if(document.body){
      new MutationObserver(bindInstallButtons).observe(document.body,{childList:true,subtree:true});
    }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
