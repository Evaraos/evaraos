const GLASS_SELECTORS=[
  'main section','main article','aside section','[class*="panel"]','[class*="card"]','[class*="sheet"]','[class*="modal"]','[class*="drawer"]','[class*="popover"]','[class*="toolbar"]','[class*="composer"]'
];
const INTERACTIVE_SELECTORS=['button','a.btn','[role="button"]','[class*="card"]','[class*="item"]'];

function eligible(node){
  if(!(node instanceof HTMLElement))return false;
  if(node.closest('svg,canvas,table,thead,tbody,tr,ul,ol'))return false;
  if(node.matches('body,html,main,form,label,input,textarea,select,option'))return false;
  const rect=node.getBoundingClientRect();
  return rect.width>80&&rect.height>34;
}

function applyGlass(root=document){
  for(const selector of GLASS_SELECTORS){
    root.querySelectorAll?.(selector).forEach(node=>{
      if(!eligible(node))return;
      if(node.classList.contains('messages-feed')||node.classList.contains('conversation-list'))return;
      node.dataset.ios27Glass='true';
    });
  }
  for(const selector of INTERACTIVE_SELECTORS){
    root.querySelectorAll?.(selector).forEach(node=>{
      if(!eligible(node))return;
      node.dataset.ios27Interactive='true';
    });
  }
}

function init(){
  document.documentElement.dataset.ios27='active';
  applyGlass();
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node instanceof HTMLElement){
          if(eligible(node))applyGlass(node.parentElement||document);
        }
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('evara:theme-applied',()=>applyGlass(),{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
