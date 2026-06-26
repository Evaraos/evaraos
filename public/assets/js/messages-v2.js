import {
  auth, db, onAuthStateChanged, collection, doc, getDocs, addDoc, setDoc,
  query, orderBy, onSnapshot, serverTimestamp, getSavedUserProfile
} from "./firebase.js";

const BUILTIN = [
  { id:"operations", name:"Operations", description:"Dispatch, scheduling, and daily operations.", roles:["owner","super_admin","admin","manager","operations_manager","operations_coordinator","sales_rep","technician","cleaner","staff","field_staff","crew_lead"] },
  { id:"field-crews", name:"Field Crews", description:"Technicians, cleaners, and field teams.", roles:["owner","super_admin","admin","manager","operations_manager","operations_coordinator","technician","cleaner","staff","field_staff","crew_lead"] },
  { id:"hr-support", name:"HR + Support", description:"Hiring, onboarding, payroll, and support.", roles:["owner","super_admin","admin","hr","hr_manager","customer_support"] },
  { id:"leadership", name:"Leadership", description:"Executive and management communication.", roles:["owner","super_admin","admin","manager","operations_manager"] }
];

const REGISTRY_CHANNEL = "_group_registry";
const state = { user:null, profile:{}, conversations:[], active:null, unsubscribe:null, allUsers:[], search:"" };
const $ = (id) => document.getElementById(id);
function esc(value=""){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function normalize(value=""){return String(value||"").trim().toLowerCase()}
function role(){return normalize(state.profile.role||"staff")}
function isAdmin(){return ["owner","super_admin","admin","manager","operations_manager","hr_manager"].includes(role())}
function nameOf(user={}){return user.displayName||user.fullName||user.name||user.username||user.email||"User"}
function initials(value=""){return String(value).trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"E"}
function toDate(value){if(!value)return null;if(typeof value?.toDate==="function")return value.toDate();if(typeof value?.seconds==="number")return new Date(value.seconds*1000);const d=new Date(value);return Number.isNaN(d.getTime())?null:d}
function timeLabel(value){const d=toDate(value);if(!d)return"";return new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(d)}
function avatarMarkup(conversation){return conversation.imageUrl?`<img src="${esc(conversation.imageUrl)}" alt="${esc(conversation.name)}"/>`:`<span>${esc(initials(conversation.name))}</span>`}
function canSee(conversation){if(conversation.builtin)return conversation.roles.includes(role());const uid=state.user?.uid||"";return isAdmin()||conversation.memberUids?.includes(uid)||conversation.adminUids?.includes(uid)||conversation.allowedRoles?.includes(role())}
function canEdit(conversation){const uid=state.user?.uid||"";return isAdmin()||conversation.adminUids?.includes(uid)}

async function loadUsers(){
  try{const snap=await getDocs(collection(db,"users"));state.allUsers=snap.docs.map(d=>({id:d.id,...d.data()}))}
  catch(error){console.warn("Users unavailable for group creation",error);state.allUsers=[]}
}

async function loadGroupRegistry(){
  try{
    const snap=await getDocs(collection(db,"channels",REGISTRY_CHANNEL,"messages"));
    return snap.docs.map(d=>({id:d.id,...d.data()})).filter(item=>item.kind==="group_meta"&&item.groupId);
  }catch(error){console.warn("Group registry unavailable",error);return[]}
}

async function loadConversations(){
  const dynamic=await loadGroupRegistry();
  const builtin=BUILTIN.map(item=>({...item,builtin:true,type:"role",imageUrl:"",memberUids:[],adminUids:[]}));
  const merged=[...builtin,...dynamic.map(item=>({...item,id:item.groupId,type:"group",builtin:false}))].filter(canSee);
  state.conversations=merged;
  if(!state.active||!merged.some(item=>item.id===state.active.id))state.active=merged[0]||null;
  renderConversations();
  openConversation(state.active?.id);
}

function renderConversations(){
  const root=$("conversationList");if(!root)return;
  const queryText=normalize(state.search);
  const items=state.conversations.filter(item=>!queryText||normalize(item.name).includes(queryText)||normalize(item.description).includes(queryText));
  root.innerHTML=items.length?items.map(item=>`<button class="conversation-item ${state.active?.id===item.id?"is-active":""}" type="button" data-conversation="${esc(item.id)}"><span class="conversation-avatar">${avatarMarkup(item)}</span><span class="conversation-copy"><strong>${esc(item.name)}</strong><span>${esc(item.lastMessage||item.description||"No messages yet")}</span></span><span class="conversation-meta">${item.type==="group"?"Group":"Role"}</span></button>`).join(""):`<div class="messages-empty">No conversations match your search.</div>`;
}

function renderHeader(){
  const c=state.active;if(!c)return;
  $("chatAvatar").innerHTML=avatarMarkup(c);
  $("chatTitle").textContent=c.name;
  $("chatSubtitle").textContent=c.type==="group"?`${c.memberUids?.length||0} members`:c.description||"Role channel";
  $("editGroupBtn").hidden=!canEdit(c)||c.builtin;
}

function renderMessages(messages=[]){
  const root=$("chatFeed");if(!root)return;
  const visible=messages.filter(message=>message.kind!=="group_meta");
  root.innerHTML=visible.length?visible.map(message=>{const mine=message.senderUid===state.user?.uid;return `<div class="message-row ${mine?"mine":""}">${mine?"":`<span class="message-sender-avatar">${esc(initials(message.senderName||"U"))}</span>`}<div>${mine?"":`<p class="message-author">${esc(message.senderName||"Unknown")} <span class="role-badge">${esc(String(message.senderRole||"staff").replaceAll("_"," "))}</span></p>`}<div class="message-bubble">${esc(message.text||"")}</div><div class="message-time">${esc(timeLabel(message.createdAt))}</div></div></div>`}).join(""):`<div class="messages-empty">Start the conversation.</div>`;
  root.scrollTop=root.scrollHeight;
}

function subscribe(){
  state.unsubscribe?.();if(!state.active)return;
  const q=query(collection(db,"channels",state.active.id,"messages"),orderBy("createdAt","asc"));
  state.unsubscribe=onSnapshot(q,snap=>renderMessages(snap.docs.map(d=>({id:d.id,...d.data()}))),error=>{$("chatFeed").innerHTML=`<div class="messages-empty">${esc(error.message||"Unable to load messages")}</div>`});
}

function openConversation(id){
  const conversation=state.conversations.find(item=>item.id===id);if(!conversation)return;
  state.active=conversation;renderConversations();renderHeader();subscribe();document.querySelector(".messages-app")?.classList.remove("show-list");
}

async function sendMessage(){
  const input=$("messageInput"),text=input.value.trim();if(!text||!state.active)return;
  await addDoc(collection(db,"channels",state.active.id,"messages"),{text,senderUid:state.user.uid,senderName:nameOf(state.profile)||state.user.email,senderRole:state.profile.role||"staff",companyId:state.profile.companyId||"",createdAt:serverTimestamp()});
  input.value="";autoSize();
}

function autoSize(){const input=$("messageInput");if(!input)return;input.style.height="auto";input.style.height=`${Math.min(130,input.scrollHeight)}px`}

function groupForm(conversation=null){
  const selected=new Set(conversation?.memberUids||[state.user?.uid].filter(Boolean));
  $("groupSheetTitle").textContent=conversation?"Edit group":"New group";
  $("groupName").value=conversation?.name||"";
  $("groupImageUrl").value=conversation?.imageUrl||"";
  $("groupImagePreview").innerHTML=conversation?.imageUrl?`<img src="${esc(conversation.imageUrl)}" alt="Group"/>`:`<span>${esc(initials(conversation?.name||"New Group"))}</span>`;
  $("groupConversationId").value=conversation?.id||"";
  const allowed=state.allUsers.filter(user=>user.active!==false&&user.id!==state.user?.uid);
  $("groupMembers").innerHTML=allowed.map(user=>`<label class="member-option"><input type="checkbox" value="${esc(user.id)}" ${selected.has(user.id)?"checked":""}/><span>${esc(nameOf(user))}<small>${esc(String(user.role||"staff").replaceAll("_"," "))}</small></span></label>`).join("")||`<p class="messages-empty">No additional users are available.</p>`;
  $("groupSheet").hidden=false;
}

async function saveGroup(event){
  event.preventDefault();
  const id=$("groupConversationId").value||`group-${crypto.randomUUID()}`;
  const members=[state.user.uid,...[...$("groupMembers").querySelectorAll("input:checked")].map(input=>input.value)];
  const existing=state.conversations.find(item=>item.id===id);
  const payload={kind:"group_meta",groupId:id,name:$("groupName").value.trim(),imageUrl:$("groupImageUrl").value.trim(),description:"Group conversation",memberUids:[...new Set(members)],adminUids:existing?.adminUids?.length?existing.adminUids:[state.user.uid],allowedRoles:[],companyId:state.profile.companyId||"",createdBy:existing?.createdBy||state.user.uid,createdAt:existing?.createdAt||serverTimestamp(),updatedAt:serverTimestamp()};
  if(!payload.name)throw new Error("Group name is required.");
  await setDoc(doc(db,"channels",REGISTRY_CHANNEL,"messages",id),payload,{merge:true});
  $("groupSheet").hidden=true;
  await loadConversations();
  openConversation(id);
}

function bind(){
  $("conversationList")?.addEventListener("click",e=>{const button=e.target.closest("[data-conversation]");if(button)openConversation(button.dataset.conversation)});
  $("conversationSearch")?.addEventListener("input",e=>{state.search=e.target.value;renderConversations()});
  $("newGroupBtn")?.addEventListener("click",()=>groupForm());
  $("editGroupBtn")?.addEventListener("click",()=>groupForm(state.active));
  $("closeGroupSheet")?.addEventListener("click",()=>$('groupSheet').hidden=true);
  $("groupForm")?.addEventListener("submit",e=>saveGroup(e).catch(error=>alert(error.message||"Unable to save group")));
  $("groupImageUrl")?.addEventListener("input",e=>{$("groupImagePreview").innerHTML=e.target.value?`<img src="${esc(e.target.value)}" alt="Group"/>`:`<span>${esc(initials($("groupName").value||"G"))}</span>`});
  $("messageForm")?.addEventListener("submit",e=>{e.preventDefault();sendMessage().catch(error=>alert(error.message||"Message failed"))});
  $("messageInput")?.addEventListener("input",autoSize);
  $("messageInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("messageForm")?.requestSubmit()}});
  $("showConversationList")?.addEventListener("click",()=>document.querySelector(".messages-app")?.classList.add("show-list"));
}

function init(){
  bind();
  onAuthStateChanged(auth,async user=>{
    if(!user){location.assign("/login.html");return}
    state.user=user;state.profile=getSavedUserProfile()||{};
    await loadUsers();await loadConversations();
    document.body.classList.remove("auth-pending","app-loading");document.body.classList.add("app-ready");window.EvaraLoader?.markAppReady?.();
  });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
