const form=document.getElementById('evaAiPageForm');
const input=document.getElementById('evaAiPageInput');
const thread=document.getElementById('evaAiThread');
const suggestions=document.querySelectorAll('[data-ai-prompt]');
const newChat=document.getElementById('evaAiNewChat');
const plusButton=document.getElementById('evaAiPlus');
const imageInput=document.getElementById('evaAiImageInput');
let thinkingCard=null;
let submitLock=false;
let pendingImages=[];
function markReady(){document.body?.classList.remove('app-loading');document.body?.classList.add('app-ready');window.EvaraLoader?.markAppReady?.();}
function autoGrow(){if(!input)return;input.style.height='auto';const nextHeight=Math.min(input.scrollHeight,128);input.style.height=`${nextHeight}px`;}
function scrollToLatest(node,behavior='auto'){if(!node)return;requestAnimationFrame(()=>{try{node.scrollIntoView({behavior,block:'nearest'});}catch{}});}
function appendMessage(role,text,options={}){if(!thread||!String(text||'').trim())return null;const card=document.createElement('article');card.className=`eva-ai-message-card ${role}`;const avatar=document.createElement('div');avatar.className='eva-ai-avatar';avatar.textContent=role==='user'?'You':'AI';const bubble=document.createElement('div');bubble.className='eva-ai-bubble';const p=document.createElement('p');p.textContent=text;bubble.appendChild(p);card.appendChild(avatar);card.appendChild(bubble);thread.appendChild(card);scrollToLatest(card,options.smooth?'smooth':'auto');return card;}
function appendImageMessage(files=[]){if(!thread||!files.length)return null;const card=document.createElement('article');card.className='eva-ai-message-card user has-attachments';const avatar=document.createElement('div');avatar.className='eva-ai-avatar';avatar.textContent='You';const bubble=document.createElement('div');bubble.className='eva-ai-bubble eva-ai-attachment-bubble';const label=document.createElement('p');label.textContent=files.length===1?'Image added':'Images added';const grid=document.createElement('div');grid.className='eva-ai-attachment-grid';files.forEach((file)=>{const item=document.createElement('figure');item.className='eva-ai-attachment-card';const img=document.createElement('img');img.alt=file.name||'Uploaded image';img.src=URL.createObjectURL(file);img.addEventListener('load',()=>URL.revokeObjectURL(img.src),{once:true});const cap=document.createElement('figcaption');cap.textContent=file.name||'Image';item.appendChild(img);item.appendChild(cap);grid.appendChild(item);});bubble.appendChild(label);bubble.appendChild(grid);card.appendChild(bubble);card.appendChild(avatar);thread.appendChild(card);scrollToLatest(card,'smooth');return card;}
function showThinking(){removeThinking();thinkingCard=appendMessage('assistant','Thinking...');}
function removeThinking(){thinkingCard?.remove?.();thinkingCard=null;}
function fakeAiResponse(prompt){const normalized=prompt.toLowerCase();if(normalized.includes('build'))return'Next build priority: finalize dashboards, connect Firebase live data, and add AI actions.';if(normalized.includes('ui'))return'For UI polish, prioritize stable nav spacing and shared shell layouts.';if(pendingImages.length)return'I received the image preview. Next step is connecting this to real multimodal AI analysis and storage.';return'I’m ready. Tell me what part of Evaraos you want to build, fix, or improve next.';}
function setBusy(isBusy){submitLock=Boolean(isBusy);form?.classList.toggle('is-busy',submitLock);}
function submitPrompt(promptText){if(submitLock)return;const value=String(promptText||input?.value||'').trim();if(!value&&!pendingImages.length)return;setBusy(true);if(value)appendMessage('user',value);if(input){input.value='';autoGrow();}showThinking();window.setTimeout(()=>{removeThinking();appendMessage('assistant',fakeAiResponse(value));pendingImages=[];setBusy(false);},360);}
function resetChat(){if(!thread)return;removeThinking();setBusy(false);pendingImages=[];thread.innerHTML='';appendMessage('assistant','Fresh workspace opened. What do you want to build or fix next?');}
function openImagePicker(){imageInput?.click();}
function handleImageSelection(event){const files=Array.from(event.target?.files||[]).filter((file)=>file.type.startsWith('image/'));if(!files.length)return;pendingImages=files;appendImageMessage(files);if(input&&!input.value.trim())input.placeholder='Ask Evaraos AI about this image...';event.target.value='';}
form?.addEventListener('submit',(event)=>{event.preventDefault();submitPrompt();});
input?.addEventListener('input',autoGrow);
input?.addEventListener('focus',()=>{document.body?.classList.add('ai-keyboard-active');});
input?.addEventListener('blur',()=>{window.setTimeout(()=>document.body?.classList.remove('ai-keyboard-active'),120);});
input?.addEventListener('keydown',(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitPrompt();}});
suggestions.forEach((button)=>button.addEventListener('click',()=>submitPrompt(button.dataset.aiPrompt||'')));
newChat?.addEventListener('click',resetChat);
plusButton?.addEventListener('click',openImagePicker);
imageInput?.addEventListener('change',handleImageSelection);
window.addEventListener('pageshow',markReady,{once:true});
window.addEventListener('load',markReady,{once:true});
autoGrow();
markReady();