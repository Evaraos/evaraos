"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canApproveAction,
  canProposeAction,
  hasCapability,
  normalizeRole,
  policyForAction
} = require("./policy");

test("normalizes operational roles without widening access", () => {
  assert.equal(normalizeRole("Super Admin"), "owner");
  assert.equal(normalizeRole("operations-manager"), "admin");
  assert.equal(normalizeRole("Organization Owner"), "organization");
  assert.equal(normalizeRole("Sales Rep"), "sales");
  assert.equal(normalizeRole("unknown-role"), "customer");
});

test("matches the current frontend AI feature boundary", () => {
  assert.equal(hasCapability("owner", "ai.chat"), true);
  assert.equal(hasCapability("admin", "ai.chat"), true);
  assert.equal(hasCapability("organization", "ai.chat"), true);
  assert.equal(hasCapability("vendor", "ai.chat"), false);
  assert.equal(hasCapability("sales_rep", "ai.chat"), false);
  assert.equal(hasCapability("customer", "ai.chat"), false);
});

test("requires approval for every business-changing action", () => {
  assert.equal(policyForAction("navigate_app").execution, "automatic");
  assert.equal(policyForAction("get_operations_snapshot").execution, "automatic");
  assert.equal(policyForAction("propose_assignment").execution, "approval_required");
  assert.equal(policyForAction("issue_refund").execution, "owner_approval_required");
  assert.equal(policyForAction("unregistered_action").execution, "disabled");
});

test("enforces role-aware proposal and approval rights", () => {
  assert.equal(canProposeAction("organization", "propose_assignment"), true);
  assert.equal(canApproveAction("organization", "propose_assignment"), false);
  assert.equal(canProposeAction("admin", "issue_refund"), true);
  assert.equal(canApproveAction("admin", "issue_refund"), false);
  assert.equal(canApproveAction("owner", "issue_refund"), true);
  assert.equal(canProposeAction("customer", "propose_quote"), false);
});
