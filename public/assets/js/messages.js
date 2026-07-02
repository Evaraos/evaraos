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
const GROUPS = [
  { key: "direct", title: "Direct Messages" },
  { key: "group", title: "Groups" },
  { key: "role", title: "Teams" }
];

const state = {
  user: null,
  profile: {},
  conversations: [],
  active: null,
  unsubscribe: null,
  search: ""
};

const elements = {
  app: document.querySelector(".messages-app"),
  conversationList: document.getElementById("conversationList"),
  conversationSearch: document.getElementById("conversationSearch"),
  newConversationButton: document.getElementById("newConversationButton"),
  refreshButton: document.getElementById("refreshConversations"),
  closeMenuButton: document.getElementById("closeMessagesMenu"),
  menu: document.getElementById("messagesMenu"),
  menuBackdrop: document.querySelector(".messages-sheet-backdrop"),
  chatMenuButton: document.getElementById("chatMenuButton"),
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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((today - messageDay) / 86400000);

  if (dayDifference === 0) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  if (dayDifference === 1) return "Yesterday";
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric", year: "2-digit" }).format(date);
}

function messageTimeLabel(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function dayKey(value) {
  const date = toDate(value);
  if (!date) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value) {
  const date = toDate(value);
  if (!date) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((today - messageDay) / 86400000);

  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" })
  }).format(date);
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

function createConversationGroup(title, conversations) {
  const section = document.createElement("section");
  section.className = "messages-conversation-group";

  const heading = document.createElement("h2");
  heading.className = "messages-section-title";
  heading.textContent = title;

  const list = document.createElement("div");
  list.className = "messages-section-list";
  list.replaceChildren(...conversations.map(createConversationRow));

  section.append(heading, list);
  return section;
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

  const sections = GROUPS
    .map((group) => ({
      ...group,
      conversations: visible.filter((conversation) => conversation.type === group.key)
    }))
    .filter((group) => group.conversations.length)
    .map((group) => createConversationGroup(group.title, group.conversations));

  elements.conversationList.replaceChildren(...sections);
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
      limit(8)
    );
    const snapshot = await getDocs(previewQuery);
    const message = snapshot.docs
      .map((entry) => entry.data())
      .find((entry) => !["group_meta", "direct_meta", "role_meta"].includes(entry.kind));

    if (!message) return conversation;

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

  state.conversations = await Promise.all(state.conversations.map(loadPreview));
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

function createDateDivider(value) {
  const divider = document.createElement("div");
  divider.className = "message-date-divider";
  divider.textContent = dayLabel(value);
  return divider;
}

function createMessageRow(message) {
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
  time.textContent = messageTimeLabel(message.createdAt);

  stack.append(bubble, time);
  row.append(stack);
  return row;
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

  const nodes = [];
  let previousDay = "";

  for (const message of messages) {
    const currentDay = dayKey(message.createdAt);
    if (currentDay !== previousDay) {
      nodes.push(createDateDivider(message.createdAt));
      previousDay = currentDay;
    }
    nodes.push(createMessageRow(message));
  }

  elements.chatFeed.replaceChildren(...nodes);
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
        : conversation.description || "Team channel";
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
}

function closeMenu() {
  if (!elements.menu) return;
  elements.menu.hidden = true;
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

  elements.newConversationButton?.addEventListener("click", openMenu);
  elements.chatMenuButton?.addEventListener("click", openMenu);
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
