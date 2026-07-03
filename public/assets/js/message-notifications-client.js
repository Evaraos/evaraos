import "./evara-notifications.js";

import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from "./firebase.js";

import {
  createNotification,
  updateNotificationState
} from "./operations-notifications.js";

const MESSAGE_MUTE_KEY = "evaraos-muted-conversations";
const DEVICE_ALERTS_KEY = "evaraos-device-message-alerts";

let unsubscribeNotifications = null;
let authUnsubscribe = null;
let currentUserId = "";
let initialSnapshot = true;
let conversationEventsBound = false;
let deepLinkObserver = null;
const notificationCache = new Map();

function mutedChannels() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MESSAGE_MUTE_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function deviceAlertsEnabled() {
  try { return localStorage.getItem(DEVICE_ALERTS_KEY) !== "off"; }
  catch { return true; }
}

function createdAtMs(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function routeFor(notification = {}) {
  return notification.route || notification.actionUrl || "/messages.html";
}

function activeConversationId() {
  return document.documentElement.dataset.activeConversation
    || new URLSearchParams(location.search).get("conversation")
    || "";
}

function isActiveConversation(channelId = "") {
  return document.body.classList.contains("messages-chat-active")
    && activeConversationId() === channelId;
}

function browserNotificationSupported() {
  return "Notification" in window;
}

function showBrowserNotification(notification = {}) {
  if (!browserNotificationSupported()) return;
  if (!deviceAlertsEnabled()) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden && document.hasFocus()) return;

  const browserNotification = new Notification(notification.title || "New message", {
    body: notification.message || notification.detail || "You received a new message.",
    icon: "/assets/img/icon-192.png",
    badge: "/assets/img/favicon-32.png",
    tag: `evara-message-${notification.channelId || notification.id}`,
    renotify: true,
    data: { route: routeFor(notification), notificationId: notification.id }
  });

  browserNotification.onclick = () => {
    window.focus();
    markMessageNotificationRead(notification.id).catch(() => {});
    window.location.assign(routeFor(notification));
    browserNotification.close();
  };
}

function showInAppNotification(notification = {}) {
  const channelId = notification.channelId || notification.conversationId || "";
  if (mutedChannels().has(channelId)) return;
  if (isActiveConversation(channelId)) return;

  window.dispatchEvent(new CustomEvent("evara:notify", {
    detail: {
      title: notification.title || "New message",
      message: notification.message || notification.detail || "You received a new message.",
      tone: "info",
      timeout: 5200
    }
  }));
}

function registerNotification(id, data = {}) {
  const state = data.status === "read" ? "read" : "unread";
  const notification = {
    id,
    title: data.title || "New message",
    detail: data.message || data.detail || "You received a new message.",
    type: "message",
    level: "info",
    priority: data.priority === "urgent" ? "high" : "medium",
    audience: "people",
    actionUrl: routeFor(data),
    actionType: "open",
    actionLabel: "Open Chat",
    metadata: {
      channelId: data.channelId || data.conversationId || "",
      messageId: data.messageId || "",
      senderUid: data.senderUid || "",
      senderName: data.senderName || ""
    },
    read: state === "read",
    state,
    createdAtMs: createdAtMs(data.createdAt)
  };

  createNotification(notification);
  notificationCache.set(id, { id, ...data });
  return notification;
}

function handleSnapshot(snapshot) {
  const newlyAdded = [];

  snapshot.docChanges().forEach((change) => {
    const data = change.doc.data() || {};
    if (data.type !== "message") return;

    const local = registerNotification(change.doc.id, data);
    if (change.type === "added") newlyAdded.push({ ...data, ...local, id: change.doc.id });
    if (change.type === "modified") {
      updateNotificationState(change.doc.id, data.status === "read" ? "read" : "unread");
    }
    if (change.type === "removed") notificationCache.delete(change.doc.id);
  });

  if (!initialSnapshot) {
    newlyAdded.forEach((notification) => {
      if (notification.senderUid === currentUserId) return;
      if (notification.status === "read") return;
      const channelId = notification.channelId || notification.conversationId || "";
      if (mutedChannels().has(channelId)) return;
      showInAppNotification(notification);
      showBrowserNotification(notification);
    });
  }

  initialSnapshot = false;
  window.dispatchEvent(new CustomEvent("evara:message-notifications-synced", {
    detail: { count: notificationCache.size }
  }));
}

