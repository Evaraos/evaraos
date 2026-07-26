const COMMANDS=[
  ['undo','Undo'],['redo','Redo'],['duplicate','Duplicate'],['delete','Delete'],
  ['lock','Lock'],['hide','Hide'],['front','Front'],['forward','Forward'],['backward','Backward'],['back','Back']
];

const emit=(command)=>window.dispatchEvent(new CustomEvent('evara:studio-command',{detail:{command}}));

function mount(){
  if(document.querySelector('[data-studio-canvas-toolbar]'))return;
  const toolbar=document.createElement('div');
  toolbar.className='studio-canvas-toolbar';
  toolbar.dataset.studioCanvasToolbar='true';
  toolbar.setAttribute('role','toolbar');
  toolbar.setAttribute('aria-label','Canvas controls');
  toolbar.innerHTML=`<span data-canvas-selection-count>Nothing selected</span><div>${COMMANDS.map(([command,label])=>`<button type="button" data-canvas-command="${command}">${label}</button>`).join('')}</div>`;
  document.body.append(toolbar);
  toolbar.addEventListener('click',event=>{const button=event.target.closest('[data-canvas-command]');if(button&&!button.disabled)emit(button.dataset.canvasCommand)});
  window.addEventListener('evara:studio-selection',event=>{
    const count=event.detail?.nodes?.length||0;
    toolbar.querySelector('[data-canvas-selection-count]').textContent=count?`${count} selected`:'Nothing selected';
    toolbar.querySelectorAll('[data-canvas-command]').forEach(button=>{if(!['undo','redo'].includes(button.dataset.canvasCommand))button.disabled=!count});
  });
  window.addEventListener('evara:studio-history',event=>{
    const undo=toolbar.querySelector('[data-canvas-command="undo"]');
    const redo=toolbar.querySelector('[data-canvas-command="redo"]');
    if(undo)undo.disabled=!event.detail?.canUndo;
    if(redo)redo.disabled=!event.detail?.canRedo;
  });
  toolbar.querySelectorAll('[data-canvas-command]').forEach(button=>button.disabled=true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
