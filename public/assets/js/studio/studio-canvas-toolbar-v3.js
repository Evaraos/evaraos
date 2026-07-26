const COMMANDS=[
  ['undo','Undo'],['redo','Redo'],['duplicate','Duplicate'],['delete','Delete'],
  ['lock','Lock'],['hide','Hide'],['front','Front'],['forward','Forward'],['backward','Backward'],['back','Back']
];

const emit=(command)=>window.dispatchEvent(new CustomEvent('evara:studio-command',{detail:{command}}));

function installStyles(){
  if(document.getElementById('studioCanvasToolbarStyles'))return;
  const style=document.createElement('style');
  style.id='studioCanvasToolbarStyles';
  style.textContent=`
    .studio-canvas-toolbar{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:10024;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:9px 11px;border:1px solid rgba(255,255,255,.26);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(8,10,16,.9));box-shadow:0 18px 52px rgba(0,0,0,.34);backdrop-filter:blur(24px) saturate(1.3);color:var(--text-primary,#fff);transform:translateX(-50%)}
    .studio-canvas-toolbar>span{flex:0 0 auto;font-size:11px;font-weight:850;color:var(--text-secondary,rgba(255,255,255,.7))}
    .studio-canvas-toolbar>div{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.studio-canvas-toolbar>div::-webkit-scrollbar{display:none}
    .studio-canvas-toolbar button{flex:0 0 auto;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 9px;background:rgba(255,255,255,.09);color:inherit;font-size:11px;font-weight:850}
    .studio-canvas-toolbar button:disabled{opacity:.34;cursor:not-allowed}
    @media(max-width:760px){.studio-canvas-toolbar{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));max-width:none;transform:none}.studio-canvas-toolbar>span{display:none}.studio-canvas-toolbar>div{width:100%}}
  `;
  document.head.append(style);
}

function setLabel(toolbar,command,label){const button=toolbar.querySelector(`[data-canvas-command="${command}"]`);if(button)button.textContent=label}
function syncSelection(toolbar,nodes=[]){
  const count=nodes.length;
  const allLocked=count>0&&nodes.every(node=>node.dataset.studioLocked==='true');
  const anyHidden=nodes.some(node=>node.dataset.studioHidden==='true');
  toolbar.querySelector('[data-canvas-selection-count]').textContent=count?`${count} selected${allLocked?' · locked':''}`:'Nothing selected';
  toolbar.querySelectorAll('[data-canvas-command]').forEach(button=>{if(!['undo','redo'].includes(button.dataset.canvasCommand))button.disabled=!count});
  const destructive=['delete','front','forward','backward','back'];
  destructive.forEach(command=>{const button=toolbar.querySelector(`[data-canvas-command="${command}"]`);if(button)button.disabled=!count||allLocked});
  setLabel(toolbar,'lock',allLocked?'Unlock':'Lock');
  setLabel(toolbar,'hide',anyHidden?'Show':'Hide');
}

function mount(){
  if(document.querySelector('[data-studio-canvas-toolbar]'))return;
  installStyles();
  const toolbar=document.createElement('div');
  toolbar.className='studio-canvas-toolbar';
  toolbar.dataset.studioCanvasToolbar='true';
  toolbar.setAttribute('role','toolbar');
  toolbar.setAttribute('aria-label','Canvas controls');
  toolbar.innerHTML=`<span data-canvas-selection-count>Nothing selected</span><div>${COMMANDS.map(([command,label])=>`<button type="button" data-canvas-command="${command}">${label}</button>`).join('')}</div>`;
  document.body.append(toolbar);
  toolbar.addEventListener('click',event=>{const button=event.target.closest('[data-canvas-command]');if(button&&!button.disabled)emit(button.dataset.canvasCommand)});
  window.addEventListener('evara:studio-selection',event=>syncSelection(toolbar,event.detail?.nodes||[]));
  window.addEventListener('evara:studio-history',event=>{
    const undo=toolbar.querySelector('[data-canvas-command="undo"]');
    const redo=toolbar.querySelector('[data-canvas-command="redo"]');
    if(undo)undo.disabled=!event.detail?.canUndo;
    if(redo)redo.disabled=!event.detail?.canRedo;
  });
  toolbar.querySelectorAll('[data-canvas-command]').forEach(button=>button.disabled=true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
