"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTION_STATUSES,
  EXECUTION_LEASE_MS,
  actionDefinition,
  canCancel,
  canExecute,
  canReview,
  canRollback,
  canTransition,
  isExecutionLeaseStale,
  isExpired
} = require("./action-registry");

test("registers reversible low-risk artifact executors only", () => {
  const draft = actionDefinition("draft_customer_message");
  const refund = actionDefinition("issue_refund");

  assert.equal(draft.executor, "artifact");
  assert.equal(draft.reversible, true);
  assert.equal(draft.risk, "low");
  assert.equal(refund.executor, null);
  assert.equal(refund.reversible, false);
  assert.equal(refund.risk, "high");
});

test("allows only explicit lifecycle transitions", () => {
  assert.equal(canTransition(ACTION_STATUSES.PENDING_APPROVAL, ACTION_STATUSES.APPROVED, "propose_quote"), true);
  assert.equal(canTransition(ACTION_STATUSES.APPROVED, ACTION_STATUSES.EXECUTING, "propose_quote"), true);
  assert.equal(canTransition(ACTION_STATUSES.EXECUTING, ACTION_STATUSES.COMPLETED, "propose_quote"), true);
  assert.equal(canTransition(ACTION_STATUSES.COMPLETED, ACTION_STATUSES.ROLLED_BACK, "propose_quote"), true);
  assert.equal(canTransition(ACTION_STATUSES.COMPLETED, ACTION_STATUSES.ROLLED_BACK, "issue_refund"), false);
  assert.equal(canTransition(ACTION_STATUSES.REJECTED, ACTION_STATUSES.EXECUTING, "propose_quote"), false);
});

test("enforces reviewer and executor role boundaries", () => {
  const approvedDraft = {
    actionType: "draft_customer_message",
    status: ACTION_STATUSES.APPROVED,
    execution: { attempts: 0 }
  };
  const approvedRefund = {
    actionType: "issue_refund",
    status: ACTION_STATUSES.APPROVED,
    execution: { attempts: 0 }
  };

  assert.equal(canReview("owner", "issue_refund"), true);
  assert.equal(canReview("admin", "issue_refund"), false);
  assert.equal(canReview("admin", "propose_quote"), true);
  assert.equal(canReview("organization", "propose_quote"), false);
  assert.equal(canExecute("admin", approvedDraft), true);
  assert.equal(canExecute("owner", approvedRefund), false);
});

test("limits retries and supports reversible completion", () => {
  const retryable = {
    actionType: "propose_assignment",
    status: ACTION_STATUSES.FAILED,
    execution: { attempts: 2 }
  };
  const exhausted = {
    ...retryable,
    execution: { attempts: 3 }
  };
  const completed = {
    actionType: "propose_assignment",
    status: ACTION_STATUSES.COMPLETED
  };

  assert.equal(canExecute("admin", retryable), true);
  assert.equal(canExecute("admin", exhausted), false);
  assert.equal(canRollback("admin", completed), true);
  assert.equal(canRollback("organization", completed), false);
});

test("recovers only stale execution leases", () => {
  const now = 1_000_000;
  const active = {
    actionType: "propose_quote",
    status: ACTION_STATUSES.EXECUTING,
    execution: { attempts: 1, startedAt: { toMillis: () => now - EXECUTION_LEASE_MS + 1 } }
  };
  const stale = {
    ...active,
    execution: { attempts: 1, startedAt: { toMillis: () => now - EXECUTION_LEASE_MS } }
  };

  assert.equal(isExecutionLeaseStale(active, now), false);
  assert.equal(isExecutionLeaseStale(stale, now), true);
  assert.equal(canExecute("admin", active, now), false);
  assert.equal(canExecute("admin", stale, now), true);
});

test("allows requester cancellation without allowing execution", () => {
  const actor = { uid: "user-1", role: "organization" };
  const ownPending = {
    actionType: "propose_schedule_change",
    status: ACTION_STATUSES.PENDING_APPROVAL,
    requestedBy: "user-1"
  };
  const otherPending = { ...ownPending, requestedBy: "user-2" };

  assert.equal(canCancel(actor, ownPending), true);
  assert.equal(canCancel(actor, otherPending), false);
  assert.equal(canExecute(actor.role, { ...ownPending, status: ACTION_STATUSES.APPROVED }), false);
});

test("detects expiration from Firestore-like timestamps", () => {
  const past = { expiresAt: { toMillis: () => 1000 } };
  const future = { expiresAt: { toMillis: () => 3000 } };

  assert.equal(isExpired(past, 2000), true);
  assert.equal(isExpired(future, 2000), false);
});
