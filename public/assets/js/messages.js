import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

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

const loadSet = (key, fallback=[]) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return new Set(Array.isArray(value) ? value : fallback);
  } catch {
    return new Set(fallback);
  }
};

const saveSet = (key, set) => {
  try { localStorage.setItem(key, JSON.stringify([...set])); }
  catch {}
};

const state = {
  user: null,
  profile: {},
  conversations: [],
  active: null,
  off: null,
  search: "",
  editing: false,
  collapsed: loadSet(GROUP_KEY, ["role"]),
  muted: loadSet(MUTE_KEY),
  hidden: loadSet(HIDDEN_KEY),
  menuContext: "global"
};

const ids = [
  "conversationList","conversationSearch","editConversations","newConversationButton","composeConversationButton",
  "newDirectConversation","newGroupConversation","refreshConversations","closeMessagesMenu","messagesMenu",
  "messagesMenuTitle","viewConversationPhoto","muteConversation","conversationInfo","editConversation",
  "deleteConversation","backToDashboard","chatMenuButton","showConversationList","chatAvatar","chatTitle",
  "chatSubtitle","chatFeed","messageForm","messageInput","conversationPhotoViewer","conversationPhotoImage",
  "conversationPhotoCaption","closePhotoViewer"
];
const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
el.app = document.querySelector(".messages-app");
el.menuBackdrop = document.querySelector(".messages-sheet-backdrop");

const normalize = value => String(value || "").trim().toLowerCase();
const currentRole = () => normalize(state.profile.role || "customer");
const isAdmin = () => ADMIN.has(currentRole());
const profileName = (profile={}, fallback="User") => profile.displayName || profile.fullName || profile.name || profile.username || profile.email || fallback;
const initials = value => String(value || "").trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join("") || "E";
const toDate = value => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const stamp = value => toDate(value)?.getTime() || 0;

function timeLabel(value) {
  const date = toDate(value);
  if (!date) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((today - day) / 86400000);
  if (difference === 0) return new Intl.DateTimeFormat(undefined, { hour:"numeric", minute:"2-digit" }).format(date);
  if (difference === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, date.getFullYear() === now.getFullYear()
    ? { month:"numeric", day:"numeric" }
    : { month:"numeric", day:"numeric", year:"2-digit" }).format(date);
}

function dayLabel(value) {
  const date = toDate(value);
  if (!date) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((today - day) / 86400000);
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday:"short", month:"short", day:"numeric" }).format(date);
}

const dayKey = value => {
  const date = toDate(value);
  return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";
};

function canSee(conversation) {
  if (state.hidden.has(conversation.id)) return false;
  if (conversation.builtin) return conversation.roles.includes(currentRole());
  const uid = state.user?.uid || "";
  return isAdmin()
    || conversation.memberUids?.includes(uid)
    || conversation.adminUids?.includes(uid)
    || conversation.allowedRoles?.includes(currentRole());
}

function ready() {
  document.documentElement.classList.remove("auth-pending","boot-pending","evara-boot-lock");
  document.body.classList.remove("auth-pending","app-loading");
  document.body.classList.add("app-ready");
  window.EvaraLoader?.markAppReady?.();
}

function avatar(container, conversation) {
  if (!container) return;
  container.replaceChildren();
  if (conversation?.imageUrl) {
    const image = document.createElement("img");
    image.src = conversation.imageUrl;
    image.alt = conversation.name || "Conversation";
    image.loading = "lazy";
    container.append(image);
    return;
  }
  const text = document.createElement("span");
  text.textContent = initials(conversation?.name || "Evaraos");
  container.append(text);
}

function bellMarkup(muted=false) {
  return `<svg class="conversation-bell${muted ? " is-muted" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path class="bell-body" d="M6.5 16.5h11l-1.4-2.1V10a4.1 4.1 0 0 0-8.2 0v4.4L6.5 16.5Z"/><path class="bell-clapper" d="M10 19h4"/><path class="bell-slash" d="M4 4l16 16"/></svg>`;
}

