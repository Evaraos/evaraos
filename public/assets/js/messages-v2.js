import {
  auth, db, onAuthStateChanged, collection, doc, getDocs, addDoc, setDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, getSavedUserProfile
} from "./firebase.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const BUILTIN = [
  { id: "operations", name: "Operations", description: "Dispatch, scheduling, and daily operations.", roles: ["owner","super_admin","admin","manager","operations_manager","operations_coordinator","sales_rep","technician","cleaner","staff","field_staff","crew_lead"] },
  { id: "field-crews", name: "Field Crews", description: "Technicians, cleaners, and field teams.", roles: ["owner","super_admin","admin","manager","operations_manager","operations_coordinator","technician","cleaner","staff","field_staff","crew_lead"] },
  { id: "hr-support", name: "HR + Support", description: "Hiring, onboarding, payroll, and support.", roles: ["owner","super_admin","admin","hr","hr_manager","customer_support"] },
  { id: "leadership", name: "Leadership", description: "Executive and management communication.", roles: ["owner","super_admin","admin","manager","operations_manager"] }
];

const REGISTRY_CHANNEL = "_group_registry";
const storage = getStorage(getApp());
const state = {
  user: null,
  profile: {},
  conversations: [],
  active: null,
  unsubscribe: null,
  allUsers: [],
  search: "",
  groupImage: "",
  groupBackground: "",
  imageTarget: "photo"
};

const $ = (id) => document.getElementById(id);
let toastTimer = 0;

function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function normalize(value = "") { return String(value || "").trim().toLowerCase(); }
function role() { return normalize(state.profile.role || "staff"); }
function isOwner() { return ["owner", "super_admin"].includes(role()); }
function isAdmin() { return ["owner", "super_admin", "admin", "manager", "operations_manager", "hr_manager"].includes(role()); }
function nameOf(user = {}) { return user.displayName || user.fullName || user.name || user.username || user.email || "User"; }
function initials(value = "") { return String(value).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "E"; }
function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function timeLabel(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date) : "";
}
function avatarMarkup(conversation) {
  return conversation.imageUrl
    ? `<img src="${esc(conversation.imageUrl)}" alt="${esc(conversation.name)}">`
    : `<span>${esc(initials(conversation.name))}</span>`;
}
function canSee(conversation) {
  if (conversation.builtin) return conversation.roles.includes(role());
  const uid = state.user?.uid || "";
  return isAdmin() || conversation.memberUids?.includes(uid) || conversation.adminUids?.includes(uid) || conversation.allowedRoles?.includes(role());
}
function canEdit(conversation) {
  if (conversation?.type === "role") return isOwner();
  const uid = state.user?.uid || "";
  return isAdmin() || conversation?.adminUids?.includes(uid);
}
function showToast(message = "Saved") {
  const toast = $("messagesSaveToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1600);
}

async function loadUsers() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    state.allUsers = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("Users unavailable", error);
    state.allUsers = [];
  }
}

async function loadRegistry() {
  try {
    const snapshot = await getDocs(collection(db, "channels", REGISTRY_CHANNEL, "messages"));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => ["group_meta", "direct_meta", "role_meta"].includes(item.kind) && item.groupId);
  } catch (error) {
    console.warn("Conversation registry unavailable", error);
    return [];
  }
}

