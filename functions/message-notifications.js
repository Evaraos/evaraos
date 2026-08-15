const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const unique = (values = []) => [...new Set(values.filter(Boolean).map(String))];
const chunks = (values = [], size = 10) => {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
};
const safeId = (value = "") => String(value || "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 420);
const normalize = (value = "") => String(value || "").trim().toLowerCase();
const activeUser = (user = {}) => ["active", "approved"].includes(normalize(user.status))
  && normalize(user.approvalStatus) === "approved";
const notificationsEnabled = (user = {}) => {
  const preferences = user.notificationPreferences || {};
  return preferences.messages !== false
    && preferences.messageNotifications !== false
    && preferences.inAppMessages !== false;
};

function previewOf(message = {}) {
  const text = String(message.text || "").trim();
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  if (message.imageUrl || (Array.isArray(message.attachments) && message.attachments.length)) return "Sent an attachment.";
  return "Sent a new message.";
}

async function readRegistry(channelId) {
  const snapshot = await db.doc(`channels/_group_registry/messages/${channelId}`).get();
  return snapshot.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

async function readUser(userId) {
  if (!userId) return null;
  const snapshot = await db.doc(`users/${userId}`).get();
  return snapshot.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

async function usersByIds(userIds = []) {
  const ids = unique(userIds);
  if (!ids.length) return [];
  const snapshots = await db.getAll(...ids.map((userId) => db.doc(`users/${userId}`)));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() || {}) }));
}

async function usersByCompanyAndRoles(companyId, roles = []) {
  const normalizedRoles = unique(roles.map(normalize));
  if (!companyId || !normalizedRoles.length) return [];

  const users = [];
  for (const roleChunk of chunks(normalizedRoles, 10)) {
    const snapshot = await db.collection("users")
      .where("companyId", "==", companyId)
      .where("role", "in", roleChunk)
      .get();
    snapshot.forEach((document) => users.push({ id: document.id, ...(document.data() || {}) }));
  }
  return [...new Map(users.map((user) => [user.id, user])).values()];
}

function senderCanUseRegistry(sender, registry) {
  if (!sender || !registry || !activeUser(sender)) return false;
  const senderId = sender.id;

  if (["direct_meta", "group_meta"].includes(registry.kind)) {
    const members = unique([...(registry.memberUids || []), ...(registry.adminUids || [])]);
    const companyAllowed = !registry.companyId || registry.companyId === sender.companyId;
    return members.includes(senderId) && companyAllowed;
  }

  if (registry.kind === "role_meta") {
    return registry.companyId
      && registry.companyId === sender.companyId
      && (registry.allowedRoles || []).map(normalize).includes(normalize(sender.role));
  }

  return false;
}

async function resolveRecipients(registry, sender) {
  if (["direct_meta", "group_meta"].includes(registry.kind)) {
    return usersByIds(unique([...(registry.memberUids || []), ...(registry.adminUids || [])])
      .filter((userId) => userId !== sender.id));
  }

  const users = await usersByCompanyAndRoles(registry.companyId, registry.allowedRoles || []);
  return users.filter((user) => user.id !== sender.id);
}

function conversationName(channelId, registry = {}) {
  return registry.name
    || registry.title
    || registry.channelKey
    || channelId.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notificationTitle(sender, channelName, directMessage) {
  const senderName = sender.displayName || sender.fullName || sender.name || sender.username || "Someone";
  return directMessage ? senderName : `${senderName} in ${channelName}`;
}

async function writeNotifications({ channelId, messageId, message, registry, sender, recipients }) {
  const channelName = conversationName(channelId, registry);
  const directMessage = registry.kind === "direct_meta";
  const body = previewOf(message);
  const eligible = recipients.filter((user) => user?.id && activeUser(user) && notificationsEnabled(user));
  const route = `/messages.html?conversation=${encodeURIComponent(channelId)}`;
  const title = notificationTitle(sender, channelName, directMessage);
  const writer = db.bulkWriter();

  eligible.forEach((user) => {
    const notificationId = safeId(`message_${channelId}_${messageId}_${user.id}`);
    writer.set(db.doc(`notifications/${notificationId}`), {
      type: "message",
      title,
      message: body,
      detail: body,
      status: "unread",
      priority: "normal",
      audience: "people",
      userId: user.id,
      userEmail: user.email || "",
      companyId: registry.companyId || user.companyId || "",
      companyName: registry.companyName || user.companyName || "",
      channelId,
      conversationId: channelId,
      conversationName: channelName,
      messageId,
      senderUid: sender.id,
      senderName: sender.displayName || sender.fullName || sender.name || sender.username || "User",
      senderRole: normalize(sender.role),
      route,
      actionUrl: route,
      actionType: "open",
      actionLabel: "Open Chat",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  await writer.close();
  return { count: eligible.length, eligible, title, body, route };
}

async function pushTokensForUsers(users = []) {
  const entries = [];
  for (const user of users) {
    const snapshot = await db.collection(`users/${user.id}/pushTokens`).where("enabled", "==", true).get();
    snapshot.forEach((document) => {
      const data = document.data() || {};
      if (data.token) entries.push({ token: data.token, ref: document.ref });
    });
  }
  return entries;
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
          icon: "/assets/brand/evaraos-app-icon.png",
          badge: "/assets/brand/evaraos-app-icon.png",
          tag: `evara-message-${channelId}`,
          renotify: true
        }
      }
    });
    sent += response.successCount;

    const cleanup = [];
    response.responses.forEach((result, responseIndex) => {
      const code = result.error?.code || "";
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code)) {
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
    if (!event.data || event.params.channelId === "_group_registry") return null;

    const channelId = event.params.channelId;
    const messageId = event.params.messageId;
    const message = event.data.data() || {};
    if (["group_meta", "direct_meta", "role_meta"].includes(message.kind) || !message.senderUid) return null;
    if (message.notificationEventId === event.id) return null;

    const [registry, sender] = await Promise.all([
      readRegistry(channelId),
      readUser(message.senderUid)
    ]);

    if (!senderCanUseRegistry(sender, registry)) {
      console.warn("Blocked notification fan-out for unauthorized message", { channelId, messageId, senderUid: message.senderUid });
      await event.data.ref.set({
        notificationBlockedAt: FieldValue.serverTimestamp(),
        notificationBlockedReason: "unauthorized_sender_or_registry",
        notificationEventId: event.id
      }, { merge: true });
      return null;
    }

    const recipients = await resolveRecipients(registry, sender);
    if (!recipients.length) {
      await event.data.ref.set({
        notificationProcessedAt: FieldValue.serverTimestamp(),
        notificationRecipientCount: 0,
        pushNotificationCount: 0,
        notificationEventId: event.id
      }, { merge: true });
      return null;
    }

    const notificationResult = await writeNotifications({ channelId, messageId, message, registry, sender, recipients });
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
      pushNotificationCount: pushCount,
      notificationEventId: event.id
    }, { merge: true });

    return null;
  }
);