function conversationButton(conversation) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `conversation-item${state.active?.id === conversation.id ? " is-active" : ""}`;
  button.dataset.conversation = conversation.id;

  const avatarNode = document.createElement("span");
  avatarNode.className = "conversation-avatar";
  avatar(avatarNode, conversation);

  const copy = document.createElement("span");
  copy.className = "conversation-copy";
  const title = document.createElement("strong");
  title.textContent = conversation.name || "Conversation";
  if (state.muted.has(conversation.id)) {
    const muted = document.createElement("span");
    muted.className = "conversation-muted-badge";
    muted.innerHTML = bellMarkup(true);
    title.append(muted);
  }
  const preview = document.createElement("span");
  preview.textContent = `${conversation.lastSenderUid === state.user?.uid && conversation.lastMessage ? "You: " : ""}${conversation.lastMessage || conversation.description || "No messages yet"}`;
  copy.append(title, preview);

  const meta = document.createElement("span");
  meta.className = "conversation-meta";
  meta.textContent = timeLabel(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt);
  const chevron = document.createElement("span");
  chevron.className = "conversation-chevron";
  button.append(avatarNode, copy, meta, chevron);
  return button;
}

function conversationRow(conversation) {
  const wrapper = document.createElement("div");
  wrapper.className = "conversation-swipe-row";
  wrapper.dataset.swipeConversation = conversation.id;

  const actions = document.createElement("div");
  actions.className = "conversation-swipe-actions";

  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = `conversation-swipe-action mute${state.muted.has(conversation.id) ? " is-muted" : ""}`;
  mute.dataset.muteConversation = conversation.id;
  mute.setAttribute("aria-label", state.muted.has(conversation.id) ? "Turn on notifications" : "Mute conversation");
  mute.innerHTML = `${bellMarkup(state.muted.has(conversation.id))}<span>${state.muted.has(conversation.id) ? "Unmute" : "Mute"}</span>`;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "conversation-swipe-action delete";
  remove.dataset.removeConversation = conversation.id;
  remove.setAttribute("aria-label", "Delete conversation");
  remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg><span>Delete</span>';

  actions.append(mute, remove);
  wrapper.append(actions, conversationButton(conversation));
  return wrapper;
}

