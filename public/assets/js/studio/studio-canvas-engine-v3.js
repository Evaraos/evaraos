const EDITABLE_SELECTOR='[data-node-id]';
const CANVAS_SELECTOR='.studio-node-grid,.studio-canvas-page,[data-studio-canvas]';
const HISTORY_LIMIT=100;
const SNAP_DISTANCE=8;

const state={canvas:null,selected:[],primary:null,history:[],future:[],drag:null,resize:null,clipboard:null,booted:false,observer:null};

const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
const uid=()=>`studio-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const px=value=>Number.parseFloat(value)||0;
const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);
const isLocked=node=>node?.dataset?.studioLocked==='true'||node?.getAttribute?.('aria-disabled')==='true';

function getCanvas(){return document.querySelector(CANVAS_SELECTOR)}
function getNodes(){return [...(state.canvas?.querySelectorAll(EDITABLE_SELECTOR)||[])]}
function nodeId(node){if(!node.dataset.nodeId)node.dataset.nodeId=uid();return node.dataset.nodeId}
function snapshot(){return state.canvas?.innerHTML||''}
function pushHistory(label='Change'){
  if(!state.canvas)return;
  const html=snapshot();
  if(state.history.at(-1)?.html===html)return;
  state.history.push({label,html});
  if(state.history.length>HISTORY_LIMIT)state.history.shift();
  state.future.length=0;
  emit('evara:studio-history',{canUndo:state.history.length>1,canRedo:false,label});
}
function restore(html){
  if(!state.canvas)return;
  clearSelection();
  state.canvas.innerHTML=html;
  getNodes().forEach(nodeId);
  emit('evara:studio-canvas-changed',{reason:'history'});
}
function undo(){if(state.history.length<2)return;state.future.push(state.history.pop());restore(state.history.at(-1).html);emit('evara:studio-history',{canUndo:state.history.length>1,canRedo:true})}
function redo(){const next=state.future.pop();if(!next)return;state.history.push(next);restore(next.html);emit('evara:studio-history',{canUndo:state.history.length>1,canRedo:state.future.length>0})}

function clearSelection(){state.selected.forEach(node=>node.classList.remove('studio-canvas-selected'));state.selected=[];state.primary=null;document.querySelector('[data-studio-transform-box]')?.remove();emit('evara:studio-selection',{nodes:[],primary:null})}
function select(node,{add=false}={}){
  if(!node||!state.canvas?.contains(node)||isLocked(node))return;
  if(!add)clearSelection();
  if(add&&state.selected.includes(node)){node.classList.remove('studio-canvas-selected');state.selected=state.selected.filter(item=>item!==node);state.primary=state.selected.at(-1)||null}else{state.selected.push(node);state.primary=node;node.classList.add('studio-canvas-selected')}
  renderTransformBox();emit('evara:studio-selection',{nodes:state.selected,primary:state.primary});
}
function renderTransformBox(){
  document.querySelector('[data-studio-transform-box]')?.remove();
  if(!state.primary||isLocked(state.primary))return;
  const box=document.createElement('div');box.dataset.studioTransformBox='true';box.className='studio-transform-box';
  ['nw','n','ne','e','se','s','sw','w'].forEach(direction=>{const handle=document.createElement('button');handle.type='button';handle.dataset.resizeHandle=direction;handle.className=`studio-resize-handle is-${direction}`;handle.setAttribute('aria-label',`Resize ${direction}`);box.append(handle)});
  document.body.append(box);positionTransformBox();
}
function positionTransformBox(){const box=document.querySelector('[data-studio-transform-box]');if(!box||!state.primary?.isConnected)return;const rect=state.primary.getBoundingClientRect();Object.assign(box.style,{left:`${rect.left+scrollX}px`,top:`${rect.top+scrollY}px`,width:`${rect.width}px`,height:`${rect.height}px`})}
function ensurePositioned(node){if(getComputedStyle(node).position==='static')node.style.position='relative'}
function snap(value,targets=[]){for(const target of targets)if(Math.abs(value-target)<=SNAP_DISTANCE)return target;return value}
function snapPosition(node,left,top){
  const canvasRect=state.canvas.getBoundingClientRect();const rect=node.getBoundingClientRect();const maxLeft=Math.max(0,canvasRect.width-rect.width),maxTop=Math.max(0,canvasRect.height-rect.height);
  const siblings=getNodes().filter(item=>item!==node&&!state.selected.includes(item));
  const xTargets=[0,maxLeft,maxLeft/2],yTargets=[0,maxTop,maxTop/2];
  siblings.forEach(item=>{const r=item.getBoundingClientRect();const relLeft=r.left-canvasRect.left,relTop=r.top-canvasRect.top;xTargets.push(relLeft,relLeft+r.width,relLeft+(r.width-rect.width)/2);yTargets.push(relTop,relTop+r.height,relTop+(r.height-rect.height)/2)});
  return {left:clamp(snap(left,xTargets),-rect.width+24,canvasRect.width-24),top:clamp(snap(top,yTargets),-rect.height+24,canvasRect.height-24)};
}
function beginDrag(event,node){
  if(event.button!==0||isLocked(node)||event.target.closest('input,textarea,select,button,a,[contenteditable=true]'))return;
  if(!state.selected.includes(node))select(node,{add:event.shiftKey});
  if(!state.selected.length)return;
  const starts=state.selected.map(item=>({node:item,left:px(item.style.left),top:px(item.style.top)}));
  state.drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,starts};state.selected.forEach(ensurePositioned);document.body.classList.add('studio-is-transforming');event.target.setPointerCapture?.(event.pointerId);event.preventDefault();
}
function moveDrag(event){if(!state.drag||event.pointerId!==state.drag.pointerId)return;const dx=event.clientX-state.drag.x,dy=event.clientY-state.drag.y;state.drag.starts.forEach(({node,left,top})=>{const next=snapPosition(node,left+dx,top+dy);node.style.left=`${Math.round(next.left)}px`;node.style.top=`${Math.round(next.top)}px`});positionTransformBox();emit('evara:studio-transform-preview',{type:'move',nodes:state.selected})}
function endDrag(event){if(!state.drag||event&&event.pointerId!==state.drag.pointerId)return;state.drag=null;document.body.classList.remove('studio-is-transforming');pushHistory('Move elements');emit('evara:studio-canvas-changed',{reason:'move',nodes:state.selected})}
function beginResize(event,handle){if(!state.primary||isLocked(state.primary))return;const node=state.primary,rect=node.getBoundingClientRect();ensurePositioned(node);state.resize={pointerId:event.pointerId,direction:handle.dataset.resizeHandle,x:event.clientX,y:event.clientY,node,width:rect.width,height:rect.height,left:px(node.style.left),top:px(node.style.top),ratio:rect.width/Math.max(rect.height,1)};document.body.classList.add('studio-is-transforming');handle.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopPropagation()}
function moveResize(event){
  const r=state.resize;if(!r||event.pointerId!==r.pointerId)return;let dx=event.clientX-r.x,dy=event.clientY-r.y,width=r.width,height=r.height,left=r.left,top=r.top;
  if(r.direction.includes('e'))width=r.width+dx;if(r.direction.includes('s'))height=r.height+dy;if(r.direction.includes('w')){width=r.width-dx;left=r.left+dx}if(r.direction.includes('n')){height=r.height-dy;top=r.top+dy}
  if(event.shiftKey){if(Math.abs(dx)>Math.abs(dy))height=width/r.ratio;else width=height*r.ratio}
  width=clamp(width,24,4000);height=clamp(height,24,4000);Object.assign(r.node.style,{width:`${Math.round(width)}px`,height:`${Math.round(height)}px`,left:`${Math.round(left)}px`,top:`${Math.round(top)}px`});positionTransformBox();emit('evara:studio-transform-preview',{type:'resize',nodes:[r.node]});
}
function endResize(event){if(!state.resize||event&&event.pointerId!==state.resize.pointerId)return;state.resize=null;document.body.classList.remove('studio-is-transforming');pushHistory('Resize element');emit('evara:studio-canvas-changed',{reason:'resize',nodes:[state.primary]})}
function duplicate(){if(!state.selected.length)return;const copies=state.selected.map(node=>{const copy=node.cloneNode(true);copy.dataset.nodeId=uid();copy.style.left=`${px(node.style.left)+16}px`;copy.style.top=`${px(node.style.top)+16}px`;node.after(copy);return copy});clearSelection();copies.forEach((node,index)=>select(node,{add:index>0}));pushHistory('Duplicate elements');emit('evara:studio-canvas-changed',{reason:'duplicate',nodes:copies})}
function removeSelected(){if(!state.selected.length)return;const removed=[...state.selected];clearSelection();removed.forEach(node=>node.remove());pushHistory('Delete elements');emit('evara:studio-canvas-changed',{reason:'delete'})}
function layer(action){state.selected.filter(node=>!isLocked(node)).forEach(node=>{if(action==='front')node.parentElement.append(node);if(action==='back')node.parentElement.prepend(node);if(action==='forward'&&node.nextElementSibling)node.nextElementSibling.after(node);if(action==='backward'&&node.previousElementSibling)node.previousElementSibling.before(node)});pushHistory(`Layer ${action}`);positionTransformBox();emit('evara:studio-canvas-changed',{reason:'layer'})}
function copy(){if(state.selected.length)state.clipboard=state.selected.map(node=>node.outerHTML)}
function paste(){if(!state.clipboard?.length||!state.canvas)return;const nodes=state.clipboard.map(html=>{const template=document.createElement('template');template.innerHTML=html.trim();const node=template.content.firstElementChild;if(!node)return null;node.dataset.nodeId=uid();node.style.left=`${px(node.style.left)+20}px`;node.style.top=`${px(node.style.top)+20}px`;state.canvas.append(node);return node}).filter(Boolean);clearSelection();nodes.forEach((node,index)=>select(node,{add:index>0}));pushHistory('Paste elements');emit('evara:studio-canvas-changed',{reason:'paste',nodes})}
function nudge(dx,dy){if(!state.selected.length)return;state.selected.filter(node=>!isLocked(node)).forEach(node=>{ensurePositioned(node);node.style.left=`${px(node.style.left)+dx}px`;node.style.top=`${px(node.style.top)+dy}px`});positionTransformBox();pushHistory('Nudge elements');emit('evara:studio-canvas-changed',{reason:'nudge',nodes:state.selected})}
function toggleLock(){state.selected.forEach(node=>{node.dataset.studioLocked=node.dataset.studioLocked==='true'?'false':'true'});clearSelection();pushHistory('Toggle element lock')}
function toggleHidden(){state.selected.forEach(node=>{node.dataset.studioHidden=node.dataset.studioHidden==='true'?'false':'true';node.hidden=node.dataset.studioHidden==='true'});clearSelection();pushHistory('Toggle element visibility')}
function onKey(event){const typing=event.target.matches('input,textarea,select,[contenteditable=true]');const command=event.metaKey||event.ctrlKey;const key=event.key.toLowerCase();if(command&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return}if(command&&key==='c'&&!typing){copy();return}if(command&&key==='v'&&!typing){event.preventDefault();paste();return}if(command&&key==='d'&&!typing){event.preventDefault();duplicate();return}if(!typing&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();removeSelected();return}if(!typing&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const step=event.shiftKey?10:1;nudge(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)}}
function bind(){
  document.addEventListener('pointerdown',event=>{const handle=event.target.closest('[data-resize-handle]');if(handle){beginResize(event,handle);return}const node=event.target.closest(EDITABLE_SELECTOR);if(node&&state.canvas?.contains(node))beginDrag(event,node);else if(!event.target.closest('[data-studio-inspector],[data-studio-transform-box]'))clearSelection()},true);
  document.addEventListener('pointermove',event=>{moveDrag(event);moveResize(event)},true);document.addEventListener('pointerup',event=>{endDrag(event);endResize(event)},true);document.addEventListener('pointercancel',event=>{endDrag(event);endResize(event)},true);document.addEventListener('keydown',onKey);
  window.addEventListener('resize',positionTransformBox);window.addEventListener('scroll',positionTransformBox,true);
  window.addEventListener('evara:studio-command',event=>{const command=event.detail?.command;if(command==='undo')undo();if(command==='redo')redo();if(command==='duplicate')duplicate();if(command==='delete')removeSelected();if(command==='lock')toggleLock();if(command==='hide')toggleHidden();if(['front','back','forward','backward'].includes(command))layer(command)});
}
function watchCanvas(){state.observer?.disconnect();state.observer=new MutationObserver(()=>{const next=getCanvas();if(next&&next!==state.canvas){state.canvas=next;state.canvas.dataset.studioCanvas='true';getNodes().forEach(nodeId);clearSelection();pushHistory('Canvas reloaded');emit('evara:studio-canvas-ready',{canvas:state.canvas})}});state.observer.observe(document.getElementById('appRoot')||document.body,{childList:true,subtree:true})}
function boot(){if(state.booted)return;state.canvas=getCanvas();if(!state.canvas)return setTimeout(boot,300);state.booted=true;state.canvas.dataset.studioCanvas='true';getNodes().forEach(nodeId);bind();watchCanvas();pushHistory('Initial canvas');emit('evara:studio-canvas-ready',{canvas:state.canvas})}
window.EvaraStudioCanvas={select,clearSelection,undo,redo,duplicate,removeSelected,layer,pushHistory,toggleLock,toggleHidden,getState:()=>state};
window.addEventListener('evara:session-ready',()=>setTimeout(boot,350));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600),{once:true});else setTimeout(boot,600);