function startUserSubscription(user) {
  stopMessageNotificationSubscription();
  if (!user?.uid) return;

  currentUserId = user.uid;
  initialSnapshot = true;
  const notificationsQuery = query(
    collection(db, "notifications"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc"),
    limit(80)
  );

  unsubscribeNotifications = onSnapshot(
    notificationsQuery,
    handleSnapshot,
    (error) => console.warn("Message notifications unavailable:", error)
  );
}

export async function requestMessageNotificationPermission() {
  if (!browserNotificationSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  try { localStorage.setItem(DEVICE_ALERTS_KEY, permission === "granted" ? "on" : "off"); }
  catch {}
  window.dispatchEvent(new CustomEvent("evara:message-notification-permission", { detail: { permission } }));
  return permission;
}

export async function markMessageNotificationRead(notificationId) {
  const cached = notificationCache.get(notificationId);
  if (!notificationId || !cached) return;

  await updateDoc(doc(db, "notifications", notificationId), {
    status: "read",
    readAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  updateNotificationState(notificationId, "read");
}

export async function markConversationNotificationsRead(channelId) {
  const pending = [...notificationCache.values()].filter((notification) => {
    const notificationChannel = notification.channelId || notification.conversationId || "";
    return notificationChannel === channelId && notification.status !== "read";
  });

  await Promise.all(pending.map((notification) => markMessageNotificationRead(notification.id)));
}

function bindConversationReadTracking() {
  if (conversationEventsBound) return;
  conversationEventsBound = true;

  document.addEventListener("click", (event) => {
    const conversation = event.target.closest?.("[data-conversation]");
    if (conversation?.dataset?.conversation) {
      const channelId = conversation.dataset.conversation;
      document.documentElement.dataset.activeConversation = channelId;
      markConversationNotificationsRead(channelId).catch(() => {});
      return;
    }

    if (event.target.closest?.("#showConversationList")) {
      delete document.documentElement.dataset.activeConversation;
    }
  }, true);
}

function openRequestedConversation() {
  if (!document.body.classList.contains("messages-page")) return;
  const channelId = new URLSearchParams(location.search).get("conversation");
  if (!channelId) return;

  const attemptOpen = () => {
    const rows = document.querySelectorAll("[data-conversation]");
    const row = [...rows].find((candidate) => candidate.dataset.conversation === channelId);
    if (!row) return false;

    document.documentElement.dataset.activeConversation = channelId;
    row.click();
    markConversationNotificationsRead(channelId).catch(() => {});
    deepLinkObserver?.disconnect();
    deepLinkObserver = null;
    return true;
  };

  if (attemptOpen()) return;
  const list = document.getElementById("conversationList");
  if (!list) return;

  deepLinkObserver?.disconnect();
  deepLinkObserver = new MutationObserver(attemptOpen);
  deepLinkObserver.observe(list, { childList: true, subtree: true });
  setTimeout(() => {
    deepLinkObserver?.disconnect();
    deepLinkObserver = null;
  }, 12000);
}

export function startMessageNotificationClient() {
  bindConversationReadTracking();
  openRequestedConversation();
  window.addEventListener("evara:session-ready", openRequestedConversation, { once: true });

  if (authUnsubscribe) return stopMessageNotificationClient;

  authUnsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopMessageNotificationSubscription();
      return;
    }
    startUserSubscription(user);
    openRequestedConversation();
  });

  return stopMessageNotificationClient;
}

function stopMessageNotificationSubscription() {
  if (unsubscribeNotifications) unsubscribeNotifications();
  unsubscribeNotifications = null;
  currentUserId = "";
  initialSnapshot = true;
  notificationCache.clear();
}

export function stopMessageNotificationClient() {
  stopMessageNotificationSubscription();
  if (authUnsubscribe) authUnsubscribe();
  authUnsubscribe = null;
  deepLinkObserver?.disconnect();
  deepLinkObserver = null;
}

window.EvaraMessageNotifications = {
  start: startMessageNotificationClient,
  stop: stopMessageNotificationClient,
  requestPermission: requestMessageNotificationPermission,
  markRead: markMessageNotificationRead,
  markConversationRead: markConversationNotificationsRead
};