function groupSection(group, items) {
  const collapsed = !state.search && state.collapsed.has(group.key);
  const section = document.createElement("section");
  section.className = `messages-conversation-group${collapsed ? " is-collapsed" : ""}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "messages-section-toggle";
  toggle.dataset.groupToggle = group.key;
  toggle.setAttribute("aria-expanded", String(!collapsed));

  const arrow = document.createElement("span");
  arrow.className = "messages-section-chevron";
  const copy = document.createElement("span");
  copy.className = "messages-section-copy";
  const strong = document.createElement("strong");
  strong.textContent = group.title;
  const sub = document.createElement("span");
  sub.textContent = group.subtitle;
  copy.append(strong, sub);
  const count = document.createElement("span");
  count.className = "messages-section-count";
  count.textContent = String(items.length);
  toggle.append(arrow, copy, count);

  const list = document.createElement("div");
  list.className = "messages-section-list";
  list.replaceChildren(...items.map(conversationRow));
  section.append(toggle, list);
  return section;
}

function renderConversations() {
  if (!el.conversationList) return;
  const search = normalize(state.search);
  const visible = [...state.conversations]
    .filter(conversation => !search
      || normalize(conversation.name).includes(search)
      || normalize(conversation.lastMessage).includes(search)
      || normalize(conversation.description).includes(search))
    .sort((left,right) => stamp(right.lastMessageAt || right.updatedAt) - stamp(left.lastMessageAt || left.updatedAt) || (left.order ?? 99) - (right.order ?? 99));

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "messages-empty";
    empty.textContent = search ? "No conversations match your search." : "No conversations are available for this account.";
    el.conversationList.replaceChildren(empty);
    return;
  }

  el.conversationList.replaceChildren(
    ...GROUPS
      .map(group => ({ ...group, items: visible.filter(conversation => conversation.type === group.key) }))
      .filter(group => group.items.length)
      .map(group => groupSection(group, group.items))
  );
}

async function registry() {
  try {
    const snapshot = await getDocs(collection(db, "channels", REGISTRY, "messages"));
    return snapshot.docs
      .map(entry => ({ registryDocId: entry.id, ...entry.data() }))
      .filter(entry => ["group_meta","direct_meta","role_meta"].includes(entry.kind) && entry.groupId);
  } catch (error) {
    console.warn("Conversation registry unavailable", error);
    return [];
  }
}

function merge(entries) {
  const overrides = new Map(entries.filter(entry => entry.kind === "role_meta").map(entry => [entry.groupId, entry]));
  const builtins = BUILTINS.map((base,order) => ({
    ...base,
    ...(overrides.get(base.id) || {}),
    id: base.id,
    builtin: true,
    type: "role",
    order,
    memberUids: [],
    adminUids: []
  }));

  const custom = entries
    .filter(entry => entry.kind !== "role_meta")
    .map((entry,index) => {
      const type = entry.kind === "direct_meta" ? "direct" : "group";
      let name = entry.name || (type === "direct" ? "Direct Message" : "Group");
      if (type === "direct" && entry.participantNames && state.user?.uid) {
        const otherUid = (entry.memberUids || []).find(uid => uid !== state.user.uid);
        name = entry.participantNames[otherUid] || name;
      }
      return { ...entry, id: entry.groupId, name, builtin:false, type, order:BUILTINS.length + index };
    });

  return [...builtins, ...custom].filter(canSee);
}

async function preview(conversation) {
  try {
    const snapshot = await getDocs(query(collection(db,"channels",conversation.id,"messages"), orderBy("createdAt","desc"), limit(8)));
    const message = snapshot.docs.map(entry => entry.data()).find(entry => !["group_meta","direct_meta","role_meta"].includes(entry.kind));
    return message ? {
      ...conversation,
      lastMessage: message.text || conversation.lastMessage || "",
      lastMessageAt: message.createdAt || conversation.lastMessageAt || null,
      lastSenderUid: message.senderUid || ""
    } : conversation;
  } catch {
    return conversation;
  }
}

async function loadConversations() {
  state.conversations = merge(await registry());
  renderConversations();
  state.conversations = await Promise.all(state.conversations.map(preview));
  renderConversations();
}

function center() {
  state.off?.();
  state.off = null;
  state.active = null;
  document.body.classList.remove("messages-chat-active","messages-search-active","keyboard-open");
  el.app?.classList.add("show-list");
  document.documentElement.dataset.messagesView = "center";
  syncViewport();
  renderConversations();
}

function dateDivider(value) {
  const divider = document.createElement("div");
  divider.className = "message-date-divider";
  divider.textContent = dayLabel(value);
  return divider;
}

function messageRow(message) {
  const mine = message.senderUid === state.user?.uid;
  const row = document.createElement("article");
  row.className = `message-row${mine ? " mine" : ""}`;
  const stack = document.createElement("div");
  stack.className = "message-stack";

  if (!mine && state.active?.type !== "direct" && message.senderName) {
    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = message.senderName;
    stack.append(author);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = message.text || "";
  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = toDate(message.createdAt)
    ? new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(toDate(message.createdAt))
    : "";
  stack.append(bubble, time);
  row.append(stack);
  return row;
}

function renderMessages(snapshot) {
  if (!el.chatFeed || !state.active) return;
  const messages = snapshot.docs
    .map(entry => ({ id:entry.id, ...entry.data() }))
    .filter(message => !["group_meta","direct_meta","role_meta"].includes(message.kind));

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "messages-empty";
    empty.textContent = "Start the conversation.";
    el.chatFeed.replaceChildren(empty);
    return;
  }

  const nodes = [];
  let previous = "";
  for (const message of messages) {
    const key = dayKey(message.createdAt);
    if (key !== previous) {
      nodes.push(dateDivider(message.createdAt));
      previous = key;
    }
    nodes.push(messageRow(message));
  }
  el.chatFeed.replaceChildren(...nodes);
  requestAnimationFrame(() => { el.chatFeed.scrollTop = el.chatFeed.scrollHeight; });
}

function openConversation(id) {
  const conversation = state.conversations.find(item => item.id === id);
  if (!conversation) return;
  document.body.classList.remove("messages-search-active");
  state.active = conversation;
  el.app?.classList.remove("show-list");
  document.body.classList.add("messages-chat-active");
  document.documentElement.dataset.messagesView = "chat";
  syncViewport();
  avatar(el.chatAvatar, conversation);
  el.chatTitle.textContent = conversation.name || "Conversation";
  el.chatSubtitle.textContent = conversation.type === "direct"
    ? "Direct message"
    : conversation.type === "group"
      ? `${conversation.memberUids?.length || 0} members`
      : conversation.description || "Team channel";

  state.off?.();
  state.off = onSnapshot(
    query(collection(db,"channels",conversation.id,"messages"), orderBy("createdAt","asc")),
    renderMessages,
    error => {
      const empty = document.createElement("div");
      empty.className = "messages-empty";
      empty.textContent = error.message || "Unable to load messages.";
      el.chatFeed.replaceChildren(empty);
    }
  );
  renderConversations();
}

async function sendMessage() {
  const text = String(el.messageInput?.value || "").trim();
  if (!text || !state.active || !state.user) return;
  el.messageInput.value = "";
  autoSize();
  await addDoc(collection(db,"channels",state.active.id,"messages"), {
    text,
    senderUid: state.user.uid,
    senderName: profileName(state.profile, state.user.displayName || state.user.email || "User"),
    senderRole: state.profile.role || "customer",
    companyId: state.profile.companyId || "",
    createdAt: serverTimestamp()
  });
}

function autoSize() {
  if (!el.messageInput) return;
  el.messageInput.style.height = "auto";
  el.messageInput.style.height = `${Math.min(128, el.messageInput.scrollHeight)}px`;
}

async function findUserByEmail(email) {
  const candidates = [...new Set([String(email || "").trim(), normalize(email)].filter(Boolean))];
  for (const candidate of candidates) {
    const snapshot = await getDocs(query(collection(db,"users"), where("email","==",candidate), limit(1)));
    if (!snapshot.empty) {
      const document = snapshot.docs[0];
      const data = document.data();
      return { uid:data.uid || document.id, email:data.email || candidate, ...data };
    }
  }
  return null;
}

function conversationId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  return `${prefix}-${random}`;
}

async function createConversationMetadata({ kind, name, description, members, participantNames={} }) {
  const groupId = conversationId(kind === "direct_meta" ? "direct" : "group");
  await addDoc(collection(db,"channels",REGISTRY,"messages"), {
    kind,
    groupId,
    name,
    description,
    memberUids: [...new Set(members)],
    adminUids: [state.user.uid],
    allowedRoles: [],
    participantNames,
    createdBy: state.user.uid,
    companyId: state.profile.companyId || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await loadConversations();
  openConversation(groupId);
}

async function createDirectConversation() {
  closeMenu();
  const email = window.prompt("Enter the email address for the new message:");
  if (!email) return;

  try {
    const recipient = await findUserByEmail(email);
    if (!recipient?.uid) {
      window.alert("No Evaraos user was found with that email address.");
      return;
    }
    if (recipient.uid === state.user.uid) {
      window.alert("Choose another Evaraos user to start a message.");
      return;
    }

    const existing = state.conversations.find(conversation =>
      conversation.type === "direct"
      && conversation.memberUids?.includes(state.user.uid)
      && conversation.memberUids?.includes(recipient.uid)
    );
    if (existing) {
      openConversation(existing.id);
      return;
    }

    const creatorName = profileName(state.profile, state.user.displayName || state.user.email || "User");
    const recipientName = profileName(recipient, recipient.email || "User");
    await createConversationMetadata({
      kind: "direct_meta",
      name: recipientName,
      description: "Direct message",
      members: [state.user.uid, recipient.uid],
      participantNames: {
        [state.user.uid]: creatorName,
        [recipient.uid]: recipientName
      }
    });
  } catch (error) {
    console.error(error);
    window.alert("The direct message could not be created. Please try again.");
  }
}

async function createGroupConversation() {
  closeMenu();
  const name = window.prompt("Name the new group chat:");
  if (!name?.trim()) return;
  const rawEmails = window.prompt("Enter member emails separated by commas:");
  if (!rawEmails) return;

  try {
    const emails = [...new Set(rawEmails.split(",").map(value => normalize(value)).filter(Boolean))];
    const users = [];
    for (const email of emails) {
      const user = await findUserByEmail(email);
      if (user?.uid && user.uid !== state.user.uid && !users.some(item => item.uid === user.uid)) users.push(user);
    }

    if (!users.length) {
      window.alert("No additional Evaraos users were found for this group.");
      return;
    }

    const participantNames = {
      [state.user.uid]: profileName(state.profile, state.user.displayName || state.user.email || "User")
    };
    users.forEach(user => { participantNames[user.uid] = profileName(user, user.email || "User"); });

    await createConversationMetadata({
      kind: "group_meta",
      name: name.trim(),
      description: `${users.length + 1} members`,
      members: [state.user.uid, ...users.map(user => user.uid)],
      participantNames
    });
  } catch (error) {
    console.error(error);
    window.alert("The group chat could not be created. Please try again.");
  }
}

function toggleGroup(key) {
  state.collapsed.has(key) ? state.collapsed.delete(key) : state.collapsed.add(key);
  saveSet(GROUP_KEY, state.collapsed);
  renderConversations();
}

function toggleEdit() {
  state.editing = !state.editing;
  el.editConversations.textContent = state.editing ? "Done" : "Edit";
  el.editConversations.setAttribute("aria-pressed", String(state.editing));
  if (state.editing) state.collapsed.clear();
  else if (!state.collapsed.size) state.collapsed.add("role");
  saveSet(GROUP_KEY, state.collapsed);
  renderConversations();
}

function toggleMute(id) {
  state.muted.has(id) ? state.muted.delete(id) : state.muted.add(id);
  saveSet(MUTE_KEY, state.muted);
  renderConversations();
  updateMenu();
}

function hideConversation(id) {
  const conversation = state.conversations.find(item => item.id === id);
  if (!conversation || !window.confirm(`Remove ${conversation.name} from your Messages list?`)) return;
  state.hidden.add(id);
  saveSet(HIDDEN_KEY, state.hidden);
  state.conversations = state.conversations.filter(item => item.id !== id);
  if (state.active?.id === id) center();
  renderConversations();
  closeMenu();
}

function renameActive() {
  if (!state.active) return;
  const name = window.prompt("Conversation name", state.active.name || "");
  if (!name?.trim()) return;
  state.active.name = name.trim();
  const item = state.conversations.find(conversation => conversation.id === state.active.id);
  if (item) item.name = name.trim();
  el.chatTitle.textContent = name.trim();
  renderConversations();
  closeMenu();
}

function updateMenu() {
  const active = state.active;
  const conversationMode = state.menuContext !== "global" && active;
  el.messagesMenuTitle.textContent = conversationMode ? active.name : "New Message";

  [el.viewConversationPhoto,el.muteConversation,el.conversationInfo,el.editConversation,el.deleteConversation]
    .forEach(button => { if (button) button.hidden = !conversationMode; });
  [el.newDirectConversation,el.newGroupConversation,el.refreshConversations,el.backToDashboard]
    .forEach(button => { if (button) button.hidden = Boolean(conversationMode); });

  if (el.muteConversation && active) {
    el.muteConversation.textContent = state.muted.has(active.id) ? "Turn On Notifications" : "Mute Notifications";
  }
}

function openMenu(context="global") {
  state.menuContext = context;
  updateMenu();
  el.messagesMenu.hidden = false;
}

function closeMenu() { el.messagesMenu.hidden = true; }

function viewPhoto() {
  if (!state.active) return;
  el.conversationPhotoCaption.textContent = state.active.name || "Conversation";
  el.conversationPhotoImage.src = state.active.imageUrl || "/assets/img/apple-touch-icon.png";
  closeMenu();
  el.conversationPhotoViewer.hidden = false;
}

function closePhoto() { el.conversationPhotoViewer.hidden = true; }

function info() {
  if (!state.active) return;
  closeMenu();
  const members = state.active.memberUids?.length || 0;
  window.alert(`${state.active.name}\n${state.active.description || "Conversation"}\n${state.active.type === "direct" ? "Direct message" : `${members} members`}`);
}

function syncViewport() {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight);
  const top = Math.round(viewport?.offsetTop || 0);
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);
  const keyboardVisible = layoutHeight - height > 120;
  const chatActive = document.body.classList.contains("messages-chat-active");
  const searchActive = document.body.classList.contains("messages-search-active");
  const keyboardOpen = keyboardVisible && (chatActive || searchActive);

  document.documentElement.style.setProperty("--messages-viewport-height", `${height}px`);
  document.documentElement.style.setProperty("--messages-viewport-top", `${top}px`);
  document.body.classList.toggle("keyboard-open", keyboardOpen);

  if (chatActive && keyboardOpen && el.chatFeed) {
    requestAnimationFrame(() => { el.chatFeed.scrollTop = el.chatFeed.scrollHeight; });
  }
}

function setSearchMode(active) {
  if (document.body.classList.contains("messages-chat-active")) return;
  document.body.classList.toggle("messages-search-active", active);
  requestAnimationFrame(syncViewport);
  setTimeout(syncViewport, 90);
  setTimeout(syncViewport, 280);
}

function swipe() {
  let startX = 0;
  let startY = 0;
  let row = null;

  el.conversationList?.addEventListener("pointerdown", event => {
    row = event.target.closest(".conversation-swipe-row");
    if (!row) return;
    startX = event.clientX;
    startY = event.clientY;
  });

  el.conversationList?.addEventListener("pointerup", event => {
    if (!row) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      el.conversationList.querySelectorAll(".conversation-swipe-row.is-revealed").forEach(item => {
        if (item !== row) item.classList.remove("is-revealed");
      });
      if (dx > 0) row.classList.add("is-revealed");
      else row.classList.remove("is-revealed");
    }
    row = null;
  });
}

function bind() {
  el.conversationList?.addEventListener("click", event => {
    const group = event.target.closest("[data-group-toggle]");
    if (group) { toggleGroup(group.dataset.groupToggle); return; }
    const mute = event.target.closest("[data-mute-conversation]");
    if (mute) { toggleMute(mute.dataset.muteConversation); return; }
    const remove = event.target.closest("[data-remove-conversation]");
    if (remove) { hideConversation(remove.dataset.removeConversation); return; }
    const row = event.target.closest("[data-conversation]");
    if (row && !row.closest(".conversation-swipe-row")?.classList.contains("is-revealed")) openConversation(row.dataset.conversation);
  });

  el.conversationSearch?.addEventListener("input", event => { state.search = event.target.value; renderConversations(); });
  el.conversationSearch?.addEventListener("focus", () => setSearchMode(true));
  el.conversationSearch?.addEventListener("blur", () => setTimeout(() => {
    if (document.activeElement !== el.conversationSearch) setSearchMode(false);
  }, 180));

  el.editConversations?.addEventListener("click", toggleEdit);
  el.newConversationButton?.addEventListener("click", () => openMenu("global"));
  el.composeConversationButton?.addEventListener("click", () => openMenu("global"));
  el.newDirectConversation?.addEventListener("click", createDirectConversation);
  el.newGroupConversation?.addEventListener("click", createGroupConversation);
  el.chatMenuButton?.addEventListener("click", () => openMenu("conversation"));
  el.chatAvatar?.addEventListener("click", () => openMenu("avatar"));
  el.showConversationList?.addEventListener("click", center);
  el.closeMessagesMenu?.addEventListener("click", closeMenu);
  el.menuBackdrop?.addEventListener("click", closeMenu);
  el.closePhotoViewer?.addEventListener("click", closePhoto);
  el.viewConversationPhoto?.addEventListener("click", viewPhoto);
  el.muteConversation?.addEventListener("click", () => { if (state.active) toggleMute(state.active.id); closeMenu(); });
  el.conversationInfo?.addEventListener("click", info);
  el.editConversation?.addEventListener("click", renameActive);
  el.deleteConversation?.addEventListener("click", () => { if (state.active) hideConversation(state.active.id); });
  el.refreshConversations?.addEventListener("click", async () => { closeMenu(); await loadConversations(); });

  el.messageForm?.addEventListener("submit", event => { event.preventDefault(); sendMessage().catch(console.error); });
  el.messageInput?.addEventListener("input", autoSize);
  el.messageInput?.addEventListener("focus", () => { setTimeout(syncViewport,80); setTimeout(syncViewport,280); });
  el.messageInput?.addEventListener("blur", () => setTimeout(syncViewport,120));
  el.messageInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el.messageForm?.requestSubmit();
    }
  });

  window.visualViewport?.addEventListener("resize", syncViewport, { passive:true });
  window.visualViewport?.addEventListener("scroll", syncViewport, { passive:true });
  window.addEventListener("orientationchange", () => setTimeout(syncViewport,150), { passive:true });
  window.addEventListener("pagehide", () => state.off?.(), { once:true });
  swipe();
}

function init() {
  bind();
  center();
  syncViewport();
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.replace("/login.html");
      return;
    }
    state.user = user;
    state.profile = getSavedUserProfile() || {};
    state.conversations = BUILTINS
      .map((conversation,order) => ({ ...conversation, order, builtin:true, type:"role" }))
      .filter(canSee);
    renderConversations();
    ready();
    await loadConversations();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
