import { auth, db, onAuthStateChanged, collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, getSavedUserProfile } from "./firebase.js";

const BUILTINS = [
  { id:"operations", name:"Operations", description:"Dispatch, scheduling, and daily operations.", roles:["owner","super_admin","admin","manager","operations_manager","operations_coordinator","sales_rep","technician","cleaner","staff","field_staff","crew_lead"] },
  { id:"field-crews", name:"Field Crews", description:"Technicians, cleaners, and field teams.", roles:["owner","super_admin","admin","manager","operations_manager","operations_coordinator","technician","cleaner","staff","field_staff","crew_lead"] },
  { id:"hr-support", name:"HR + Support", description:"Hiring, onboarding, payroll, and support.", roles:["owner","super_admin","admin","hr","hr_manager","customer_support"] },
  { id:"leadership", name:"Leadership", description:"Executive and management communication.", roles:["owner","super_admin","admin","manager","operations_manager"] }
];
const REGISTRY = "_group_registry";
const GROUP_KEY = "evaraos-message-group-state";
const MUTE_KEY = "evaraos-muted-conversations";
const HIDDEN_KEY = "evaraos-hidden-conversations";
const ADMIN = new Set(["owner","super_admin","admin","manager","operations_manager","hr_manager"]);
const GROUPS = [
  { key:"direct", title:"Direct Messages", subtitle:"Private conversations" },
  { key:"group", title:"Groups", subtitle:"Shared conversations" },
  { key:"role", title:"Teams", subtitle:"Only visible to assigned members" }
];

const loadSet = (key, fallback=[]) => { try { const v=JSON.parse(localStorage.getItem(key)||"null"); return new Set(Array.isArray(v)?v:fallback); } catch { return new Set(fallback); } };
const saveSet = (key,set) => { try { localStorage.setItem(key,JSON.stringify([...set])); } catch {} };
const state = { user:null, profile:{}, conversations:[], active:null, off:null, search:"", collapsed:loadSet(GROUP_KEY,["role"]), muted:loadSet(MUTE_KEY), hidden:loadSet(HIDDEN_KEY), menuContext:"global" };
const el = Object.fromEntries([
  "conversationList","conversationSearch","editConversations","newConversationButton","voiceSearchButton","refreshConversations","closeMessagesMenu","messagesMenu","messagesMenuTitle","viewConversationPhoto","muteConversation","conversationInfo","editConversation","deleteConversation","backToDashboard","chatMenuButton","showConversationList","chatAvatar","chatTitle","chatSubtitle","chatFeed","messageForm","messageInput","conversationPhotoViewer","conversationPhotoImage","conversationPhotoCaption","closePhotoViewer"
].map(id=>[id,document.getElementById(id)]));
el.app=document.querySelector(".messages-app"); el.menuBackdrop=document.querySelector(".messages-sheet-backdrop");

const normalize=v=>String(v||"").trim().toLowerCase();
const role=()=>normalize(state.profile.role||"customer");
const isAdmin=()=>ADMIN.has(role());
const initials=v=>String(v||"").trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join("")||"E";
const toDate=v=>{ if(!v)return null; if(typeof v?.toDate==="function")return v.toDate(); if(typeof v?.seconds==="number")return new Date(v.seconds*1000); const d=new Date(v); return Number.isNaN(d.getTime())?null:d; };
const stamp=v=>toDate(v)?.getTime()||0;
function timeLabel(v){ const d=toDate(v); if(!d)return""; const n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()),m=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=Math.round((t-m)/86400000); if(diff===0)return new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(d); if(diff===1)return"Yesterday"; return new Intl.DateTimeFormat(undefined,d.getFullYear()===n.getFullYear()?{month:"numeric",day:"numeric"}:{month:"numeric",day:"numeric",year:"2-digit"}).format(d); }
function dayLabel(v){ const d=toDate(v); if(!d)return""; const n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()),m=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=Math.round((t-m)/86400000); if(diff===0)return"Today"; if(diff===1)return"Yesterday"; return new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(d); }
const dayKey=v=>{ const d=toDate(v); return d?`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`:"unknown"; };
function canSee(c){ if(state.hidden.has(c.id))return false; if(c.builtin)return c.roles.includes(role()); const uid=state.user?.uid||""; return isAdmin()||c.memberUids?.includes(uid)||c.adminUids?.includes(uid)||c.allowedRoles?.includes(role()); }
function ready(){ document.documentElement.classList.remove("auth-pending","boot-pending","evara-boot-lock"); document.body.classList.remove("auth-pending","app-loading"); document.body.classList.add("app-ready"); window.EvaraLoader?.markAppReady?.(); }
function avatar(container,c){ if(!container)return; container.replaceChildren(); if(c?.imageUrl){ const img=document.createElement("img"); img.src=c.imageUrl; img.alt=c.name||"Conversation"; img.loading="lazy"; container.append(img); } else { const s=document.createElement("span"); s.textContent=initials(c?.name||"Evaraos"); container.append(s); } }

