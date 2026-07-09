"use strict";

const { canApproveAction, policyForAction } = require("./policy");

const EXECUTION_LEASE_MS = 5 * 60 * 1000;

const ACTION_STATUSES = Object.freeze({
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  EXECUTING: "executing",
  COMPLETED: "completed",
  FAILED: "failed",
  ROLLED_BACK: "rolled_back"
});

const TERMINAL_STATUSES = Object.freeze([
  ACTION_STATUSES.REJECTED,
  ACTION_STATUSES.CANCELLED,
  ACTION_STATUSES.EXPIRED,
  ACTION_STATUSES.ROLLED_BACK
]);

const ACTION_DEFINITIONS = Object.freeze({
  draft_customer_message: Object.freeze({ artifactType: "customer_message_draft", executor: "artifact", reversible: true, maxAttempts: 3 }),
  propose_schedule_change: Object.freeze({ artifactType: "schedule_change_proposal", executor: "artifact", reversible: true, maxAttempts: 3 }),
  propose_assignment: Object.freeze({ artifactType: "assignment_proposal", executor: "artifact", reversible: true, maxAttempts: 3 }),
  propose_quote: Object.freeze({ artifactType: "quote_draft", executor: "artifact", reversible: true, maxAttempts: 3 }),
  issue_refund: Object.freeze({ artifactType: null, executor: null, reversible: false, maxAttempts: 0 }),
  modify_permissions: Object.freeze({ artifactType: null, executor: null, reversible: false, maxAttempts: 0 }),
  publish_changes: Object.freeze({ artifactType: null, executor: null, reversible: false, maxAttempts: 0 }),
  delete_record: Object.freeze({ artifactType: null, executor: null, reversible: false, maxAttempts: 0 })
});

const TRANSITIONS = Object.freeze({
  [ACTION_STATUSES.PENDING_APPROVAL]: Object.freeze([
    ACTION_STATUSES.APPROVED,
    ACTION_STATUSES.REJECTED,
    ACTION_STATUSES.CANCELLED,
    ACTION_STATUSES.EXPIRED
  ]),
  [ACTION_STATUSES.APPROVED]: Object.freeze([
    ACTION_STATUSES.EXECUTING,
    ACTION_STATUSES.CANCELLED,
    ACTION_STATUSES.EXPIRED
  ]),
  [ACTION_STATUSES.EXECUTING]: Object.freeze([
    ACTION_STATUSES.COMPLETED,
    ACTION_STATUSES.FAILED
  ]),
  [ACTION_STATUSES.FAILED]: Object.freeze([
    ACTION_STATUSES.EXECUTING,
    ACTION_STATUSES.CANCELLED
  ]),
  [ACTION_STATUSES.COMPLETED]: Object.freeze([
    ACTION_STATUSES.ROLLED_BACK
  ])
});

function normalizeActionType(value = "") {
  return String(value || "").trim().toLowerCase();
}

function actionDefinition(actionType = "") {
  const type = normalizeActionType(actionType);
  const definition = ACTION_DEFINITIONS[type];
  if (!definition) return null;
  const policy = policyForAction(type);
  return Object.freeze({ actionType: type, risk: policy.risk, executionPolicy: policy.execution, ...definition });
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpired(request = {}, nowMs = Date.now()) {
  const expiresAtMs = timestampMillis(request.expiresAt);
  return expiresAtMs > 0 && expiresAtMs <= Number(nowMs || Date.now());
}

function isExecutionLeaseStale(request = {}, nowMs = Date.now()) {
  if (request.status !== ACTION_STATUSES.EXECUTING) return false;
  const startedAtMs = timestampMillis(request.execution?.startedAt);
  if (!startedAtMs) return true;
  return Number(nowMs || Date.now()) - startedAtMs >= EXECUTION_LEASE_MS;
}

function canTransition(fromStatus = "", toStatus = "", actionType = "") {
  const from = String(fromStatus || "");
  const to = String(toStatus || "");
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) return false;
  if (from === ACTION_STATUSES.COMPLETED && to === ACTION_STATUSES.ROLLED_BACK) {
    return actionDefinition(actionType)?.reversible === true;
  }
  return true;
}

function canReview(role = "", actionType = "") {
  return canApproveAction(role, normalizeActionType(actionType));
}

function canExecute(role = "", request = {}, nowMs = Date.now()) {
  const definition = actionDefinition(request.actionType);
  if (!definition?.executor) return false;
  if (!canApproveAction(role, request.actionType)) return false;

  const status = String(request.status || "");
  const attempts = Number(request.execution?.attempts || 0);
  if (attempts >= definition.maxAttempts) return false;
  if (status === ACTION_STATUSES.APPROVED || status === ACTION_STATUSES.FAILED) return true;
  return status === ACTION_STATUSES.EXECUTING && isExecutionLeaseStale(request, nowMs);
}

function canRollback(role = "", request = {}) {
  const definition = actionDefinition(request.actionType);
  return Boolean(definition?.reversible && request.status === ACTION_STATUSES.COMPLETED && canApproveAction(role, request.actionType));
}

function canCancel(actor = {}, request = {}) {
  const status = String(request.status || "");
  if (![ACTION_STATUSES.PENDING_APPROVAL, ACTION_STATUSES.APPROVED, ACTION_STATUSES.FAILED].includes(status)) return false;
  if (["owner", "admin"].includes(String(actor.role || ""))) return true;
  return String(request.requestedBy || "") === String(actor.uid || "");
}

function publicActionSummary(request = {}) {
  const definition = actionDefinition(request.actionType);
  return {
    requestId: String(request.requestId || ""),
    runId: request.runId || null,
    actionType: String(request.actionType || ""),
    risk: request.risk || definition?.risk || "prohibited",
    executionPolicy: request.executionPolicy || definition?.executionPolicy || "disabled",
    status: String(request.status || ACTION_STATUSES.PENDING_APPROVAL),
    reason: String(request.reason || "").slice(0, 600),
    payload: request.payload && typeof request.payload === "object" ? request.payload : {},
    requestedBy: request.requestedBy || null,
    requestedByRole: request.requestedByRole || null,
    companyId: request.companyId || null,
    approvals: Array.isArray(request.approvals) ? request.approvals.slice(-10) : [],
    execution: request.execution && typeof request.execution === "object" ? request.execution : null,
    artifactId: request.artifactId || null,
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
    expiresAt: request.expiresAt || null,
    reversible: definition?.reversible === true,
    executable: Boolean(definition?.executor)
  };
}

module.exports = {
  ACTION_DEFINITIONS,
  ACTION_STATUSES,
  EXECUTION_LEASE_MS,
  TERMINAL_STATUSES,
  TRANSITIONS,
  actionDefinition,
  canCancel,
  canExecute,
  canReview,
  canRollback,
  canTransition,
  isExecutionLeaseStale,
  isExpired,
  normalizeActionType,
  publicActionSummary,
  timestampMillis
};
