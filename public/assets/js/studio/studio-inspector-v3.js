const STYLE_FIELDS={
  left:'px',top:'px',width:'px',height:'px',minWidth:'px',maxWidth:'px',minHeight:'px',maxHeight:'px',
  marginTop:'px',marginRight:'px',marginBottom:'px',marginLeft:'px',paddingTop:'px',paddingRight:'px',paddingBottom:'px',paddingLeft:'px',
  gap:'px',fontSize:'px',lineHeight:'',letterSpacing:'px',borderWidth:'px',borderRadius:'px',opacity:'',rotate:'deg',scale:''
};
const state={panel:null,node:null,booted:false};
const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
const field=(label,name,type='text',attrs='')=>`<label><span>${label}</span><input type="${type}" data-prop="${name}" ${attrs}></label>`;
const select=(label,name,options)=>`<label><span>${label}</span><select data-prop="${name}">${options.map(value=>`<option value="${value}">${value}</option>`).join('')}</select></label>`;
const section=(title,content)=>`<details open><summary>${title}</summary><div class="studio-inspector-grid">${content}</div></details>`;
function markup(){return `<aside class="studio-inspector-v3" data-studio-inspector aria-label="Studio property inspector">
<header><div><small>EVARA STUDIO</small><h2>Inspector</h2></div><button type="button" data-inspector-close aria-label="Close inspector">×</button></header>
<div class="studio-inspector-selection"><strong data-selected-name>No selection</strong><span data-selected-id>Select an element on the canvas</span></div>
<nav class="studio-inspector-actions">
<button type="button" data-command="undo">Undo</button><button type="button" data-command="redo">Redo</button><button type="button" data-command="duplicate">Duplicate</button><button type="button" data-command="delete">Delete</button>
<button type="button" data-command="front">Front</button><button type="button" data-command="forward">Forward</button><button type="button" data-command="backward">Backward</button><button type="button" data-command="back">Back</button>
</nav>
<div class="studio-inspector-scroll">
${section('Content',`${field('Text','text','text')}${field('Link URL','href','url','placeholder="https://"')}${field('Alt text','alt','text')}`)}
${section('Position & size',`${field('X','left','number')}${field('Y','top','number')}${field('Width','width','number')}${field('Height','height','number')}${field('Min width','minWidth','number')}${field('Max width','maxWidth','number')}${field('Min height','minHeight','number')}${field('Max height','maxHeight','number')}${select('Position','position',['static','relative','absolute','fixed','sticky'])}${select('Display','display',['block','inline-block','flex','grid','none'])}${field('Gap','gap','number')}`)}
${section('Spacing',`${field('Margin top','marginTop','number')}${field('Margin right','marginRight','number')}${field('Margin bottom','marginBottom','number')}${field('Margin left','marginLeft','number')}${field('Padding top','paddingTop','number')}${field('Padding right','paddingRight','number')}${field('Padding bottom','paddingBottom','number')}${field('Padding left','paddingLeft','number')}`)}
${section('Typography',`${field('Font family','fontFamily')}${field('Font size','fontSize','number')}${select('Weight','fontWeight',['300','400','500','600','700','800','900'])}${field('Line height','lineHeight','number','step="0.1"')}${field('Letter spacing','letterSpacing','number','step="0.1"')}${select('Align','textAlign',['left','center','right','justify'])}${select('Transform','textTransform',['none','uppercase','lowercase','capitalize'])}${select('Decoration','textDecoration',['none','underline','line-through'])}${field('Text color','color','color')}`)}
${section('Appearance',`${field('Background','backgroundColor','color')}${field('Border color','borderColor','color')}${field('Border width','borderWidth','number')}${select('Border style','borderStyle',['none','solid','dashed','dotted','double'])}${field('Radius','borderRadius','number')}${field('Opacity','opacity','range','min="0" max="1" step="0.01"')}${field('Shadow','boxShadow','text','placeholder="0 12px 32px rgba(...)"')}${field('Blur','filter','text','placeholder="blur(8px)"')}`)}
${section('Transform',`${field('Rotation','rotate','number')}${field('Scale','scale','number','step="0.01" min="0.1" max="5"')}${field('Transition','transition','text','placeholder="all .2s ease"')}`)}
${section('Media',`${field('Image / video URL','mediaUrl','url')}${select('Object fit','objectFit',['cover','contain','fill','none','scale-down'])}${select('Object position','objectPosition',['center','top','bottom','left','right'])}${select('Loading','loading',['lazy','eager'])}`)}
</div>
<footer><button type="button" data-reset>Reset selected</button><button type="button" class="primary" data-save>Save draft</button></footer>
</aside><button type="button" class="studio-inspector-fab" data-inspector-open>Inspector</button>`}
function mount(){const host=document.createElement('div');host.innerHTML=markup();document.body.append(...host.children);state.panel=document.querySelector('[data-studio-inspector]');bind()}
function cssValue(style,name){const value=style[name];if(!value)return'';const unit=STYLE_FIELDS[name];return unit&&value.endsWith(unit)?value.slice(0,-unit.length):value}
function sync(){
  const node=state.node,style=node?getComputedStyle(node):null;
  state.panel.querySelector('[data-selected-name]').textContent=node?(node.dataset.componentType||node.tagName.toLowerCase()):'No selection';
  state.panel.querySelector('[data-selected-id]').textContent=node?.dataset.nodeId||'Select an element on the canvas';
  state.panel.querySelectorAll('[data-prop]').forEach(input=>{
    const name=input.dataset.prop;let value='';
    if(node){if(name==='text')value=node.matches('input,textarea')?node.value:node.textContent.trim();else if(name==='href')value=node.getAttribute('href')||'';else if(name==='alt')value=node.getAttribute('alt')||'';else if(name==='mediaUrl')value=node.currentSrc||node.getAttribute('src')||'';else if(name==='loading')value=node.getAttribute('loading')||'lazy';else value=cssValue(style,name)}
    if(input.type==='color'&&!/^#[0-9a-f]{6}$/i.test(value))value='#000000';input.value=value;
  });
}
function apply(input){
  const node=state.node;if(!node)return;const name=input.dataset.prop;let value=input.value;
  if(name==='text'){if(node.matches('input,textarea'))node.value=value;else node.textContent=value}
  else if(name==='href')node.setAttribute('href',value);
  else if(name==='alt')node.setAttribute('alt',value);
  else if(name==='mediaUrl'){if(node.matches('img,video,source'))node.setAttribute('src',value);else{let media=node.querySelector('img,video');if(!media){media=document.createElement(/\.(mp4|webm|mov)(\?|$)/i.test(value)?'video':'img');node.append(media)}media.src=value;if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true}}}
  else if(name==='loading')node.setAttribute('loading',value);
  else{const unit=STYLE_FIELDS[name]??'';node.style[name]=value===''?'':`${value}${unit}`}
  window.EvaraStudioCanvas?.pushHistory?.(`Change ${name}`);emit('evara:studio-canvas-changed',{reason:'property',property:name,nodes:[node]});
}
function reset(){if(!state.node)return;state.node.removeAttribute('style');['href','alt','loading'].forEach(name=>state.node.removeAttribute(name));window.EvaraStudioCanvas?.pushHistory?.('Reset element');sync();emit('evara:studio-canvas-changed',{reason:'reset',nodes:[state.node]})}
function saveDraft(){
  const canvas=document.querySelector('[data-studio-canvas]');if(!canvas)return;
  const companyId=window.__EVARA_SESSION__?.companyId||window.__EVARA_COMPANY_ID__||'local';
  const payload={version:3,updatedAt:new Date().toISOString(),html:canvas.innerHTML};
  localStorage.setItem(`evaraos:studio:draft:${companyId}`,JSON.stringify(payload));
  emit('evara:studio-draft-saved',{companyId,payload});
  const button=state.panel.querySelector('[data-save]');const old=button.textContent;button.textContent='Saved';setTimeout(()=>button.textContent=old,1200);
}
function bind(){
  window.addEventListener('evara:studio-selection',event=>{state.node=event.detail?.primary||null;sync();if(state.node)state.panel.classList.add('is-open')});
  state.panel.addEventListener('input',event=>{const input=event.target.closest('[data-prop]');if(input)apply(input)});
  state.panel.addEventListener('change',event=>{const input=event.target.closest('[data-prop]');if(input)apply(input)});
  state.panel.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>emit('evara:studio-command',{command:button.dataset.command})));
  state.panel.querySelector('[data-reset]').addEventListener('click',reset);state.panel.querySelector('[data-save]').addEventListener('click',saveDraft);
  state.panel.querySelector('[data-inspector-close]').addEventListener('click',()=>state.panel.classList.remove('is-open'));
  document.querySelector('[data-inspector-open]').addEventListener('click',()=>state.panel.classList.add('is-open'));
  window.addEventListener('evara:studio-transform-preview',sync);
}
function boot(){if(state.booted)return;state.booted=true;mount();emit('evara:studio-inspector-ready')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
