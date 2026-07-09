"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const { canProposeAction, policyForAction } = require("./policy");
const { intelligenceError } = require("./context");

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

function hashText(value = "") {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function redactText(value = "", max = 240) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[phone]")
    .replace(/\b\d{9,}\b/g, "[number]")
    .slice(0, max);
}

function scrub(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return redactText(value, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrub(item, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value).slice(0, 40).reduce((result, [key, item]) => {
      const safeKey = String(key || "").slice(0, 80);
      if (/secret|password|token|api.?key|authorization/i.test(safeKey)) result[safeKey] = "[redacted]";
      else result[safeKey] = scrub(item, depth + 1);
      return result;
    }, {});
  }
  return String(value).slice(0, 100);
}

function stableStringify(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

async function beginRun(db, { actor, prompt, context = {}, mode = "assistant" }) {
  const ref = db.collection("ai_runs").doc();
  await ref.create({
    runId: ref.id,
    status: "running",
    mode,
    actorUserId: actor.uid,
    actorRole: actor.role,
    actorRawRole: actor.rawRole,
    companyId: actor.companyId,
    promptHash: hashText(prompt),
    promptPreview: redactText(prompt),
    context: scrub({ pathname: context.pathname || null }),
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref;
}

async function completeRun(runRef, result = {}) {
  if (!runRef) return;
  await runRef.set({
    status: "completed",
    result: scrub({
      mode: result.mode,
      model: result.model,
      responseId: result.responseId,
      actionTypes: result.actionTypes || [],
      actionRequestIds: result.actionRequestIds || [],
      usage: result.usage || null
    }),
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function failRun(runRef, error) {
  if (!runRef) return;
  await runRef.set({
    status: "failed",
    error: {
      code: String(error?.code || "internal").slice(0, 80),
      message: redactText(error?.message || "Unknown intelligence error", 400)
    },
    failedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function createActionRequest(db, { actor, runId, actionType, reason, payload }) {
  const type = String(actionType || "").trim();
  const policy = policyForAction(type);

  if (!canProposeAction(actor.role, type) || policy.execution === "disabled") {
    throw intelligenceError("permission-denied", "This AI action is not permitted for your role.");
  }

  if (policy.execution === "automatic") {
    throw intelligenceError("invalid-argument", "Automatic and read-only tools do not create approval requests.");
  }

  const safeReason = redactText(reason, 600);
  const safePayload = scrub(payload || {});
  const requestId = hashText(stableStringify({
    runId: runId || null,
    actionType: type,
    reason: safeReason,
    payload: safePayload
  })).slice(0, 40);
  const ref = db.collection("ai_action_requests").doc(requestId);
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return;

    transaction.create(ref, {
      requestId,
      runId: runId || null,
      actionType: type,
      risk: policy.risk,
      executionPolicy: policy.execution,
      status: "pending_approval",
      reason: safeReason,
      payload: safePayload,
      requestedBy: actor.uid,
      requestedByRole: actor.role,
      companyId: actor.companyId,
      approvals: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt
    });
  });

  return {
    requestId,
    actionType: type,
    risk: policy.risk,
    status: "pending_approval",
    executionPolicy: policy.execution,
    expiresAt: expiresAt.toDate().toISOString()
  };
}

module.exports = {
  beginRun,
  completeRun,
  createActionRequest,
  failRun,
  hashText,
  redactText,
  scrub,
  stableStringify
};
