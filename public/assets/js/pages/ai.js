const form=document.getElementById('evaAiPageForm');
const input=document.getElementById('evaAiPageInput');
const thread=document.getElementById('evaAiThread');
const suggestions=document.querySelectorAll('[data-ai-prompt]');
const newChat=document.getElementById('evaAiNewChat');
const plusButton=document.getElementById('evaAiPlus');
let thinkingCard=null;
let submitLock=false;
function markReady(){document.body?.classList.remove('app-loading');document.body?.classList.add('app-ready');window.EvaraLoader?.markAppReady?.();}
function autoGrow(){if(!input)return;input.style.height='auto';const nextHeight=Math.min(input.scrollHeight,128);input.style.height=`${nextHeight}px`;}
function scrollToLatest(node,behavior='auto'){if(!node)return;requestAnimationFrame(()=>{try{node.scrollIntoView({behavior,block:'nearest'});}catch{}});}
function appendMessage(role,text,options={}){if(!thread||!String(text||'').trim())return null;const card=document.createElement('article');card.className=`eva-ai-message-card ${role}`;const avatar=document.createElement('div');avatar.className='eva-ai-avatar';avatar.textContent=role==='user'?'You':'AI';const bubble=document.createElement('div');bubble.className='eva-ai-bubble';const p=document.createElement('p');p.textContent=text;bubble.appendChild(p);card.appendChild(avatar);card.appendChild(bubble);thread.appendChild(card);scrollToLatest(card,options.smooth?'smooth':'auto');return card;}
function showThinking(){removeThinking();thinkingCard=appendMessage('assistant','Thinking...');}
function removeThinking(){thinkingCard?.remove?.();thinkingCard=null;}
function fakeAiResponse(prompt){const normalized=prompt.toLowerCase();if(normalized.includes('build'))return'Next build priority: finalize dashboards, connect Firebase live data, and add AI actions.';if(normalized.includes('ui'))return'For UI polish, prioritize stable nav spacing and shared shell layouts.';return'I’m ready. Tell me what part of Evaraos you want to build, fix, or improve next.';}
function setBusy(isBusy){submitLock=Boolean(isBusy);form?.classList.toggle('is-busy',submitLock);}
function submitPrompt(promptText){if(submitLock)return;const value=String(promptText||input?.value||'').trim();if(!value)return;setBusy(true);appendMessage('user',value);if(input){input.value='';autoGrow();}showThinking();window.setTimeout(()=>{removeThinking();appendMessage('assistant',fakeAiResponse(value));setBusy(false);},360);}
function resetChat(){if(!thread)return;removeThinking();setBusy(false);thread.innerHTML='';appendMessage('assistant','Fresh workspace opened. What do you want to build or fix next?');}
function handlePlusTools(){const actions=['Upload support coming next.','Voice command mode will connect here.','Image AI tools will appear here soon.'];const randomAction=actions[Math.floor(Math.random()*actions.length)];appendMessage('assistant',randomAction,{smooth:true});}
form?.addEventListener('submit',(event)=>{event.preventDefault();submitPrompt();});
input?.addEventListener('input',autoGrow);
input?.addEventListener('focus',()=>{document.body?.classList.add('ai-keyboard-active');});
input?.addEventListener('blur',()=>{window.setTimeout(()=>document.body?.classList.remove('ai-keyboard-active'),120);});
input?.addEventListener('keydown',(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitPrompt();}});
suggestions.forEach((button)=>button.addEventListener('click',()=>submitPrompt(button.dataset.aiPrompt||'')));
newChat?.addEventListener('click',resetChat);
plusButton?.addEventListener('click',handlePlusTools);
window.addEventListener('pageshow',markReady,{once:true});
window.addEventListener('load',markReady,{once:true});
autoGrow();
markReady();