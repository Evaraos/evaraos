const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { normalizeAuthorityRole } = require("./staff-authority");
const TASK_KEYS = Object.freeze([
  "reviewPolicies", "completeTaxDocs", "completeTraining", "receiveAssignment", "activatePayouts"
]);

// These are staff acknowledgements, never proof of verification or payment activation.
exports.updateStaffOnboardingTask = onCall(
  { region: "us-central1", enforceAppCheck: true, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to update onboarding.");
    const data = request.data;
    if (!data || typeof data !== "object" || Array.isArray(data)
      || Object.keys(data).length !== 2
      || !Object.hasOwn(data, "taskKey") || !Object.hasOwn(data, "completed")
      || !TASK_KEYS.includes(data.taskKey) || typeof data.completed !== "boolean") {
      throw new HttpsError("invalid-argument", "Provide an allowed taskKey and boolean completed only.");
    }
    const db = admin.firestore();
    const ref = db.doc(`staff_profiles/${uid}`);
    return db.runTransaction(async (tx) => {
      const userSnap = await tx.get(db.doc(`users/${uid}`));
      const profileSnap = await tx.get(ref);
      if (!profileSnap.exists) throw new HttpsError("not-found", "Staff profile not found.");
      const user = userSnap.data() || {};
      const profile = profileSnap.data();
      if (!userSnap.exists || ![user, profile].every(p =>
        ["active", "approved"].includes(p.status) && p.approvalStatus === "approved")
        || profile.uid !== uid || profile.userId !== uid
        || !user.companyId || user.companyId !== profile.companyId
        || normalizeAuthorityRole(user.role) !== normalizeAuthorityRole(profile.role)) {
        throw new HttpsError("permission-denied", "An active approved staff assignment is required.");
      }
      const tasks = Object.fromEntries(TASK_KEYS.map(key => [key, profile.onboardingTasks?.[key] === true]));
      tasks[data.taskKey] = data.completed;
      // Checklist state only. Never changes account status, assignment, claims or payouts.
      const onboardingStage = TASK_KEYS.every(key => tasks[key]) ? "fully_active" : "in_progress";
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      tx.update(ref, { onboardingTasks: tasks, onboardingStage, updatedAt: timestamp });
      tx.set(db.collection("audit_logs").doc(), {
        action: "staff_onboarding_task_updated", actorUserId: uid,
        actorRole: normalizeAuthorityRole(user.role), companyId: user.companyId,
        targetCollection: "staff_profiles", targetDocumentId: uid,
        taskKey: data.taskKey, completed: data.completed,
        source: "updateStaffOnboardingTask", createdAt: timestamp
      });
      return { ok: true, onboardingTasks: tasks, onboardingStage };
    });
  }
);
