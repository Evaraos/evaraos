const TEXT_ELEMENTS="h1,h2,h3,h4,h5,h6,p,label,legend,caption,small,strong,b,em,i,span,li,dt,dd,td,th,blockquote,figcaption,code,kbd,time,mark,summary,a,button,[role='button']";
const INTERACTIVE="a,button,[role='button']";
let observer=null;

function excluded(element){
  return !element||element.closest("[data-no-adaptive-text],script,style,template,option,[contenteditable='true']");
}

function ownTextNodes(element){
  return [...element.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim().length>0);
}

function wrapInteractiveText(element){
  for(const node of ownTextNodes(element)){
    const wrapper=document.createElement("span");
    wrapper.className="evara-adaptive-text-node";
    wrapper.dataset.adaptiveText="pixel";
    node.replaceWith(wrapper);
    wrapper.appendChild(node);
  }
}

function markElement(element){
  if(!(element instanceof HTMLElement)||excluded(element))return;
  if(element.matches(INTERACTIVE)){
    wrapInteractiveText(element);
    return;
  }
  if(!ownTextNodes(element).length)return;
  element.dataset.adaptiveText="pixel";
}

function scan(root=document){
  if(root instanceof HTMLElement&&root.matches(TEXT_ELEMENTS))markElement(root);
  root.querySelectorAll?.(TEXT_ELEMENTS).forEach(markElement);
}

export function installUniversalTextInversion(){
  if(observer)return;
  const start=()=>{
    scan(document);
    observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node instanceof HTMLElement)scan(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  };
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
}
