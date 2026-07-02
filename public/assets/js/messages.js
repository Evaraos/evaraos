import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const BUILTIN_CONVERSATIONS = [
  {
    id: "operations",
    name: "Operations",
    description: "Dispatch, scheduling, and daily operations.",
    roles: ["owner", "super_admin", "admin", "manager", "operations_manager", "operations_coordinator", "sales_rep", "technician", "cleaner", "staff", "field_staff", "crew_lead"]
  },
  {
    id: "field-crews",
    name: "Field Crews",
    description: "Technicians, cleaners, and field teams.",
    roles: ["owner", "super_admin", "admin", "manager", "operations_manager", "operations_coordinator", "technician", "cleaner", "staff", "field_staff", "crew_lead"]
  },
  {
    id: "hr-support",
    name: "HR + Support",
    description: "Hiring, onboarding, payroll, and support.",
    roles: ["owner", "super_admin", "admin", "hr", "hr_manager", "customer_support"]
  },
  {
    id: "leadership",
    name: "Leadership",
    description: "Executive and management communication.",
    roles: ["owner", "super_admin", "admin", "manager", "operations_manager"]
  }
];

const REGISTRY_CHANNEL = "_group_registry";
const ADMIN_ROLES = new Set(["owner", "super_admin", "admin", "manager", "operations_manager", "hr_manager"]);

const state = {
  user: null,
  profile: {},
  conversations: [],
  active: null,
  unsubscribe: null,
  search: "",
  editing: false
};

const elements = {
  app: document.querySelector(".messages-app"),
  conversationList: document.getElementById("conversationList"),
  conversationSearch: document.getElementById("conversationSearch"),
  editButton: document.getElementById("editConversations"),
  menuButton: document.getElementById("messageMenuButton"),
  chatMenuButton: document.getElementById("chatMenuButton"),
  newConversationButton: document.getElementById("newConversationButton"),
  voiceSearchButton: document.getElementById("voiceSearchButton"),
  refreshButton: document.getElementById("refreshConversations"),
  closeMenuButton: document.getElementById("closeMessagesMenu"),
  menu: document.getElementById("messagesMenu"),
  menuBackdrop: document.querySelector(".messages-sheet-backdrop"),
  backButton: document.getElementById("showConversationList"),
  chatAvatar: document.getElementById("chatAvatar"),
  chatTitle: document.getElementById("chatTitle"),
  chatSubtitle: document.getElementById("chatSubtitle"),
  chatFeed: document.getElementById("chatFeed"),
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("messageInput")
};

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function currentRole() {
  return normalize(state.profile.role || "customer");
}

function isAdmin() {
  return ADMIN_ROLES.has(currentRole());
}

function initials(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "E";
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timestampValue(value) {
  return toDate(value)?.getTime() || 0;
}

function timeLabel(value) {
  const date = toDate(value);
  if (!date) return "";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((startToday - startMessageDay) / 86400000);

  if (dayDifference === 0) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  if (dayDifference === 1) return "Yesterday";
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric", year: "2-digit" }).format(date);
}

function canSee(conversation) {
  if (conversation.builtin) return conversation.roles.includes(currentRole());
  const uid = state.user?.uid || "";
  return isAdmin()
    || conversation.memberUids?.includes(uid)
    || conversation.adminUids?.includes(uid)
    || conversation.allowedRoles?.includes(currentRole());
}

function setPageReady() {
  document.documentElement.classList.remove("auth-pending", "boot-pending", "evara-boot-lock");
  document.body.classList.remove("auth-pending", "app-loading");
  document.body.classList.add("app-ready");
  window.EvaraLoader?.markAppReady?.();
}

function setAvatar(container, conversation) {
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

function createConversationRow(conversation) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `conversation-item${state.active?.id === conversation.id ? " is-active" : ""}`;
  button.dataset.conversation = conversation.id;
  button.setAttribute("role", "listitem");

  const avatar = document.createElement("span");
  avatar.className = "conversation-avatar";
  setAvatar(avatar, conversation);

  const copy = document.createElement("span");
  copy.className = "conversation-copy";

  const name = document.createElement("strong");
  name.textContent = conversation.name || "Conversation";

  const preview = document.createElement("span");
  const senderPrefix = conversation.lastSenderUid === state.user?.uid && conversation.lastMessage ? "You: " : "";
  preview.textContent = `${senderPrefix}${conversation.lastMessage || conversation.description || "No messages yet"}`;

  const meta = document.createElement("span");
  meta.className = "conversation-meta";
  meta.textContent = timeLabel(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt);

  const chevron = document.createElement("span");
  chevron.className = "conversation-chevron";
  chevron.setAttribute("aria-hidden", "true");

  copy.append(name, preview);
  button.append(avatar, copy, meta, chevron);
  return button;
}

function sortedConversations(items) {
  return [...items].sort((left, right) => {
    const timeDifference = timestampValue(right.lastMessageAt || right.updatedAt) - timestampValue(left.lastMessageAt || left.updatedAt);
    if (timeDifference) return timeDifference;
    return (left.order ?? 99) - (right.order ?? 99);
  });
}

function renderConversations() {
  if (!elements.conversationList) return;

  const search = normalize(state.search);
  const visible = sortedConversations(state.conversations).filter((conversation) => {
    if (!search) return true;
    return normalize(conversation.name).includes(search)
      || normalize(conversation.lastMessage).includes(search)
      || normalize(conversation.description).includes(search);
  });

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "messages-empty";
    empty.textContent = search ? "No conversations match your search." : "No conversations are available for this account.";
    elements.conversationList.replaceChildren(empty);
    return;
  }

  elements.conversationList.replaceChildren(...visible.map(createConversationRow));
}

