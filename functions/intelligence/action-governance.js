"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { loadActorContext, intelligenceError } = require("./context");
const { redactText, scrub } = require("./audit");
const {
  ACTION_STATUSES,
  canCancel,
  canReview,
  canTransition,
  isExpired,
  publicActionSummary,
  timestampMillis
} = require("./action-registry");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const CALLABLE_OPTIONS = Object.freeze({
  region: "us-central1",
  enforceAppCheck: true,
  cors: true,
  timeoutSeconds: 30,
  memory: "256MiB",
  maxInstances: 20
});

const QUEUE_STATUSES = new Set(Object.values(ACTION_STATUSES));
const ERROR_CODES = new Set([
  "invalid-argument",
  "not-found",
  "permission-denied",
  "failed-precondition",
  "resource-exhausted",
  "unauthenticated",
  "internal"
]);

function text(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

function callableError(error) {
  if (error instanceof HttpsError) return error;
  const code = ERROR_CODES.has(error?.code) ? error.code : "internal";
  const message = code === "internal"
    ? "The AI action queue could not complete this request."
    : text(error?.message || "The AI action queue could not complete this request.", 500);
  return new HttpsError(code, message);
}

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to use the AI action queue.");
  return request.auth.uid;
}

function canViewRequest(actor, action = {}) {
  if (["owner", "admin"].includes(actor.role)) return true;
  return Boolean(actor.companyId && action.companyId && actor.companyId === action.companyId);
}

function serialize(value) {
  if (value == null) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.entries(value).reduce((result, [key, item]) => {
      result[key] = serialize(item);
      return result;
    }, {});
  }
  return value;
}

function queueItem(doc) {
  const data = { requestId: doc.id, ...(doc.data() || {}) };
  const summary = publicActionSummary(data);
  if (isExpired(data) && [ACTION_STATUSES.PENDING_APPROVAL, ACTION_STATUSES.APPROVED].includes(summary.status)) {
    summary.status = ACTION_STATUSES.EXPIRED;
  }
  return serialize(summary);
}

async function committedRequest(actionRef) {
  const snap = await actionRef.get();
  if (!snap.exists) throw intelligenceError("not-found", "AI action request not found.");
  return queueItem(snap);
}

function eventPayload({ eventRef, action, actor, eventType, note = null, metadata = {} }) {
  return {
    eventId: eventRef.id,
    requestId: action.requestId,
    actionType: action.actionType,
    eventType,
    actorUserId: actor.uid,
    actorRole: actor.role,
    companyId: action.companyId || null,
    note: note ? redactText(note, 600) : null,
    metadata: scrub(metadata),
    createdAt: FieldValue.serverTimestamp()
  };
}

exports.getAiActionQueue = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);

  try {
    const actor = await loadActorContext(db, uid);
    if (!["owner", "admin", "organization"].includes(actor.role)) {
      throw intelligenceError("permission-denied", "Your role cannot access the AI action queue.");
    }

    const requestedStatus = text(request.data?.status, 40) || ACTION_STATUSES.PENDING_APPROVAL;
    if (requestedStatus !== "all" && !QUEUE_STATUSES.has(requestedStatus)) {
      throw intelligenceError("invalid-argument", "Enter a valid queue status.");
    }

    const parsedLimit = Number(request.data?.limit || 40);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 50)) : 40;
    let query = db.collection("ai_action_requests");
    if (actor.role === "organization") {
      if (!actor.companyId) throw intelligenceError("failed-precondition", "Your account needs a company assignment.");
      query = query.where("companyId", "==", actor.companyId);
    }

    const snap = await query.limit(100).get();
    const actions = snap.docs
      .map(queueItem)
      .filter((item) => requestedStatus === "all" || item.status === requestedStatus)
      .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
      .slice(0, limit);

    return {
      actions,
      totalReturned: actions.length,
      status: requestedStatus,
      actorRole: actor.role,
      tenantScope: actor.companyId ? "company" : "platform"
    };
  } catch (error) {
    throw callableError(error);
  }
});

