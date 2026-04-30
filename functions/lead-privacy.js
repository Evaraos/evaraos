const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function hasEmail(value = "") {
  return typeof value === "string" && value.includes("@");
}

function cleanName(user = {}, fallback = "Staff") {
  return user.displayName || user.fullName || user.name || user.username || fallback;
}

async function findUserByEmail(email = "") {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const snap = await db.collection("users").where("email", "==", normalized).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  const snapCase = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!snapCase.empty) {
    const doc = snapCase.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  return null;
}

async function sanitizeLeadIdentity(docId, data = {}) {
  const createdByValue = String(data.createdBy || "").trim();
  const createdByEmailValue = String(data.createdByEmail || "").trim();
  const emailToResolve = hasEmail(createdByValue) ? createdByValue : createdByEmailValue;

  if (!hasEmail(createdByValue) && !createdByEmailValue) return null;

  const matchedUser = await findUserByEmail(emailToResolve);
  const safeUid = data.createdByUid || matchedUser?.uid || matchedUser?.id || data.createdById || "legacy_user";
  const safeName = data.createdByName || cleanName(matchedUser || {}, "Staff");
  const safeRole = data.createdByRole || matchedUser?.role || "staff";

  const patch = {
    createdBy: safeUid,
    createdByUid: safeUid,
    createdByName: safeName,
    createdByRole: safeRole,
    createdByEmail: FieldValue.delete(),
    updatedByEmail: FieldValue.delete(),
    ownerEmail: FieldValue.delete(),
    privacySanitized: true,
    privacySanitizedAt: FieldValue.serverTimestamp()
  };

  await db.doc(`leads/${docId}`).set(patch, { merge: true });
  return patch;
}

exports.sanitizeLeadIdentity = onDocumentWritten("leads/{leadId}", async (event) => {
  if (!event.data?.after?.exists) return null;
  const data = event.data.after.data() || {};
  return sanitizeLeadIdentity(event.params.leadId, data);
});

exports.sanitizeLeadIdentityNow = sanitizeLeadIdentity;
