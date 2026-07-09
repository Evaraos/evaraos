const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const ROLE_CHANNELS = Object.freeze({
  operations: {
    name: "Operations",
    description: "Dispatch, scheduling, and daily operations.",
    roles: ["owner", "super_admin", "admin", "manager", "operations_manager", "operations_coordinator", "sales_rep", "technician", "cleaner", "staff", "field_staff", "crew_lead"]
  },
  "field-crews": {
    name: "Field Crews",
    description: "Technicians, cleaners, and field teams.",
    roles: ["owner", "super_admin", "admin", "manager", "operations_manager", "operations_coordinator", "technician", "cleaner", "staff", "field_staff", "crew_lead"]
  },
  "hr-support": {
    name: "HR + Support",
    description: "Hiring, onboarding, payroll, and support.",
    roles: ["owner", "super_admin", "admin", "hr", "hr_manager", "customer_support"]
  },
  leadership: {
    name: "Leadership",
    description: "Executive and management communication.",
    roles: ["owner", "super_admin", "admin", "manager", "operations_manager"]
  }
});

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function clean(value = "", max = 320) {
  return String(value || "").trim().slice(0, max);
}

function safeSegment(value = "") {
  return clean(value, 160).replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function channelId(companyId, key) {
  return `${safeSegment(companyId)}__${safeSegment(key)}`;
}

function activeApproved(user = {}) {
  return ["active", "approved"].includes(normalize(user.status))
    && normalize(user.approvalStatus) === "approved";
}

function platformAdmin(user = {}) {
  const role = normalize(user.role);
  return role === "owner"
    || role === "super_admin"
    || (role === "admin" && user.platformAccess === true);
}

async function authenticatedUser(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to use messaging.");
  }

  const snapshot = await db.doc(`users/${request.auth.uid}`).get();
  if (!snapshot.exists) {
    throw new HttpsError("permission-denied", "Messaging profile not found.");
  }

  const user = { id: snapshot.id, ...(snapshot.data() || {}) };
  if (!activeApproved(user)) {
    throw new HttpsError("permission-denied", "This account is not active for messaging.");
  }
  return user;
}

async function ensureChannels(companyId, actorUid) {
  const companySnapshot = await db.doc(`companies/${companyId}`).get();
  if (!companySnapshot.exists) {
    throw new HttpsError("failed-precondition", "Company not found.");
  }

  const company = companySnapshot.data() || {};
  const companyName = clean(company.name || company.companyName || companyId, 180);
  const batch = db.batch();
  const ids = [];

  Object.entries(ROLE_CHANNELS).forEach(([key, definition]) => {
    const id = channelId(companyId, key);
    ids.push(id);
    batch.set(db.doc(`channels/_group_registry/messages/${id}`), {
      kind: "role_meta",
      groupId: id,
      channelKey: key,
      name: definition.name,
      description: definition.description,
      companyId,
      companyName,
      allowedRoles: definition.roles,
      memberUids: [],
      adminUids: [],
      createdBy: "system",
      bootstrappedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
  return ids;
}

exports.bootstrapMessageChannels = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 20,
    memory: "256MiB"
  },
  async (request) => {
    const user = await authenticatedUser(request);
    const companyId = clean(user.companyId, 120);
    if (!companyId) {
      throw new HttpsError("failed-precondition", "A company assignment is required for team messaging.");
    }

    const ids = await ensureChannels(companyId, request.auth.uid);
    return { ok: true, companyId, channelIds: ids };
  }
);

exports.resolveMessageRecipient = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 15,
    memory: "256MiB"
  },
  async (request) => {
    const user = await authenticatedUser(request);
    const email = clean(request.data?.email, 320).toLowerCase();
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "Enter a valid account email.");
    }

    const companyId = clean(user.companyId, 120);
    if (!companyId && !platformAdmin(user)) {
      throw new HttpsError("failed-precondition", "A company assignment is required.");
    }

    let query = db.collection("users").where("email", "==", email);
    if (!platformAdmin(user)) query = query.where("companyId", "==", companyId);
    const snapshot = await query.limit(2).get();
    const match = snapshot.docs.find((document) => activeApproved(document.data() || {}));

    if (!match) {
      throw new HttpsError("not-found", "No eligible EvaraOS account was found.");
    }

    const data = match.data() || {};
    return {
      uid: match.id,
      email: clean(data.email, 320),
      displayName: clean(data.displayName || data.fullName || data.name || data.username || data.email, 180),
      role: normalize(data.role),
      companyId: clean(data.companyId, 120)
    };
  }
);

exports.migrateMessageRegistry = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (request) => {
    const user = await authenticatedUser(request);
    if (!platformAdmin(user)) {
      throw new HttpsError("permission-denied", "Platform administration is required.");
    }

    const deleteLegacy = request.data?.deleteLegacy === true;
    const snapshot = await db.collection("channels/_group_registry/messages").limit(1000).get();
    const writer = db.bulkWriter();
    let migrated = 0;
    let skipped = 0;

    snapshot.forEach((document) => {
      const data = document.data() || {};
      const targetId = safeSegment(data.groupId);
      if (!targetId || targetId === document.id) {
        skipped += 1;
        return;
      }

      writer.set(db.doc(`channels/_group_registry/messages/${targetId}`), {
        ...data,
        groupId: targetId,
        migratedFrom: document.id,
        migratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      if (deleteLegacy) writer.delete(document.ref);
      migrated += 1;
    });

    await writer.close();
    return { ok: true, migrated, skipped, deleteLegacy };
  }
);