function conversationButton(c){
  const b=document.createElement("button"); b.type="button"; b.className=`conversation-item${state.active?.id===c.id?" is-active":""}`; b.dataset.conversation=c.id;
  const a=document.createElement("span"); a.className="conversation-avatar"; avatar(a,c);
  const copy=document.createElement("span"); copy.className="conversation-copy";
  const title=document.createElement("strong"); title.textContent=c.name||"Conversation";
  if(state.muted.has(c.id)){ const badge=document.createElement("span"); badge.className="conversation-muted-badge"; badge.textContent="◐"; title.append(badge); }
  const preview=document.createElement("span"); preview.textContent=`${c.lastSenderUid===state.user?.uid&&c.lastMessage?"You: ":""}${c.lastMessage||c.description||"No messages yet"}`;
  copy.append(title,preview);
  const meta=document.createElement("span"); meta.className="conversation-meta"; meta.textContent=timeLabel(c.lastMessageAt||c.updatedAt||c.createdAt);
  const chevron=document.createElement("span"); chevron.className="conversation-chevron";
  b.append(a,copy,meta,chevron); return b;
}
function conversationRow(c){
  const wrap=document.createElement("div"); wrap.className="conversation-swipe-row"; wrap.dataset.swipeConversation=c.id;
  const actions=document.createElement("div"); actions.className="conversation-swipe-actions";
  const mute=document.createElement("button"); mute.type="button"; mute.className="conversation-swipe-action mute"; mute.dataset.muteConversation=c.id; mute.textContent=state.muted.has(c.id)?"Unmute":"DND";
  const remove=document.createElement("button"); remove.type="button"; remove.className="conversation-swipe-action delete"; remove.dataset.removeConversation=c.id; remove.textContent="Delete";
  actions.append(mute,remove); wrap.append(actions,conversationButton(c)); return wrap;
}
function groupSection(group,items){
  const collapsed=!state.search&&state.collapsed.has(group.key),section=document.createElement("section"); section.className=`messages-conversation-group${collapsed?" is-collapsed":""}`;
  const toggle=document.createElement("button"); toggle.type="button"; toggle.className="messages-section-toggle"; toggle.dataset.groupToggle=group.key; toggle.setAttribute("aria-expanded",String(!collapsed));
  const arrow=document.createElement("span"); arrow.className="messages-section-chevron";
  const copy=document.createElement("span"); copy.className="messages-section-copy"; const strong=document.createElement("strong"); strong.textContent=group.title; const sub=document.createElement("span"); sub.textContent=group.subtitle; copy.append(strong,sub);
  const count=document.createElement("span"); count.className="messages-section-count"; count.textContent=String(items.length); toggle.append(arrow,copy,count);
  const list=document.createElement("div"); list.className="messages-section-list"; list.replaceChildren(...items.map(conversationRow)); section.append(toggle,list); return section;
}
function renderConversations(){
  if(!el.conversationList)return; const q=normalize(state.search); const visible=[...state.conversations].filter(c=>!q||normalize(c.name).includes(q)||normalize(c.lastMessage).includes(q)||normalize(c.description).includes(q)).sort((a,b)=>stamp(b.lastMessageAt||b.updatedAt)-stamp(a.lastMessageAt||a.updatedAt)||(a.order??99)-(b.order??99));
  if(!visible.length){ const empty=document.createElement("div"); empty.className="messages-empty"; empty.textContent=q?"No conversations match your search.":"No conversations are available for this account."; el.conversationList.replaceChildren(empty); return; }
  el.conversationList.replaceChildren(...GROUPS.map(g=>({...g,items:visible.filter(c=>c.type===g.key)})).filter(g=>g.items.length).map(g=>groupSection(g,g.items)));
}
async function registry(){ try{ const s=await getDocs(collection(db,"channels",REGISTRY,"messages")); return s.docs.map(d=>({registryDocId:d.id,...d.data()})).filter(x=>["group_meta","direct_meta","role_meta"].includes(x.kind)&&x.groupId); }catch(e){ console.warn("Conversation registry unavailable",e); return[]; } }
function merge(entries){ const overrides=new Map(entries.filter(x=>x.kind==="role_meta").map(x=>[x.groupId,x])); const builtins=BUILTINS.map((base,order)=>({...base,...(overrides.get(base.id)||{}),id:base.id,builtin:true,type:"role",order,memberUids:[],adminUids:[]})); const custom=entries.filter(x=>x.kind!=="role_meta").map((x,i)=>({...x,id:x.groupId,builtin:false,type:x.kind==="direct_meta"?"direct":"group",order:BUILTINS.length+i})); return[...builtins,...custom].filter(canSee); }
async function preview(c){ try{ const s=await getDocs(query(collection(db,"channels",c.id,"messages"),orderBy("createdAt","desc"),limit(8))); const m=s.docs.map(d=>d.data()).find(x=>!["group_meta","direct_meta","role_meta"].includes(x.kind)); return m?{...c,lastMessage:m.text||c.lastMessage||"",lastMessageAt:m.createdAt||c.lastMessageAt||null,lastSenderUid:m.senderUid||""}:c; }catch{return c;} }
async function loadConversations(){ state.conversations=merge(await registry()); renderConversations(); state.conversations=await Promise.all(state.conversations.map(preview)); renderConversations(); }

