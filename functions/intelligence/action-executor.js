"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { loadActorContext, intelligenceError } = require("./context");
const { hashText, redactText, scrub } = require("./audit");
const {
  ACTION_STATUSES,
  actionDefinition,
  canExecute,
  canRollback,
  canTransition,
  isExecutionLeaseStale,
  isExpired,
  publicActionSummary
} = require("./action-registry");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const CALLABLE_OPTIONS = Object.freeze({
  region: "us-central1",
  enforceAppCheck: true,
  cors: true,
  timeoutSeconds: 45,
  memory: "256MiB",
  maxInstances: 20
});

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

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to execute an AI action.");
  return request.auth.uid;
}

function callableError(error) {
  if (error instanceof HttpsError) return error;
  const code = ERROR_CODES.has(error?.code) ? error.code : "internal";
  const message = code === "internal"
    ? "The AI action executor could not complete this request."
    : text(error?.message || "The AI action executor could not complete this request.", 500);
  return new HttpsError(code, message);
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

function eventPayload({ eventRef, action, actor, eventType, metadata = {} }) {
  return {
    eventId: eventRef.id,
    requestId: action.requestId,
    actionType: action.actionType,
    eventType,
    actorUserId: actor.uid,
    actorRole: actor.role,
    companyId: action.companyId || null,
    metadata: scrub(metadata),
    createdAt: FieldValue.serverTimestamp()
  };
}

function artifactPayload(action, actor, definition) {
  const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
  return {
    artifactId: action.requestId,
    requestId: action.requestId,
    runId: action.runId || null,
    actionType: action.actionType,
    artifactType: definition.artifactType,
    status: "active",
    companyId: action.companyId || null,
    subject: payload.subject ? redactText(payload.subject, 500) : null,
    content: payload.details ? redactText(payload.details, 5000) : null,
    payload: scrub(payload),
    requestedBy: action.requestedBy || null,
    approvedBy: action.approvedBy || null,
    executedBy: actor.uid,
    executedByRole: actor.role,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function createArtifact(action, actor, definition) {
  const artifactRef = db.doc(`ai_action_artifacts/${action.requestId}`);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(artifactRef);
    if (existing.exists) {
      const data = existing.data() || {};
      if (data.requestId !== action.requestId || data.actionType !== action.actionType) {
        throw intelligenceError("failed-precondition", "The execution artifact does not match this request.");
      }
      return;
    }
    transaction.create(artifactRef, artifactPayload(action, actor, definition));
  });
  return artifactRef.id;
}

async function markExecutionFailed(actionRef, eventRef, actor, executionId, error) {
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(actionRef);
    if (!snap.exists) return;
    const action = { requestId: snap.id, ...(snap.data() || {}) };
    if (action.status !== ACTION_STATUSES.EXECUTING || action.execution?.executionId !== executionId) return;

    const lastError = {
      code: text(error?.code || "internal", 80),
      message: redactText(error?.message || "Execution failed.", 600)
    };
    transaction.update(actionRef, {
      status: ACTION_STATUSES.FAILED,
      "execution.lastError": lastError,
      "execution.failedAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.create(eventRef, eventPayload({
      eventRef,
      action,
      actor,
      eventType: "execution_failed",
      metadata: lastError
    }));
  });
}

