const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function tokenDocId(token = "") {
  return Buffer.from(String(token)).toString("base64url").slice(0, 900);
}

function clean(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

async function assertActiveAccount(uid) {
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "User profile not found.");

  const user = snapshot.data() || {};
  const status = clean(user.status, 80).toLowerCase();
  const approvalStatus = clean(user.approvalStatus, 80).toLowerCase();
  if (!["active", "approved"].includes(status) || approvalStatus !== "approved") {
    throw new HttpsError("permission-denied", "This account is not active for notifications.");
  }
  return user;
}

exports.registerPushToken = onCall(
  { region: "us-central1", cors: true, enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in before enabling notifications.");
    await assertActiveAccount(request.auth.uid);

    const token = clean(request.data?.token, 4096);
    if (!token || token.length < 40 || token.length > 4096) {
      throw new HttpsError("invalid-argument", "A valid push token is required.");
    }

    const uid = request.auth.uid;
    const ref = db.doc(`users/${uid}/pushTokens/${tokenDocId(token)}`);
    await ref.set({
      token,
      uid,
      platform: clean(request.data?.platform || "web", 80),
      userAgent: clean(request.data?.userAgent, 500),
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { ok: true };
  }
);

exports.unregisterPushToken = onCall(
  { region: "us-central1", cors: true, enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in before changing notifications.");

    const token = clean(request.data?.token, 4096);
    if (!token) return { ok: true };

    await db.doc(`users/${request.auth.uid}/pushTokens/${tokenDocId(token)}`).delete().catch(() => {});
    return { ok: true };
  }
);
