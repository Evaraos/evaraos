const BLOCKED_PARENT="script,style,template,noscript,option,svg,path,use,canvas,video,audio,picture,img,input,textarea,select";
let observer=null;

function blocked(node){
  const parent=node.parentElement;
  if(!parent)return true;
  if(parent.classList.contains("evara-adaptive-text-node"))return true;
  if(parent.matches(BLOCKED_PARENT))return true;
  if(parent.closest("[data-no-adaptive-text],[contenteditable='true']"))return true;
  return !node.textContent.trim();
}

function wrap(node){
  if(blocked(node))return;
  const parent=node.parentElement;
  parent?.removeAttribute("data-adaptive-text");
  const span=document.createElement("span");
  span.className="evara-adaptive-text-node";
  span.dataset.adaptiveText="pixel";
  node.replaceWith(span);
  span.appendChild(node);
}

function scan(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){return blocked(node)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(wrap);
}

export function installUniversalTextInversion(){
  if(observer)return;
  const start=()=>{
    scan(document.body);
    observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node.nodeType===Node.TEXT_NODE)wrap(node);
          else if(node instanceof HTMLElement)scan(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  };
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
}
