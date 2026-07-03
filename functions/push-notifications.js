const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function tokenDocId(token = "") {
  return Buffer.from(String(token)).toString("base64url").slice(0, 900);
}

exports.registerPushToken = onCall({ region: "us-central1", cors: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in before enabling notifications.");

  const token = String(request.data?.token || "").trim();
  if (!token || token.length < 40) throw new HttpsError("invalid-argument", "A valid push token is required.");

  const uid = request.auth.uid;
  const ref = db.doc(`users/${uid}/pushTokens/${tokenDocId(token)}`);
  await ref.set({
    token,
    uid,
    platform: String(request.data?.platform || "web"),
    userAgent: String(request.data?.userAgent || "").slice(0, 500),
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});

exports.unregisterPushToken = onCall({ region: "us-central1", cors: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in before changing notifications.");

  const token = String(request.data?.token || "").trim();
  if (!token) return { ok: true };

  await db.doc(`users/${request.auth.uid}/pushTokens/${tokenDocId(token)}`).delete().catch(() => {});
  return { ok: true };
});