async function loadRegistry() {
  try {
    const snapshot = await getDocs(collection(db, "channels", REGISTRY_CHANNEL, "messages"));
    return snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((entry) => ["group_meta", "direct_meta", "role_meta"].includes(entry.kind) && entry.groupId);
  } catch (error) {
    console.warn("Conversation registry unavailable:", error);
    return [];
  }
}

function mergeConversations(registryEntries) {
  const roleOverrides = new Map(
    registryEntries
      .filter((entry) => entry.kind === "role_meta")
      .map((entry) => [entry.groupId, entry])
  );

  const builtins = BUILTIN_CONVERSATIONS.map((base, order) => ({
    ...base,
    ...(roleOverrides.get(base.id) || {}),
    id: base.id,
    builtin: true,
    type: "role",
    order,
    memberUids: [],
    adminUids: []
  }));

  const custom = registryEntries
    .filter((entry) => entry.kind !== "role_meta")
    .map((entry, index) => ({
      ...entry,
      id: entry.groupId,
      builtin: false,
      type: entry.kind === "direct_meta" ? "direct" : "group",
      order: BUILTIN_CONVERSATIONS.length + index
    }));

  return [...builtins, ...custom].filter(canSee);
}

async function loadPreview(conversation) {
  try {
    const previewQuery = query(
      collection(db, "channels", conversation.id, "messages"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(previewQuery);
    const message = snapshot.docs[0]?.data();
    if (!message || ["group_meta", "direct_meta", "role_meta"].includes(message.kind)) return conversation;

    return {
      ...conversation,
      lastMessage: message.text || conversation.lastMessage || "",
      lastMessageAt: message.createdAt || conversation.lastMessageAt || null,
      lastSenderUid: message.senderUid || ""
    };
  } catch (error) {
    console.warn(`Preview unavailable for ${conversation.id}:`, error);
    return conversation;
  }
}

async function loadConversations() {
  const registryEntries = await loadRegistry();
  state.conversations = mergeConversations(registryEntries);
  renderConversations();

  const previews = await Promise.all(state.conversations.map(loadPreview));
  state.conversations = previews;
  renderConversations();
}

function showMessageCenter() {
  state.unsubscribe?.();
  state.unsubscribe = null;
  state.active = null;
  document.body.classList.remove("messages-chat-active");
  elements.app?.classList.add("show-list");
  document.documentElement.dataset.messagesView = "center";
  renderConversations();
}

function renderMessages(snapshot) {
  if (!elements.chatFeed || !state.active) return;

  const messages = snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((message) => !["group_meta", "direct_meta", "role_meta"].includes(message.kind));

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "messages-empty";
    empty.textContent = "Start the conversation.";
    elements.chatFeed.replaceChildren(empty);
    return;
  }

  const rows = messages.map((message) => {
    const row = document.createElement("article");
    row.className = `message-row${message.senderUid === state.user?.uid ? " mine" : ""}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text || "";

    row.append(bubble);
    return row;
  });

  elements.chatFeed.replaceChildren(...rows);
  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;

  const latest = messages.at(-1);
  const index = state.conversations.findIndex((conversation) => conversation.id === state.active.id);
  if (index >= 0 && latest) {
    state.conversations[index] = {
      ...state.conversations[index],
      lastMessage: latest.text || "",
      lastMessageAt: latest.createdAt || null,
      lastSenderUid: latest.senderUid || ""
    };
  }
}

function openConversation(conversationId) {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;

  state.active = conversation;
  elements.app?.classList.remove("show-list");
  document.body.classList.add("messages-chat-active");
  document.documentElement.dataset.messagesView = "chat";

  setAvatar(elements.chatAvatar, conversation);
  if (elements.chatTitle) elements.chatTitle.textContent = conversation.name || "Conversation";
  if (elements.chatSubtitle) {
    elements.chatSubtitle.textContent = conversation.type === "direct"
      ? "Direct message"
      : conversation.type === "group"
        ? `${conversation.memberUids?.length || 0} members`
        : conversation.description || "Role channel";
  }

  state.unsubscribe?.();
  const messagesQuery = query(
    collection(db, "channels", conversation.id, "messages"),
    orderBy("createdAt", "asc")
  );

  state.unsubscribe = onSnapshot(
    messagesQuery,
    renderMessages,
    (error) => {
      console.error("Message subscription failed:", error);
      const empty = document.createElement("div");
      empty.className = "messages-empty";
      empty.textContent = error.message || "Unable to load messages.";
      elements.chatFeed?.replaceChildren(empty);
    }
  );

  renderConversations();
}

async function sendMessage() {
  const text = String(elements.messageInput?.value || "").trim();
  if (!text || !state.active || !state.user) return;

  elements.messageInput.value = "";
  autoSizeMessageInput();

  await addDoc(collection(db, "channels", state.active.id, "messages"), {
    text,
    senderUid: state.user.uid,
    senderName:
      state.profile.displayName
      || state.profile.fullName
      || state.profile.name
      || state.user.displayName
      || state.user.email
      || "User",
    senderRole: state.profile.role || "customer",
    companyId: state.profile.companyId || "",
    createdAt: serverTimestamp()
  });
}

function autoSizeMessageInput() {
  if (!elements.messageInput) return;
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(128, elements.messageInput.scrollHeight)}px`;
}

function openMenu() {
  if (!elements.menu) return;
  elements.menu.hidden = false;
  elements.menuButton?.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  if (!elements.menu) return;
  elements.menu.hidden = true;
  elements.menuButton?.setAttribute("aria-expanded", "false");
}

function toggleEditing() {
  state.editing = !state.editing;
  elements.app?.classList.toggle("is-editing", state.editing);
  if (elements.editButton) {
    elements.editButton.textContent = state.editing ? "Done" : "Edit";
    elements.editButton.setAttribute("aria-pressed", String(state.editing));
  }
}

function startVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    elements.conversationSearch?.focus();
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = document.documentElement.lang || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener("result", (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    if (elements.conversationSearch) elements.conversationSearch.value = transcript;
    state.search = transcript;
    renderConversations();
  }, { once: true });
  recognition.start();
}

function bindEvents() {
  elements.conversationList?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-conversation]");
    if (row) openConversation(row.dataset.conversation);
  });

  elements.conversationSearch?.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderConversations();
  });

  elements.editButton?.addEventListener("click", toggleEditing);
  elements.menuButton?.addEventListener("click", openMenu);
  elements.chatMenuButton?.addEventListener("click", openMenu);
  elements.newConversationButton?.addEventListener("click", openMenu);
  elements.voiceSearchButton?.addEventListener("click", startVoiceSearch);
  elements.backButton?.addEventListener("click", showMessageCenter);
  elements.closeMenuButton?.addEventListener("click", closeMenu);
  elements.menuBackdrop?.addEventListener("click", closeMenu);

  elements.refreshButton?.addEventListener("click", async () => {
    closeMenu();
    await loadConversations();
  });

  elements.messageForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage().catch((error) => {
      console.error("Message send failed:", error);
    });
  });

  elements.messageInput?.addEventListener("input", autoSizeMessageInput);
  elements.messageInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.messageForm?.requestSubmit();
    }
  });

  window.addEventListener("pagehide", () => state.unsubscribe?.(), { once: true });
}

function init() {
  bindEvents();
  showMessageCenter();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("/login.html");
      return;
    }

    state.user = user;
    state.profile = getSavedUserProfile() || {};
    state.conversations = BUILTIN_CONVERSATIONS
      .map((conversation, order) => ({ ...conversation, order, builtin: true, type: "role" }))
      .filter(canSee);

    renderConversations();
    setPageReady();
    await loadConversations();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