function center(){ state.off?.(); state.off=null; state.active=null; document.body.classList.remove("messages-chat-active","keyboard-open"); el.app?.classList.add("show-list"); document.documentElement.dataset.messagesView="center"; syncViewport(); renderConversations(); }
function dateDivider(v){ const d=document.createElement("div"); d.className="message-date-divider"; d.textContent=dayLabel(v); return d; }
function messageRow(m){ const mine=m.senderUid===state.user?.uid,row=document.createElement("article"); row.className=`message-row${mine?" mine":""}`; const stack=document.createElement("div"); stack.className="message-stack"; if(!mine&&state.active?.type!=="direct"&&m.senderName){ const author=document.createElement("div"); author.className="message-author"; author.textContent=m.senderName; stack.append(author); } const bubble=document.createElement("div"); bubble.className="message-bubble"; bubble.textContent=m.text||""; const time=document.createElement("div"); time.className="message-time"; time.textContent=toDate(m.createdAt)?new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(toDate(m.createdAt)):""; stack.append(bubble,time); row.append(stack); return row; }
function renderMessages(snapshot){ if(!el.chatFeed||!state.active)return; const messages=snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!["group_meta","direct_meta","role_meta"].includes(m.kind)); if(!messages.length){ const empty=document.createElement("div"); empty.className="messages-empty"; empty.textContent="Start the conversation."; el.chatFeed.replaceChildren(empty); return; } const nodes=[]; let previous=""; for(const m of messages){ const key=dayKey(m.createdAt); if(key!==previous){ nodes.push(dateDivider(m.createdAt)); previous=key; } nodes.push(messageRow(m)); } el.chatFeed.replaceChildren(...nodes); requestAnimationFrame(()=>{el.chatFeed.scrollTop=el.chatFeed.scrollHeight;}); }
function openConversation(id){ const c=state.conversations.find(x=>x.id===id); if(!c)return; state.active=c; el.app?.classList.remove("show-list"); document.body.classList.add("messages-chat-active"); document.documentElement.dataset.messagesView="chat"; syncViewport(); avatar(el.chatAvatar,c); el.chatTitle.textContent=c.name||"Conversation"; el.chatSubtitle.textContent=c.type==="direct"?"Direct message":c.type==="group"?`${c.memberUids?.length||0} members`:c.description||"Team channel"; state.off?.(); state.off=onSnapshot(query(collection(db,"channels",c.id,"messages"),orderBy("createdAt","asc")),renderMessages,e=>{ const empty=document.createElement("div"); empty.className="messages-empty"; empty.textContent=e.message||"Unable to load messages."; el.chatFeed.replaceChildren(empty); }); renderConversations(); }
async function sendMessage(){ const text=String(el.messageInput?.value||"").trim(); if(!text||!state.active||!state.user)return; el.messageInput.value=""; autoSize(); await addDoc(collection(db,"channels",state.active.id,"messages"),{text,senderUid:state.user.uid,senderName:state.profile.displayName||state.profile.fullName||state.profile.name||state.user.displayName||state.user.email||"User",senderRole:state.profile.role||"customer",companyId:state.profile.companyId||"",createdAt:serverTimestamp()}); }
function autoSize(){ if(!el.messageInput)return; el.messageInput.style.height="auto"; el.messageInput.style.height=`${Math.min(128,el.messageInput.scrollHeight)}px`; }

