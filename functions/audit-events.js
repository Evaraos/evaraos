const admin = require("firebase-admin");
const { onDocumentWrittenWithAuthContext } = require("firebase-functions/v2/firestore");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const AUDITED_COLLECTIONS = new Set([
  "users",
  "companies",
  "staff_applications",
  "staff_profiles",
  "leads",
  "jobs",
  "quotes",
  "subscriptions",
  "invoices",
  "transactions",
  "payouts",
  "marketplace_payouts",
  "dispatch_assignments",
  "customer_services",
  "customer_message_threads",
  "payroll_runs"
]);

const OMITTED_FIELDS = new Set([
  "password",
  "token",
  "secret",
  "apiKey",
  "privateKey",
  "attachments",
  "beforePhotos",
  "afterPhotos",
  "photos"
]);

function cleanText(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

function eventDocumentId(eventId = "") {
  return cleanText(eventId, 500).replace(/[^a-zA-Z0-9_-]+/g, "_") || db.collection("audit_logs").doc().id;
}

function operation(beforeExists, afterExists) {
  if (!beforeExists && afterExists) return "created";
  if (beforeExists && !afterExists) return "deleted";
  return "updated";
}

function changedFields(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys]
    .filter((key) => !OMITTED_FIELDS.has(key) && JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .slice(0, 100);
}

function safeSummary(data = {}) {
  const output = {};
  const allowed = [
    "id",
    "uid",
    "status",
    "approvalStatus",
    "role",
    "companyId",
    "companyName",
    "customerId",
    "customerUid",
    "userId",
    "assignedToUid",
    "staffClaimedBy",
    "title",
    "name",
    "fullName",
    "displayName",
    "type",
    "priority"
  ];

  allowed.forEach((key) => {
    const value = data?.[key];
    if (["string", "number", "boolean"].includes(typeof value)) {
      output[key] = typeof value === "string" ? cleanText(value, 500) : value;
    }
  });

  return output;
}

function companyIdOf(before = {}, after = {}) {
  return cleanText(
    after.companyId
      || before.companyId
      || after.targetCompanyId
      || before.targetCompanyId,
    120
  );
}

async function actorOf(event) {
  const uid = cleanText(event.authId, 160);
  if (!uid) {
    return {
      uid: "system",
      name: "EvaraOS System",
      role: "system",
      authType: cleanText(event.authType || "system", 80)
    };
  }

  try {
    const snapshot = await db.doc(`users/${uid}`).get();
    const user = snapshot.exists ? snapshot.data() || {} : {};
    return {
      uid,
      name: cleanText(user.displayName || user.fullName || user.name || user.username || uid, 180),
      role: cleanText(user.role || "authenticated", 120),
      companyId: cleanText(user.companyId, 120),
      authType: cleanText(event.authType || "user", 80)
    };
  } catch (error) {
    console.warn("Audit actor lookup failed", { uid, error: error?.message });
    return { uid, name: uid, role: "authenticated", authType: cleanText(event.authType || "user", 80) };
  }
}

exports.writeSecurityAudit = onDocumentWrittenWithAuthContext(
  {
    document: "{collectionId}/{documentId}",
    region: "us-central1",
    retry: true,
    memory: "256MiB"
  },
  async (event) => {
    const collectionId = event.params.collectionId;
    if (!AUDITED_COLLECTIONS.has(collectionId)) return null;

    const beforeExists = Boolean(event.data?.before?.exists);
    const afterExists = Boolean(event.data?.after?.exists);
    if (!beforeExists && !afterExists) return null;

    const before = beforeExists ? event.data.before.data() || {} : {};
    const after = afterExists ? event.data.after.data() || {} : {};
    const action = `${collectionId}_${operation(beforeExists, afterExists)}`;
    const actor = await actorOf(event);
    const companyId = companyIdOf(before, after) || actor.companyId || "";
    const id = eventDocumentId(event.id);
    const fields = changedFields(before, after);
    const targetName = cleanText(
      after.displayName
        || after.fullName
        || after.name
        || after.title
        || before.displayName
        || before.fullName
        || before.name
        || before.title
        || event.params.documentId,
      240
    );

    const payload = {
      eventId: cleanText(event.id, 500),
      action,
      operation: operation(beforeExists, afterExists),
      source: "firestore_auth_context_trigger",
      actorUserId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      actorAuthType: actor.authType,
      companyId,
      targetCollection: collectionId,
      targetDocumentId: event.params.documentId,
      targetName,
      changedFields: fields,
      before: safeSummary(before),
      after: safeSummary(after),
      createdAt: FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.set(db.doc(`audit_logs/${id}`), payload, { merge: true });
    batch.set(db.doc(`history_timeline/${id}`), {
      ...payload,
      entityType: collectionId,
      documentId: event.params.documentId,
      notes: `${action} recorded by trusted backend audit`
    }, { merge: true });
    await batch.commit();
    return null;
  }
);