exports.executeAiActionRequest = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const requestId = text(request.data?.requestId, 128);
  if (!requestId) throw new HttpsError("invalid-argument", "An action request ID is required.");

  const actionRef = db.doc(`ai_action_requests/${requestId}`);
  const claimEventRef = db.collection("ai_action_events").doc();
  const completedEventRef = db.collection("ai_action_events").doc();
  const failedEventRef = db.collection("ai_action_events").doc();

  try {
    const actor = await loadActorContext(db, uid);
    const claim = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(actionRef);
      if (!snap.exists) throw intelligenceError("not-found", "AI action request not found.");

      const action = { requestId: snap.id, ...(snap.data() || {}) };
      if (action.status === ACTION_STATUSES.COMPLETED) return { action, alreadyCompleted: true };
      if (action.status === ACTION_STATUSES.ROLLED_BACK) {
        throw intelligenceError("failed-precondition", "A rolled-back action cannot be executed again.");
      }

      if (isExpired(action)) {
        if (canTransition(action.status, ACTION_STATUSES.EXPIRED, action.actionType)) {
          transaction.update(actionRef, {
            status: ACTION_STATUSES.EXPIRED,
            expiredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(claimEventRef, eventPayload({
            eventRef: claimEventRef,
            action,
            actor,
            eventType: "expired_before_execution"
          }));
        }
        return { action: { ...action, status: ACTION_STATUSES.EXPIRED }, expired: true };
      }

      const definition = actionDefinition(action.actionType);
      if (!definition) throw intelligenceError("failed-precondition", "This action type is not registered.");
      if (!definition.executor) {
        throw intelligenceError("failed-precondition", "This action has no enabled executor. It remains approval-only.");
      }

      const reclaiming = action.status === ACTION_STATUSES.EXECUTING && isExecutionLeaseStale(action);
      if (action.status === ACTION_STATUSES.EXECUTING && !reclaiming) {
        throw intelligenceError("failed-precondition", "This action already has an active execution lease.");
      }
      if (!canExecute(actor.role, action)) {
        throw intelligenceError("permission-denied", "Your role cannot execute this AI action.");
      }
      if (!reclaiming && !canTransition(action.status, ACTION_STATUSES.EXECUTING, action.actionType)) {
        throw intelligenceError("failed-precondition", `This action cannot execute from ${action.status}.`);
      }

      const attempts = Number(action.execution?.attempts || 0) + 1;
      if (attempts > definition.maxAttempts) {
        throw intelligenceError("resource-exhausted", "This action reached its execution attempt limit.");
      }

      const idempotencyKey = hashText(`${requestId}:${action.actionType}`).slice(0, 40);
      const executionId = hashText(`${idempotencyKey}:${attempts}`).slice(0, 40);
      const execution = {
        executionId,
        idempotencyKey,
        executor: definition.executor,
        attempts,
        startedBy: actor.uid,
        startedByRole: actor.role,
        startedAt: admin.firestore.Timestamp.now(),
        lastError: null
      };

      transaction.update(actionRef, {
        status: ACTION_STATUSES.EXECUTING,
        execution,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(claimEventRef, eventPayload({
        eventRef: claimEventRef,
        action,
        actor,
        eventType: reclaiming ? "execution_reclaimed" : attempts === 1 ? "execution_started" : "execution_retried",
        metadata: { executionId, idempotencyKey, attempts, executor: definition.executor }
      }));

      return { action: { ...action, status: ACTION_STATUSES.EXECUTING, execution }, definition, executionId };
    });

    if (claim.alreadyCompleted || claim.expired) {
      return { request: serialize(publicActionSummary(claim.action)), idempotent: claim.alreadyCompleted === true };
    }

    try {
      const artifactId = await createArtifact(claim.action, actor, claim.definition);

      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(actionRef);
        if (!snap.exists) throw intelligenceError("not-found", "AI action request not found during completion.");
        const action = { requestId: snap.id, ...(snap.data() || {}) };

        if (action.status === ACTION_STATUSES.COMPLETED) return;
        if (action.status !== ACTION_STATUSES.EXECUTING || action.execution?.executionId !== claim.executionId) {
          throw intelligenceError("failed-precondition", "The execution lease is no longer active.");
        }
        if (!canTransition(action.status, ACTION_STATUSES.COMPLETED, action.actionType)) {
          throw intelligenceError("failed-precondition", "The action cannot be completed from its current state.");
        }

        transaction.update(actionRef, {
          status: ACTION_STATUSES.COMPLETED,
          artifactId,
          "execution.completedAt": FieldValue.serverTimestamp(),
          "execution.result": {
            artifactId,
            artifactType: claim.definition.artifactType
          },
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(completedEventRef, eventPayload({
          eventRef: completedEventRef,
          action,
          actor,
          eventType: "execution_completed",
          metadata: { artifactId, artifactType: claim.definition.artifactType }
        }));
      });

      const completed = await actionRef.get();
      return {
        request: serialize(publicActionSummary({ requestId: completed.id, ...(completed.data() || {}) })),
        artifactId,
        idempotent: false
      };
    } catch (error) {
      await markExecutionFailed(actionRef, failedEventRef, actor, claim.executionId, error);
      throw error;
    }
  } catch (error) {
    throw callableError(error);
  }
});

exports.rollbackAiActionRequest = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const requestId = text(request.data?.requestId, 128);
  const note = text(request.data?.note, 600);
  if (!requestId) throw new HttpsError("invalid-argument", "An action request ID is required.");

  try {
    const actor = await loadActorContext(db, uid);
    const actionRef = db.doc(`ai_action_requests/${requestId}`);
    const artifactRef = db.doc(`ai_action_artifacts/${requestId}`);
    const eventRef = db.collection("ai_action_events").doc();

    await db.runTransaction(async (transaction) => {
      const [actionSnap, artifactSnap] = await Promise.all([
        transaction.get(actionRef),
        transaction.get(artifactRef)
      ]);
      if (!actionSnap.exists) throw intelligenceError("not-found", "AI action request not found.");

      const action = { requestId: actionSnap.id, ...(actionSnap.data() || {}) };
      if (action.status === ACTION_STATUSES.ROLLED_BACK) return;
      if (!canRollback(actor.role, action)) {
        throw intelligenceError("permission-denied", "This action cannot be rolled back by your role.");
      }
      if (!artifactSnap.exists) throw intelligenceError("failed-precondition", "The reversible action artifact is missing.");
      if (!canTransition(action.status, ACTION_STATUSES.ROLLED_BACK, action.actionType)) {
        throw intelligenceError("failed-precondition", "This action cannot be rolled back from its current state.");
      }

      transaction.update(artifactRef, {
        status: "voided",
        voidedAt: FieldValue.serverTimestamp(),
        voidedBy: actor.uid,
        voidedByRole: actor.role,
        voidReason: note ? redactText(note, 600) : null,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.update(actionRef, {
        status: ACTION_STATUSES.ROLLED_BACK,
        rolledBackAt: FieldValue.serverTimestamp(),
        rolledBackBy: actor.uid,
        rolledBackByRole: actor.role,
        rollbackNote: note ? redactText(note, 600) : null,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(eventRef, eventPayload({
        eventRef,
        action,
        actor,
        eventType: "rolled_back",
        metadata: { artifactId: artifactRef.id, note: note || null }
      }));
    });

    const rolledBack = await actionRef.get();
    return { request: serialize(publicActionSummary({ requestId: rolledBack.id, ...(rolledBack.data() || {}) })) };
  } catch (error) {
    throw callableError(error);
  }
});
