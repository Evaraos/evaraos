const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const ROLE_CHANNELS = Object.freeze({
  operations: [
    "owner", "super_admin", "admin", "manager", "operations_manager",
    "operations_coordinator", "sales_rep", "technician", "cleaner",
    "staff", "field_staff", "crew_lead"
  ],
  "field-crews": [
    "owner", "super_admin", "admin", "manager", "operations_manager",
    "operations_coordinator", "technician", "cleaner", "staff",
    "field_staff", "crew_lead"
  ],
  "hr-support": [
    "owner", "super_admin", "admin", "hr", "hr_manager", "customer_support"
  ],
  leadership: [
    "owner", "super_admin", "admin", "manager", "operations_manager"
  ]
});

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function chunks(values = [], size = 10) {
  const output = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function safeId(value = "") {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 420);
}

function previewOf(message = {}) {
  const text = String(message.text || "").trim();
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  if (message.imageUrl) return "Sent a photo.";
  return "Sent a new message.";
}

function nameOfUser(user = {}, fallback = "User") {
  return user.displayName || user.fullName || user.name || user.username || user.email || fallback;
}

function notificationsEnabled(user = {}) {
  const preferences = user.notificationPreferences || {};
  return preferences.messages !== false
    && preferences.messageNotifications !== false
    && preferences.inAppMessages !== false;
}

function activeUser(user = {}) {
  const status = String(user.status || "active").trim().toLowerCase();
  return !["inactive", "suspended", "deleted", "disabled"].includes(status);
}

async function readRegistry(channelId) {
  const snapshot = await db.doc(`channels/_group_registry/messages/${channelId}`).get();
  return snapshot.exists ? snapshot.data() || {} : null;
}

async function usersByIds(userIds = []) {
  const ids = unique(userIds);
  if (!ids.length) return [];
  const refs = ids.map((userId) => db.doc(`users/${userId}`));
  const snapshots = await db.getAll(...refs);
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
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
  const kind = registry?.kind || "";

  if (kind === "direct_meta" || kind === "group_meta") {
    const ids = unique([...(registry.memberUids || []), ...(registry.adminUids || [])])
      .filter((userId) => userId !== senderUid);
    return usersByIds(ids);
  }

  const roles = unique([
    ...(registry?.allowedRoles || []),
    ...(registry?.roles || []),
    ...(ROLE_CHANNELS[channelId] || [])
  ]);

  const users = await usersByRoles(roles);
  return users.filter((user) => user.id !== senderUid);
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

  recipients
    .filter((user) => user?.id && activeUser(user) && notificationsEnabled(user))
    .forEach((user) => {
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

  return writes.length;
}

exports.notifyChatParticipants = onDocumentCreated(
  {
    document: "channels/{channelId}/messages/{messageId}",
    region: "us-central1",
    retry: true
  },
  async (event) => {
    const channelId = event.params.channelId;
    const messageId = event.params.messageId;
    const message = event.data?.data() || {};

    if (!event.data || channelId === "_group_registry") return null;
    if (["group_meta", "direct_meta", "role_meta"].includes(message.kind)) return null;
    if (!message.senderUid) return null;

    const registry = await readRegistry(channelId);
    const recipients = await resolveRecipients(channelId, message, registry);
    if (!recipients.length) return null;

    const notificationCount = await writeNotifications({
      channelId,
      messageId,
      message,
      registry,
      recipients
    });

    await event.data.ref.set({
      notificationProcessedAt: FieldValue.serverTimestamp(),
      notificationRecipientCount: notificationCount
    }, { merge: true });

    return null;
  }
);