async function repairRoleDuplicates(items) {
  if (!isOwner()) return items;
  const output = [];
  for (const item of items) {
    const builtin = BUILTIN.find((base) => normalize(base.name) === normalize(item.name));
    const accidental = item.kind === "group_meta" && builtin && String(item.groupId || "").startsWith("group-");
    if (!accidental) {
      output.push(item);
      continue;
    }
    await setDoc(doc(db, "channels", REGISTRY_CHANNEL, "messages", builtin.id), {
      kind: "role_meta",
      groupId: builtin.id,
      name: builtin.name,
      imageUrl: item.imageUrl || "",
      backgroundImageUrl: item.backgroundImageUrl || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
    try {
      const messages = await getDocs(collection(db, "channels", item.groupId, "messages"));
      for (const message of messages.docs) await deleteDoc(doc(db, "channels", item.groupId, "messages", message.id));
      await deleteDoc(doc(db, "channels", REGISTRY_CHANNEL, "messages", item.id));
    } catch (error) {
      console.warn("Duplicate role conversation cleanup skipped", error);
    }
  }
  return output;
}

async function loadConversations(preferredId = "") {
  let dynamic = await loadRegistry();
  dynamic = await repairRoleDuplicates(dynamic);
  const roleOverrides = new Map(dynamic.filter((item) => item.kind === "role_meta").map((item) => [item.groupId, item]));
  const builtin = BUILTIN.map((base) => ({
    ...base,
    ...(roleOverrides.get(base.id) || {}),
    id: base.id,
    builtin: true,
    type: "role",
    memberUids: [],
    adminUids: []
  }));
  const custom = dynamic
    .filter((item) => item.kind !== "role_meta")
    .map((item) => ({ ...item, id: item.groupId, type: item.kind === "direct_meta" ? "direct" : "group", builtin: false }));
  const merged = [...builtin, ...custom].filter(canSee);
  state.conversations = merged;
  const nextId = preferredId || state.active?.id;
  state.active = nextId && merged.some((item) => item.id === nextId)
    ? merged.find((item) => item.id === nextId)
    : merged[0] || null;
  renderConversations();
  openConversation(state.active?.id);
}

function sectionMarkup(title, items) {
  if (!items.length) return "";
  return `<section class="conversation-section"><h2 class="conversation-section-title">${title}</h2><div class="conversation-section-list">${items.map((item) => `<button class="conversation-item ${state.active?.id === item.id ? "is-active" : ""}" type="button" data-conversation="${esc(item.id)}"><span class="conversation-avatar">${avatarMarkup(item)}</span><span class="conversation-copy"><strong>${esc(item.name)}</strong><span>${esc(item.lastMessage || item.description || "No messages yet")}</span></span><span class="conversation-meta">${item.type === "role" ? "Role" : item.type === "direct" ? "Direct" : "Group"}</span></button>`).join("")}</div></section>`;
}

function renderConversations() {
  const root = $("conversationList");
  if (!root) return;
  const search = normalize(state.search);
  const items = state.conversations.filter((item) => !search || normalize(item.name).includes(search) || normalize(item.description).includes(search));
  root.innerHTML = sectionMarkup("Role channels", items.filter((item) => item.type === "role"))
    + sectionMarkup("Direct messages", items.filter((item) => item.type === "direct"))
    + sectionMarkup("Group chats", items.filter((item) => item.type === "group"))
    || `<div class="messages-empty">No conversations match your search.</div>`;
}

function applyChatBackground(conversation) {
  const chat = $("messagesChat");
  if (!chat) return;
  const hasBackground = Boolean(conversation?.backgroundImageUrl);
  chat.classList.toggle("has-background", hasBackground);
  if (hasBackground) chat.style.setProperty("--message-chat-background", `url(${JSON.stringify(conversation.backgroundImageUrl)})`);
  else chat.style.removeProperty("--message-chat-background");
}

function renderHeader() {
  const conversation = state.active;
  if (!conversation) return;
  $("chatAvatar").innerHTML = avatarMarkup(conversation);
  $("chatTitle").textContent = conversation.name;
  $("chatSubtitle").textContent = conversation.type === "group"
    ? `${conversation.memberUids?.length || 0} members`
    : conversation.type === "direct"
      ? "Direct message"
      : conversation.description || "Role channel";
  $("editGroupBtn").hidden = !canEdit(conversation);
  applyChatBackground(conversation);
}

function renderMessages(messages = []) {
  const root = $("chatFeed");
  if (!root) return;
  const visible = messages.filter((message) => !["group_meta", "direct_meta", "role_meta"].includes(message.kind));
  root.innerHTML = visible.length
    ? visible.map((message) => {
        const mine = message.senderUid === state.user?.uid;
        return `<div class="message-row ${mine ? "mine" : ""}">${mine ? "" : `<span class="message-sender-avatar">${esc(initials(message.senderName || "U"))}</span>`}<div>${mine ? "" : `<p class="message-author">${esc(message.senderName || "Unknown")} <span class="role-badge">${esc(String(message.senderRole || "staff").replaceAll("_", " "))}</span></p>`}<div class="message-bubble">${esc(message.text || "")}</div><div class="message-time">${esc(timeLabel(message.createdAt))}</div></div></div>`;
      }).join("")
    : `<div class="messages-empty">Start the conversation.</div>`;
  root.scrollTop = root.scrollHeight;
}

function subscribe() {
  state.unsubscribe?.();
  if (!state.active) return;
  const messagesQuery = query(collection(db, "channels", state.active.id, "messages"), orderBy("createdAt", "asc"));
  state.unsubscribe = onSnapshot(messagesQuery,
    (snapshot) => renderMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (error) => { $("chatFeed").innerHTML = `<div class="messages-empty">${esc(error.message || "Unable to load messages")}</div>`; }
  );
}

function openConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  state.active = conversation;
  renderConversations();
  renderHeader();
  subscribe();
  document.querySelector(".messages-app")?.classList.remove("show-list");
}

async function sendMessage() {
  const input = $("messageInput");
  const text = input.value.trim();
  if (!text || !state.active) return;
  await addDoc(collection(db, "channels", state.active.id, "messages"), {
    text,
    senderUid: state.user.uid,
    senderName: nameOf(state.profile) || state.user.email,
    senderRole: state.profile.role || "staff",
    companyId: state.profile.companyId || "",
    createdAt: serverTimestamp()
  });
  input.value = "";
  autoSize();
}

function autoSize() {
  const input = $("messageInput");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(130, input.scrollHeight)}px`;
}

function renderGroupVisuals(name = "Group") {
  const photo = $("groupImagePreview");
  const background = $("groupBackgroundPreview");
  if (photo) photo.innerHTML = state.groupImage ? `<img src="${esc(state.groupImage)}" alt="Conversation">` : `<span>${esc(initials(name))}</span>`;
  if (background) background.innerHTML = state.groupBackground ? `<img src="${esc(state.groupBackground)}" alt="Chat background">` : `<span>No chat background</span>`;
}

function groupForm(conversation = null) {
  const selected = new Set(conversation?.memberUids || [state.user?.uid].filter(Boolean));
  state.groupImage = conversation?.imageUrl || "";
  state.groupBackground = conversation?.backgroundImageUrl || "";
  $("groupSheetTitle").textContent = conversation?.type === "role" ? "Edit role channel" : conversation ? "Edit conversation" : "New group";
  $("groupName").value = conversation?.name || "";
  $("groupConversationId").value = conversation?.id || "";
  renderGroupVisuals(conversation?.name || "New Group");
  const roleChannel = conversation?.type === "role";
  $("groupMembersField").hidden = roleChannel;
  const available = state.allUsers.filter((user) => user.active !== false && user.id !== state.user?.uid);
  $("groupMembers").innerHTML = available.map((user) => `<label class="member-option"><span>${esc(nameOf(user))}<small>${esc(String(user.role || "staff").replaceAll("_", " "))}</small></span><input type="checkbox" value="${esc(user.id)}" ${selected.has(user.id) ? "checked" : ""}></label>`).join("") || `<p class="messages-empty">No additional users are available.</p>`;
  $("groupDeleteZone").hidden = !(conversation && !conversation.builtin && isOwner());
  $("groupSheet").hidden = false;
}

async function compressToBlob(file, target) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose an image smaller than 12 MB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = () => reject(new Error("Image could not be opened."));
    node.src = data;
  });
  const width = target === "background" ? 1280 : 512;
  const height = target === "background" ? 720 : 512;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, (width - image.naturalWidth * scale) / 2, (height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  return await new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Image could not be processed.")),
    "image/webp",
    target === "background" ? 0.66 : 0.76
  ));
}

function conversationIdForEdit() { return $("groupConversationId").value || ""; }
function userStoragePath(conversationId, target) {
  const userId = state.user?.uid || auth.currentUser?.uid;
  if (!userId) throw new Error("Your session expired. Sign in again.");
  return `users/${userId}/message-${conversationId}-${target === "background" ? "background" : "avatar"}.webp`;
}

async function uploadConversationImage(file, target) {
  const conversationId = conversationIdForEdit();
  if (!conversationId) throw new Error("Save the new group before adding images.");
  const blob = await compressToBlob(file, target);
  const fileRef = storageRef(storage, userStoragePath(conversationId, target));
  await uploadBytes(fileRef, blob, { contentType: "image/webp" });
  return await getDownloadURL(fileRef);
}

function buildPayload(id) {
  const existing = state.conversations.find((item) => item.id === id);
  const isRoleChannel = existing?.type === "role" || BUILTIN.some((item) => item.id === id);
  const members = isRoleChannel ? [] : [state.user.uid, ...[...$("groupMembers").querySelectorAll("input:checked")].map((input) => input.value)];
  return {
    kind: isRoleChannel ? "role_meta" : existing?.type === "direct" ? "direct_meta" : "group_meta",
    groupId: id,
    name: $("groupName").value.trim() || existing?.name || "Group",
    imageUrl: state.groupImage,
    backgroundImageUrl: state.groupBackground,
    description: existing?.description || "Group conversation",
    memberUids: isRoleChannel ? [] : [...new Set(members.length ? members : existing?.memberUids || [state.user.uid])],
    adminUids: isRoleChannel ? [] : existing?.adminUids?.length ? existing.adminUids : [state.user.uid],
    allowedRoles: isRoleChannel ? existing?.roles || BUILTIN.find((item) => item.id === id)?.roles || [] : existing?.allowedRoles || [],
    companyId: state.profile.companyId || existing?.companyId || "",
    createdBy: existing?.createdBy || state.user.uid,
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

async function persistVisual() {
  const id = conversationIdForEdit();
  if (!id) return false;
  await setDoc(doc(db, "channels", REGISTRY_CHANNEL, "messages", id), buildPayload(id), { merge: true });
  await loadConversations(id);
  groupForm(state.conversations.find((item) => item.id === id));
  showToast("Conversation appearance saved");
  return true;
}

async function useImageInput(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    showToast("Uploading image…");
    const url = await uploadConversationImage(file, state.imageTarget);
    if (state.imageTarget === "background") state.groupBackground = url;
    else state.groupImage = url;
    renderGroupVisuals($("groupName").value || "Conversation");
    await persistVisual();
  } catch (error) {
    const message = error?.code === "storage/unauthorized"
      ? "Firebase Storage blocked this upload. The app is now using your authenticated user folder; refresh after the latest deployment and try again."
      : error.message || "Unable to use image";
    alert(message);
  } finally {
    input.value = "";
  }
}

async function saveGroup(event) {
  event.preventDefault();
  const existingId = conversationIdForEdit();
  const id = existingId || `group-${crypto.randomUUID()}`;
  await setDoc(doc(db, "channels", REGISTRY_CHANNEL, "messages", id), buildPayload(id), { merge: true });
  $("groupSheet").hidden = true;
  await loadConversations(id);
  showToast(existingId ? "Conversation updated" : "Group created");
}

async function removeStoredVisuals(id) {
  for (const target of ["photo", "background"]) {
    try {
      await deleteObject(storageRef(storage, userStoragePath(id, target)));
    } catch (error) {
      if (error?.code !== "storage/object-not-found") console.warn("Storage cleanup skipped", error);
    }
  }
}

async function removeConversation() {
  if (!isOwner() || !state.active || state.active.builtin) return;
  const id = state.active.id;
  const messages = await getDocs(collection(db, "channels", id, "messages"));
  for (const message of messages.docs) await deleteDoc(doc(db, "channels", id, "messages", message.id));
  await deleteDoc(doc(db, "channels", REGISTRY_CHANNEL, "messages", id));
  await removeStoredVisuals(id);
  state.active = null;
  $("deleteConversationSheet").hidden = true;
  $("groupSheet").hidden = true;
  await loadConversations();
  showToast("Conversation removed");
}

function bind() {
  $("conversationList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-conversation]");
    if (button) openConversation(button.dataset.conversation);
  });
  $("conversationSearch")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderConversations();
  });
  $("newGroupBtn")?.addEventListener("click", () => groupForm());
  $("editGroupBtn")?.addEventListener("click", () => groupForm(state.active));
  $("closeGroupSheet")?.addEventListener("click", () => { $("groupSheet").hidden = true; });
  $("cancelGroupBtn")?.addEventListener("click", () => { $("groupSheet").hidden = true; });
  $("groupForm")?.addEventListener("submit", (event) => saveGroup(event).catch((error) => alert(error.message || "Unable to save")));
  $("groupName")?.addEventListener("input", () => { if (!state.groupImage) renderGroupVisuals($("groupName").value || "Conversation"); });
  $("attachConversationPhoto")?.addEventListener("click", () => { state.imageTarget = "photo"; $("conversationImageInput")?.click(); });
  $("attachConversationBackground")?.addEventListener("click", () => { state.imageTarget = "background"; $("conversationImageInput")?.click(); });
  $("conversationImageInput")?.addEventListener("change", () => useImageInput($("conversationImageInput")));
  $("removeGroupImage")?.addEventListener("click", async () => {
    state.groupImage = "";
    renderGroupVisuals($("groupName").value || "Conversation");
    try {
      await persistVisual();
      const id = conversationIdForEdit();
      if (id) await deleteObject(storageRef(storage, userStoragePath(id, "photo"))).catch(() => {});
    } catch (error) { alert(error.message || "Unable to remove image"); }
  });
  $("removeGroupBackground")?.addEventListener("click", async () => {
    state.groupBackground = "";
    renderGroupVisuals($("groupName").value || "Conversation");
    try {
      await persistVisual();
      const id = conversationIdForEdit();
      if (id) await deleteObject(storageRef(storage, userStoragePath(id, "background"))).catch(() => {});
    } catch (error) { alert(error.message || "Unable to remove background"); }
  });
  $("deleteConversationBtn")?.addEventListener("click", () => { $("deleteConversationSheet").hidden = false; });
  $("cancelDeleteConversation")?.addEventListener("click", () => { $("deleteConversationSheet").hidden = true; });
  $("confirmDeleteConversation")?.addEventListener("click", () => removeConversation().catch((error) => alert(error.message || "Unable to remove conversation")));
  $("messageForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage().catch((error) => alert(error.message || "Message failed"));
  });
  $("messageInput")?.addEventListener("input", autoSize);
  $("messageInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("messageForm")?.requestSubmit();
    }
  });
  $("showConversationList")?.addEventListener("click", () => document.querySelector(".messages-app")?.classList.add("show-list"));
}

function init() {
  bind();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.assign("/login.html");
      return;
    }
    state.user = user;
    state.profile = getSavedUserProfile() || {};
    await loadUsers();
    await loadConversations();
    document.body.classList.remove("auth-pending", "app-loading");
    document.body.classList.add("app-ready");
    window.EvaraLoader?.markAppReady?.();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