function toggleGroup(key){ state.collapsed.has(key)?state.collapsed.delete(key):state.collapsed.add(key); saveSet(GROUP_KEY,state.collapsed); renderConversations(); }
function toggleEdit(){ state.editing=!state.editing; el.editConversations.textContent=state.editing?"Done":"Edit"; el.editConversations.setAttribute("aria-pressed",String(state.editing)); if(state.editing)state.collapsed.clear(); else if(!state.collapsed.size)state.collapsed.add("role"); saveSet(GROUP_KEY,state.collapsed); renderConversations(); }
function toggleMute(id){ state.muted.has(id)?state.muted.delete(id):state.muted.add(id); saveSet(MUTE_KEY,state.muted); renderConversations(); updateMenu(); }
function hideConversation(id){ const c=state.conversations.find(x=>x.id===id); if(!c||!window.confirm(`Remove ${c.name} from your Messages list?`))return; state.hidden.add(id); saveSet(HIDDEN_KEY,state.hidden); state.conversations=state.conversations.filter(x=>x.id!==id); if(state.active?.id===id)center(); renderConversations(); closeMenu(); }
function renameActive(){ if(!state.active)return; const name=window.prompt("Conversation name",state.active.name||""); if(!name?.trim())return; state.active.name=name.trim(); const item=state.conversations.find(x=>x.id===state.active.id); if(item)item.name=name.trim(); el.chatTitle.textContent=name.trim(); renderConversations(); closeMenu(); }

function updateMenu(){ const active=state.active,conversation=state.menuContext!=="global"&&active; el.messagesMenuTitle.textContent=conversation?active.name:"Messages"; [el.viewConversationPhoto,el.muteConversation,el.conversationInfo,el.editConversation,el.deleteConversation].forEach(b=>{if(b)b.hidden=!conversation;}); if(el.refreshConversations)el.refreshConversations.hidden=Boolean(conversation); if(el.backToDashboard)el.backToDashboard.hidden=Boolean(conversation); if(el.muteConversation&&active)el.muteConversation.textContent=state.muted.has(active.id)?"Turn On Notifications":"Do Not Disturb"; }
function openMenu(context="global"){ state.menuContext=context; updateMenu(); el.messagesMenu.hidden=false; }
function closeMenu(){ el.messagesMenu.hidden=true; }
function viewPhoto(){ if(!state.active)return; el.conversationPhotoCaption.textContent=state.active.name||"Conversation"; el.conversationPhotoImage.src=state.active.imageUrl||"/assets/img/apple-touch-icon.png"; closeMenu(); el.conversationPhotoViewer.hidden=false; }
function closePhoto(){ el.conversationPhotoViewer.hidden=true; }
function info(){ if(!state.active)return; closeMenu(); const members=state.active.memberUids?.length||0; window.alert(`${state.active.name}\n${state.active.description||"Conversation"}\n${state.active.type==="direct"?"Direct message":`${members} members`}`); }
function voice(){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){el.conversationSearch?.focus();return;} const r=new SR(); r.lang=document.documentElement.lang||"en-US"; r.interimResults=false; r.maxAlternatives=1; r.addEventListener("result",e=>{const text=e.results?.[0]?.[0]?.transcript||""; el.conversationSearch.value=text; state.search=text; renderConversations();},{once:true}); r.start(); }
function syncViewport(){ const v=window.visualViewport,height=Math.round(v?.height||window.innerHeight),top=Math.round(v?.offsetTop||0),layout=Math.max(window.innerHeight,document.documentElement.clientHeight||0),open=document.body.classList.contains("messages-chat-active")&&layout-height>120; document.documentElement.style.setProperty("--messages-viewport-height",`${height}px`); document.documentElement.style.setProperty("--messages-viewport-top",`${top}px`); document.body.classList.toggle("keyboard-open",open); if(open&&el.chatFeed)requestAnimationFrame(()=>{el.chatFeed.scrollTop=el.chatFeed.scrollHeight;}); }
function swipe(){ let x=0,y=0,row=null; el.conversationList?.addEventListener("pointerdown",e=>{row=e.target.closest(".conversation-swipe-row"); if(!row)return; x=e.clientX;y=e.clientY;}); el.conversationList?.addEventListener("pointerup",e=>{if(!row)return; const dx=e.clientX-x,dy=e.clientY-y; if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)){el.conversationList.querySelectorAll(".conversation-swipe-row.is-revealed").forEach(r=>{if(r!==row)r.classList.remove("is-revealed");}); row.classList.toggle("is-revealed",dx>0);} row=null;}); }