exports.reviewAiActionRequest = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const requestId = text(request.data?.requestId, 128);
  const decision = text(request.data?.decision, 20).toLowerCase();
  const note = text(request.data?.note, 600);

  if (!requestId) throw new HttpsError("invalid-argument", "An action request ID is required.");
  if (!["approve", "reject"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Decision must be approve or reject.");
  }

  try {
    const actor = await loadActorContext(db, uid);
    const actionRef = db.doc(`ai_action_requests/${requestId}`);
    const eventRef = db.collection("ai_action_events").doc();

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actionRef);
      if (!snap.exists) throw intelligenceError("not-found", "AI action request not found.");

      const action = { requestId: snap.id, ...(snap.data() || {}) };
      if (!canViewRequest(actor, action)) throw intelligenceError("permission-denied", "You cannot access this AI action request.");
      if (!canReview(actor.role, action.actionType)) throw intelligenceError("permission-denied", "Your role cannot review this action.");

      if (isExpired(action)) {
        if (canTransition(action.status, ACTION_STATUSES.EXPIRED, action.actionType)) {
          transaction.update(actionRef, {
            status: ACTION_STATUSES.EXPIRED,
            expiredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(eventRef, eventPayload({ eventRef, action, actor, eventType: "expired_during_review" }));
        }
        return;
      }

      const targetStatus = decision === "approve" ? ACTION_STATUSES.APPROVED : ACTION_STATUSES.REJECTED;
      if (action.status === targetStatus) return;
      if (!canTransition(action.status, targetStatus, action.actionType)) {
        throw intelligenceError("failed-precondition", `This action cannot move from ${action.status} to ${targetStatus}.`);
      }

      const review = {
        decision,
        actorUserId: actor.uid,
        actorRole: actor.role,
        note: note ? redactText(note, 600) : null,
        at: Timestamp.now()
      };
      const approvals = Array.isArray(action.approvals) ? action.approvals.slice(-19) : [];
      approvals.push(review);

      const patch = { status: targetStatus, approvals, updatedAt: FieldValue.serverTimestamp() };
      if (decision === "approve") {
        patch.approvedAt = FieldValue.serverTimestamp();
        patch.approvedBy = actor.uid;
        patch.approvedByRole = actor.role;
      } else {
        patch.rejectedAt = FieldValue.serverTimestamp();
        patch.rejectedBy = actor.uid;
        patch.rejectedByRole = actor.role;
      }

      transaction.update(actionRef, patch);
      transaction.create(eventRef, eventPayload({
        eventRef,
        action,
        actor,
        eventType: decision === "approve" ? "approved" : "rejected",
        note
      }));
    });

    return { request: await committedRequest(actionRef) };
  } catch (error) {
    throw callableError(error);
  }
});

exports.cancelAiActionRequest = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const requestId = text(request.data?.requestId, 128);
  const note = text(request.data?.note, 600);
  if (!requestId) throw new HttpsError("invalid-argument", "An action request ID is required.");

  try {
    const actor = await loadActorContext(db, uid);
    const actionRef = db.doc(`ai_action_requests/${requestId}`);
    const eventRef = db.collection("ai_action_events").doc();

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actionRef);
      if (!snap.exists) throw intelligenceError("not-found", "AI action request not found.");

      const action = { requestId: snap.id, ...(snap.data() || {}) };
      if (!canViewRequest(actor, action)) throw intelligenceError("permission-denied", "You cannot access this AI action request.");
      if (action.status === ACTION_STATUSES.CANCELLED) return;

      if (isExpired(action)) {
        if (canTransition(action.status, ACTION_STATUSES.EXPIRED, action.actionType)) {
          transaction.update(actionRef, {
            status: ACTION_STATUSES.EXPIRED,
            expiredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(eventRef, eventPayload({ eventRef, action, actor, eventType: "expired_during_cancel" }));
        }
        return;
      }

      if (!canCancel(actor, action)) throw intelligenceError("permission-denied", "You cannot cancel this AI action request.");
      if (!canTransition(action.status, ACTION_STATUSES.CANCELLED, action.actionType)) {
        throw intelligenceError("failed-precondition", `This action cannot be cancelled from ${action.status}.`);
      }

      transaction.update(actionRef, {
        status: ACTION_STATUSES.CANCELLED,
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: actor.uid,
        cancelledByRole: actor.role,
        cancellationNote: note ? redactText(note, 600) : null,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(eventRef, eventPayload({ eventRef, action, actor, eventType: "cancelled", note }));
    });

    return { request: await committedRequest(actionRef) };
  } catch (error) {
    throw callableError(error);
  }
});
