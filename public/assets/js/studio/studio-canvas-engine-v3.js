const EDITABLE_SELECTOR='[data-node-id]';
const CANVAS_SELECTOR='.studio-node-grid,.studio-canvas-page,[data-studio-canvas]';
const HISTORY_LIMIT=100;

const state={canvas:null,selected:[],primary:null,history:[],future:[],drag:null,resize:null,clipboard:null,booted:false};

const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
const uid=()=>`studio-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const px=value=>Number.parseFloat(value)||0;
const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);

function getCanvas(){return document.querySelector(CANVAS_SELECTOR)}
function getNodes(){return [...(state.canvas?.querySelectorAll(EDITABLE_SELECTOR)||[])]}
function nodeId(node){if(!node.dataset.nodeId)node.dataset.nodeId=uid();return node.dataset.nodeId}
function nodeSnapshot(node){
  return {id:nodeId(node),html:node.outerHTML,index:[...node.parentElement.children].indexOf(node)};
}
function documentSnapshot(){return getNodes().map(nodeSnapshot)}
function pushHistory(label='Change'){
  const snapshot=JSON.stringify(documentSnapshot());
  if(state.history.at(-1)?.snapshot===snapshot)return;
  state.history.push({label,snapshot});
  if(state.history.length>HISTORY_LIMIT)state.history.shift();
  state.future.length=0;
  emit('evara:studio-history',{canUndo:state.history.length>1,canRedo:false,label});
}
function restore(snapshot){
  if(!state.canvas)return;
  state.canvas.querySelectorAll(EDITABLE_SELECTOR).forEach(node=>node.remove());
  JSON.parse(snapshot).forEach(item=>{
    const template=document.createElement('template');
    template.innerHTML=item.html.trim();
    const node=template.content.firstElementChild;
    if(node)state.canvas.append(node);
  });
  clearSelection();
  emit('evara:studio-canvas-changed',{reason:'history'});
}
function undo(){if(state.history.length<2)return;state.future.push(state.history.pop());restore(state.history.at(-1).snapshot);emit('evara:studio-history',{canUndo:state.history.length>1,canRedo:true})}
function redo(){const next=state.future.pop();if(!next)return;state.history.push(next);restore(next.snapshot);emit('evara:studio-history',{canUndo:state.history.length>1,canRedo:state.future.length>0})}

function clearSelection(){state.selected.forEach(node=>node.classList.remove('studio-canvas-selected'));state.selected=[];state.primary=null;document.querySelector('[data-studio-transform-box]')?.remove();emit('evara:studio-selection',{nodes:[],primary:null})}
function select(node,{add=false}={}){
  if(!node||!state.canvas?.contains(node))return;
  if(!add)clearSelection();
  if(add&&state.selected.includes(node)){node.classList.remove('studio-canvas-selected');state.selected=state.selected.filter(item=>item!==node);state.primary=state.selected.at(-1)||null}else{
    state.selected.push(node);state.primary=node;node.classList.add('studio-canvas-selected');
  }
  renderTransformBox();
  emit('evara:studio-selection',{nodes:state.selected,primary:state.primary});
}
function renderTransformBox(){
  document.querySelector('[data-studio-transform-box]')?.remove();
  if(!state.primary)return;
  const box=document.createElement('div');
  box.dataset.studioTransformBox='true';
  box.className='studio-transform-box';
  ['nw','n','ne','e','se','s','sw','w'].forEach(direction=>{
    const handle=document.createElement('button');
    handle.type='button';handle.dataset.resizeHandle=direction;handle.className=`studio-resize-handle is-${direction}`;handle.setAttribute('aria-label',`Resize ${direction}`);box.append(handle);
  });
  document.body.append(box);positionTransformBox();
}
function positionTransformBox(){
  const box=document.querySelector('[data-studio-transform-box]');
  if(!box||!state.primary?.isConnected)return;
  const rect=state.primary.getBoundingClientRect();
  Object.assign(box.style,{left:`${rect.left+scrollX}px`,top:`${rect.top+scrollY}px`,width:`${rect.width}px`,height:`${rect.height}px`});
}
function ensurePositioned(node){const style=getComputedStyle(node);if(style.position==='static')node.style.position='relative'}
function beginDrag(event,node){
  if(event.button!==0||event.target.closest('input,textarea,select,button,a,[contenteditable=true]'))return;
  if(!state.selected.includes(node))select(node,{add:event.shiftKey});
  const starts=state.selected.map(item=>({node:item,left:px(item.style.left),top:px(item.style.top)}));
  state.drag={x:event.clientX,y:event.clientY,starts};
  state.selected.forEach(ensurePositioned);document.body.classList.add('studio-is-transforming');event.preventDefault();
}
function moveDrag(event){
  if(!state.drag)return;
  const dx=event.clientX-state.drag.x,dy=event.clientY-state.drag.y;
  state.drag.starts.forEach(({node,left,top})=>{node.style.left=`${Math.round(left+dx)}px`;node.style.top=`${Math.round(top+dy)}px`});
  positionTransformBox();emit('evara:studio-transform-preview',{type:'move',nodes:state.selected});
}
function endDrag(){if(!state.drag)return;state.drag=null;document.body.classList.remove('studio-is-transforming');pushHistory('Move elements');emit('evara:studio-canvas-changed',{reason:'move',nodes:state.selected})}
function beginResize(event,handle){
  if(!state.primary)return;
  const node=state.primary,rect=node.getBoundingClientRect();ensurePositioned(node);
  state.resize={direction:handle.dataset.resizeHandle,x:event.clientX,y:event.clientY,node,width:rect.width,height:rect.height,left:px(node.style.left),top:px(node.style.top),ratio:rect.width/Math.max(rect.height,1)};
  document.body.classList.add('studio-is-transforming');event.preventDefault();event.stopPropagation();
}
function moveResize(event){
  const r=state.resize;if(!r)return;
  let dx=event.clientX-r.x,dy=event.clientY-r.y,width=r.width,height=r.height,left=r.left,top=r.top;
  if(r.direction.includes('e'))width=r.width+dx;
  if(r.direction.includes('s'))height=r.height+dy;
  if(r.direction.includes('w')){width=r.width-dx;left=r.left+dx}
  if(r.direction.includes('n')){height=r.height-dy;top=r.top+dy}
  if(event.shiftKey){if(Math.abs(dx)>Math.abs(dy))height=width/r.ratio;else width=height*r.ratio}
  width=clamp(width,24,4000);height=clamp(height,24,4000);
  Object.assign(r.node.style,{width:`${Math.round(width)}px`,height:`${Math.round(height)}px`,left:`${Math.round(left)}px`,top:`${Math.round(top)}px`});
  positionTransformBox();emit('evara:studio-transform-preview',{type:'resize',nodes:[r.node]});
}
function endResize(){if(!state.resize)return;state.resize=null;document.body.classList.remove('studio-is-transforming');pushHistory('Resize element');emit('evara:studio-canvas-changed',{reason:'resize',nodes:[state.primary]})}

function duplicate(){
  if(!state.selected.length)return;
  const copies=state.selected.map(node=>{const copy=node.cloneNode(true);copy.dataset.nodeId=uid();copy.style.left=`${px(node.style.left)+16}px`;copy.style.top=`${px(node.style.top)+16}px`;node.after(copy);return copy});
  clearSelection();copies.forEach((node,index)=>select(node,{add:index>0}));pushHistory('Duplicate elements');emit('evara:studio-canvas-changed',{reason:'duplicate',nodes:copies});
}
function removeSelected(){if(!state.selected.length)return;const removed=[...state.selected];clearSelection();removed.forEach(node=>node.remove());pushHistory('Delete elements');emit('evara:studio-canvas-changed',{reason:'delete'})}
function layer(action){
  state.selected.forEach(node=>{if(action==='front')node.parentElement.append(node);if(action==='back')node.parentElement.prepend(node);if(action==='forward'&&node.nextElementSibling)node.nextElementSibling.after(node);if(action==='backward'&&node.previousElementSibling)node.previousElementSibling.before(node)});
  pushHistory(`Layer ${action}`);positionTransformBox();emit('evara:studio-canvas-changed',{reason:'layer'});
}
function copy(){if(!state.selected.length)return;state.clipboard=state.selected.map(node=>node.outerHTML)}
function paste(){if(!state.clipboard?.length||!state.canvas)return;const nodes=state.clipboard.map(html=>{const template=document.createElement('template');template.innerHTML=html.trim();const node=template.content.firstElementChild;node.dataset.nodeId=uid();node.style.left=`${px(node.style.left)+20}px`;node.style.top=`${px(node.style.top)+20}px`;state.canvas.append(node);return node});clearSelection();nodes.forEach((node,index)=>select(node,{add:index>0}));pushHistory('Paste elements')}

function onKey(event){
  const typing=event.target.matches('input,textarea,select,[contenteditable=true]');
  const command=event.metaKey||event.ctrlKey;
  if(command&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return}
  if(command&&event.key.toLowerCase()==='c'&&!typing){copy();return}
  if(command&&event.key.toLowerCase()==='v'&&!typing){event.preventDefault();paste();return}
  if(command&&event.key.toLowerCase()==='d'&&!typing){event.preventDefault();duplicate();return}
  if(!typing&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();removeSelected()}
}
function bind(){
  document.addEventListener('pointerdown',event=>{const handle=event.target.closest('[data-resize-handle]');if(handle){beginResize(event,handle);return}const node=event.target.closest(EDITABLE_SELECTOR);if(node&&state.canvas?.contains(node))beginDrag(event,node);else if(!event.target.closest('[data-studio-inspector]'))clearSelection()},true);
  document.addEventListener('pointermove',event=>{moveDrag(event);moveResize(event)},true);
  document.addEventListener('pointerup',()=>{endDrag();endResize()},true);
  document.addEventListener('keydown',onKey);
  window.addEventListener('resize',positionTransformBox);window.addEventListener('scroll',positionTransformBox,true);
  window.addEventListener('evara:studio-command',event=>{const command=event.detail?.command;if(command==='undo')undo();if(command==='redo')redo();if(command==='duplicate')duplicate();if(command==='delete')removeSelected();if(['front','back','forward','backward'].includes(command))layer(command)});
}
function boot(){
  if(state.booted)return;state.canvas=getCanvas();if(!state.canvas)return setTimeout(boot,400);
  state.booted=true;state.canvas.dataset.studioCanvas='true';getNodes().forEach(nodeId);bind();pushHistory('Initial canvas');emit('evara:studio-canvas-ready',{canvas:state.canvas});
}
window.EvaraStudioCanvas={select,clearSelection,undo,redo,duplicate,removeSelected,layer,pushHistory,getState:()=>state};
window.addEventListener('evara:session-ready',()=>setTimeout(boot,500));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,800),{once:true});else setTimeout(boot,800);