function bind(){
  el.conversationList?.addEventListener("click",e=>{ const group=e.target.closest("[data-group-toggle]"); if(group){toggleGroup(group.dataset.groupToggle);return;} const mute=e.target.closest("[data-mute-conversation]"); if(mute){toggleMute(mute.dataset.muteConversation);return;} const remove=e.target.closest("[data-remove-conversation]"); if(remove){hideConversation(remove.dataset.removeConversation);return;} const row=e.target.closest("[data-conversation]"); if(row&&!row.closest(".conversation-swipe-row")?.classList.contains("is-revealed"))openConversation(row.dataset.conversation); });
  el.conversationSearch?.addEventListener("input",e=>{state.search=e.target.value;renderConversations();});
  el.editConversations?.addEventListener("click",toggleEdit); el.newConversationButton?.addEventListener("click",()=>openMenu("global")); el.voiceSearchButton?.addEventListener("click",voice); el.chatMenuButton?.addEventListener("click",()=>openMenu("conversation")); el.chatAvatar?.addEventListener("click",()=>openMenu("avatar")); el.showConversationList?.addEventListener("click",center); el.closeMessagesMenu?.addEventListener("click",closeMenu); el.menuBackdrop?.addEventListener("click",closeMenu); el.closePhotoViewer?.addEventListener("click",closePhoto); el.viewConversationPhoto?.addEventListener("click",viewPhoto); el.muteConversation?.addEventListener("click",()=>{if(state.active)toggleMute(state.active.id);closeMenu();}); el.conversationInfo?.addEventListener("click",info); el.editConversation?.addEventListener("click",renameActive); el.deleteConversation?.addEventListener("click",()=>{if(state.active)hideConversation(state.active.id);}); el.refreshConversations?.addEventListener("click",async()=>{closeMenu();await loadConversations();});
  el.messageForm?.addEventListener("submit",e=>{e.preventDefault();sendMessage().catch(console.error);}); el.messageInput?.addEventListener("input",autoSize); el.messageInput?.addEventListener("focus",()=>{setTimeout(syncViewport,80);setTimeout(syncViewport,280);}); el.messageInput?.addEventListener("blur",()=>setTimeout(syncViewport,120)); el.messageInput?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();el.messageForm?.requestSubmit();}});
  window.visualViewport?.addEventListener("resize",syncViewport,{passive:true}); window.visualViewport?.addEventListener("scroll",syncViewport,{passive:true}); window.addEventListener("orientationchange",()=>setTimeout(syncViewport,150),{passive:true}); window.addEventListener("pagehide",()=>state.off?.(),{once:true}); swipe();
}
function init(){ bind(); center(); syncViewport(); onAuthStateChanged(auth,async user=>{if(!user){window.location.replace("/login.html");return;} state.user=user; state.profile=getSavedUserProfile()||{}; state.conversations=BUILTINS.map((c,order)=>({...c,order,builtin:true,type:"role"})).filter(canSee); renderConversations(); ready(); await loadConversations();}); }
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
