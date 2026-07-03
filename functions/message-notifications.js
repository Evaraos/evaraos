const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const ROLE_CHANNELS = Object.freeze({
  operations: ["owner","super_admin","admin","manager","operations_manager","operations_coordinator","sales_rep","technician","cleaner","staff","field_staff","crew_lead"],
  "field-crews": ["owner","super_admin","admin","manager","operations_manager","operations_coordinator","technician","cleaner","staff","field_staff","crew_lead"],
  "hr-support": ["owner","super_admin","admin","hr","hr_manager","customer_support"],
  leadership: ["owner","super_admin","admin","manager","operations_manager"]
});

const unique = (values = []) => [...new Set(values.filter(Boolean).map(String))];
const chunks = (values = [], size = 10) => {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
};
const safeId = (value = "") => String(value || "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 420);
const previewOf = (message = {}) => {
  const text = String(message.text || "").trim();
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  if (message.imageUrl) return "Sent a photo.";
  return "Sent a new message.";
};
const notificationsEnabled = (user = {}) => {
  const preferences = user.notificationPreferences || {};
  return preferences.messages !== false && preferences.messageNotifications !== false && preferences.inAppMessages !== false;
};
const activeUser = (user = {}) => !["inactive","suspended","deleted","disabled"].includes(String(user.status || "active").trim().toLowerCase());

async function readRegistry(channelId) {
  const snapshot = await db.doc(`channels/_group_registry/messages/${channelId}`).get();
  return snapshot.exists ? snapshot.data() || {} : null;
}

async function usersByIds(userIds = []) {
  const ids = unique(userIds);
  if (!ids.length) return [];
  const snapshots = await db.getAll(...ids.map((userId) => db.doc(`users/${userId}`)));
  return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

async function usersByRoles(roles = []) {
  const normalizedRoles = unique(roles.map((role) => String(role || "").trim().toLowerCase()));
  if (!normalizedRoles.length) return [];
  const users = [];
  for (const roleChunk of chunks(normalizedRoles, 10)) {
    const snapshot = await db.collection("users").where("role", "in", roleChunk).get();
    snapshot.forEach((document) => users.push({ id: document.id, ...document.data() }));
  }
  return [...new Map(users.map((user) => [user.id, user])).values()];
}

async function resolveRecipients(channelId, message, registry) {
  const senderUid = String(message.senderUid || "");
  if (["direct_meta","group_meta"].includes(registry?.kind || "")) {
    return usersByIds(unique([...(registry.memberUids || []), ...(registry.adminUids || [])]).filter((userId) => userId !== senderUid));
  }
  const roles = unique([...(registry?.allowedRoles || []), ...(registry?.roles || []), ...(ROLE_CHANNELS[channelId] || [])]);
  return (await usersByRoles(roles)).filter((user) => user.id !== senderUid);
}

function conversationName(channelId, registry = {}) {
  return registry.name || registry.title || channelId.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notificationTitle(message, channelName, directMessage) {
  const senderName = message.senderName || "Someone";
  return directMessage ? senderName : `${senderName} in ${channelName}`;
}

async function writeNotifications({ channelId, messageId, message, registry, recipients }) {
  const channelName = conversationName(channelId, registry || {});
  const directMessage = registry?.kind === "direct_meta";
  const body = previewOf(message);
  const writes = [];
  const eligible = recipients.filter((user) => user?.id && activeUser(user) && notificationsEnabled(user));

  eligible.forEach((user) => {
    const notificationId = safeId(`message_${channelId}_${messageId}_${user.id}`);
    const route = `/messages.html?conversation=${encodeURIComponent(channelId)}`;
    writes.push({
      ref: db.doc(`notifications/${notificationId}`),
      data: {
        type: "message",
        title: notificationTitle(message, channelName, directMessage),
        message: body,
        detail: body,
        status: "unread",
        priority: "normal",
        audience: "people",
        userId: user.id,
        userEmail: user.email || "",
        companyId: message.companyId || user.companyId || registry?.companyId || "",
        companyName: user.companyName || registry?.companyName || "",
        channelId,
        conversationId: channelId,
        conversationName: channelName,
        messageId,
        senderUid: message.senderUid || "",
        senderName: message.senderName || "User",
        senderRole: message.senderRole || "",
        route,
        actionUrl: route,
        actionType: "open",
        actionLabel: "Open Chat",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });

  for (let index = 0; index < writes.length; index += 450) {
    const batch = db.batch();
    writes.slice(index, index + 450).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }

  return { count: writes.length, eligible, title: notificationTitle(message, channelName, directMessage), body, route: `/messages.html?conversation=${encodeURIComponent(channelId)}` };
}

async function pushTokensForUsers(users = []) {
  const tokenEntries = [];
  for (const user of users) {
    const snapshot = await db.collection(`users/${user.id}/pushTokens`).where("enabled", "==", true).get();
    snapshot.forEach((document) => {
      const data = document.data() || {};
      if (data.token) tokenEntries.push({ token: data.token, ref: document.ref });
    });
  }
  return tokenEntries;
}

async function sendPushNotifications({ users, title, body, route, channelId, messageId }) {
  const entries = await pushTokensForUsers(users);
  if (!entries.length) return 0;

  let sent = 0;
  for (let index = 0; index < entries.length; index += 500) {
    const slice = entries.slice(index, index + 500);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: slice.map((entry) => entry.token),
      notification: { title, body },
      data: { type: "message", route, channelId, messageId },
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: route },
        notification: {
          icon: "/assets/img/icon-192.png",
          badge: "/assets/img/favicon-32.png",
          tag: `evara-message-${channelId}`,
          renotify: true
        }
      }
    });
    sent += response.successCount;

    const cleanup = [];
    response.responses.forEach((result, responseIndex) => {
      const code = result.error?.code || "";
      if (["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(code)) {
        cleanup.push(slice[responseIndex].ref.delete().catch(() => {}));
      }
    });
    if (cleanup.length) await Promise.all(cleanup);
  }
  return sent;
}

exports.notifyChatParticipants = onDocumentCreated(
  { document: "channels/{channelId}/messages/{messageId}", region: "us-central1", retry: true },
  async (event) => {
    const channelId = event.params.channelId;
    const messageId = event.params.messageId;
    const message = event.data?.data() || {};

    if (!event.data || channelId === "_group_registry") return null;
    if (["group_meta","direct_meta","role_meta"].includes(message.kind)) return null;
    if (!message.senderUid) return null;

    const registry = await readRegistry(channelId);
    const recipients = await resolveRecipients(channelId, message, registry);
    if (!recipients.length) return null;

    const notificationResult = await writeNotifications({ channelId, messageId, message, registry, recipients });
    const pushCount = await sendPushNotifications({
      users: notificationResult.eligible,
      title: notificationResult.title,
      body: notificationResult.body,
      route: notificationResult.route,
      channelId,
      messageId
    });

    await event.data.ref.set({
      notificationProcessedAt: FieldValue.serverTimestamp(),
      notificationRecipientCount: notificationResult.count,
      pushNotificationCount: pushCount
    }, { merge: true });

    return null;
  }
);
