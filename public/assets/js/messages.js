import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const CHANNELS = [
  {
    id: "operations",
    name: "Operations",
    description: "Dispatch updates, operational changes, and field coordination."
  },
  {
    id: "field-crews",
    name: "Field Crews",
    description: "Technician and cleaner communication channel."
  },
  {
    id: "hr-support",
    name: "HR + Support",
    description: "Hiring, onboarding, payroll, and support requests."
  },
  {
    id: "leadership",
    name: "Leadership",
    description: "Management and executive planning communication."
  }
];

const channelList = document.getElementById("channelList");
const chatFeed = document.getElementById("chatFeed");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatTitle = document.getElementById("chatTitle");
const chatSubtitle = document.getElementById("chatSubtitle");
const messagesCount = document.getElementById("messagesCount");
const activeChannelLabel = document.getElementById("activeChannelLabel");
const messageRoleLabel = document.getElementById("messageRoleLabel");

let activeUser = null;
let activeProfile = null;
let activeChannel = CHANNELS[0].id;
let unsubscribeFeed = null;

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function roleLabel(role = "") {
  return String(role || "staff")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function renderChannels() {
  channelList.innerHTML = CHANNELS.map((channel) => `
    <button
      type="button"
      class="channel-btn ${channel.id === activeChannel ? "active" : ""}"
      data-channel="${escapeHtml(channel.id)}"
    >
      ${escapeHtml(channel.name)}
    </button>
  `).join("");
}

function renderMessages(messages = []) {
  messagesCount.textContent = String(messages.length);

  if (!messages.length) {
    chatFeed.innerHTML = `<div class="empty-card">No messages in this channel yet.</div>`;
    return;
  }

  chatFeed.innerHTML = messages.map((message) => {
    const mine = normalize(message.senderUid) === normalize(activeUser?.uid || "");

    return `
      <article class="chat-message ${mine ? "mine" : ""}">
        <strong>${escapeHtml(message.senderName || "Unknown")}</strong>
        <p>${escapeHtml(message.text || "")}</p>
        <time>${escapeHtml(new Date(message.createdAt?.seconds ? message.createdAt.seconds * 1000 : Date.now()).toLocaleString())}</time>
      </article>
    `;
  }).join("");

  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function subscribeToChannel(channelId) {
  unsubscribeFeed?.();

  const channel = CHANNELS.find((item) => item.id === channelId) || CHANNELS[0];

  activeChannel = channel.id;
  activeChannelLabel.textContent = channel.name;
  chatTitle.textContent = channel.name;
  chatSubtitle.textContent = channel.description;

  renderChannels();

  const messagesQuery = query(
    collection(db, "channels", channel.id, "messages"),
    orderBy("createdAt", "asc")
  );

  unsubscribeFeed = onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    renderMessages(messages);
  }, (error) => {
    console.error("Message subscription failed:", error);

    chatFeed.innerHTML = `
      <div class="empty-card">
        Unable to load channel.<br /><br />${escapeHtml(error.message || "Realtime error")}
      </div>
    `;
  });
}

async function sendMessage() {
  const text = String(chatInput.value || "").trim();
  if (!text) return;

  const payload = {
    text,
    senderUid: activeUser?.uid || "",
    senderName:
      activeProfile?.fullName ||
      activeProfile?.displayName ||
      activeUser?.displayName ||
      activeUser?.email ||
      "Staff",
    senderRole: activeProfile?.role || "staff",
    companyName: activeProfile?.companyName || "",
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "channels", activeChannel, "messages"), payload);

  chatInput.value = "";
}

function bindEvents() {
  channelList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-channel]");
    if (!button) return;

    subscribeToChannel(button.getAttribute("data-channel"));
  });

  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await sendMessage();
    } catch (error) {
      console.error("Message send failed:", error);
      alert(error.message || "Could not send message.");
    }
  });
}

function init() {
  bindEvents();
  renderChannels();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign("/login.html");
      return;
    }

    activeUser = user;
    activeProfile = getSavedUserProfile() || {};

    messageRoleLabel.textContent = roleLabel(activeProfile?.role || "staff");

    subscribeToChannel(activeChannel);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
