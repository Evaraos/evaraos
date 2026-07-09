"use strict";

const ROLE_ALIASES = Object.freeze({
  owner: "owner",
  super_admin: "owner",
  admin: "admin",
  manager: "admin",
  operations_manager: "admin",
  operations_coordinator: "admin",
  field_manager: "admin",
  dispatcher: "admin",
  organization: "organization",
  organization_owner: "organization",
  office_owner: "organization",
  branch_owner: "organization",
  vendor: "vendor",
  lead_vendor: "vendor",
  service_vendor: "vendor",
  management_program: "vendor",
  hr: "hr",
  hr_manager: "hr",
  sales: "sales",
  sales_rep: "sales",
  technician: "field",
  tech: "field",
  cleaner: "field",
  field_staff: "field",
  crew_lead: "field",
  staff: "field",
  customer_support: "field",
  quality_control: "field",
  customer: "customer"
});

const CAPABILITY_MATRIX = Object.freeze({
  owner: Object.freeze([
    "ai.chat",
    "ai.read.operations",
    "ai.read.finance",
    "ai.propose.low_risk",
    "ai.propose.high_risk",
    "ai.approve.low_risk",
    "ai.approve.high_risk"
  ]),
  admin: Object.freeze([
    "ai.chat",
    "ai.read.operations",
    "ai.read.finance",
    "ai.propose.low_risk",
    "ai.propose.high_risk",
    "ai.approve.low_risk"
  ]),
  organization: Object.freeze([
    "ai.chat",
    "ai.read.operations",
    "ai.propose.low_risk"
  ]),
  vendor: Object.freeze([]),
  hr: Object.freeze([]),
  sales: Object.freeze([]),
  field: Object.freeze([]),
  customer: Object.freeze([])
});

const RISK_LEVELS = Object.freeze({
  NONE: "none",
  READ_ONLY: "read_only",
  LOW: "low",
  HIGH: "high",
  PROHIBITED: "prohibited"
});

const ACTION_POLICIES = Object.freeze({
  navigate_app: Object.freeze({ risk: RISK_LEVELS.NONE, execution: "automatic" }),
  get_operations_snapshot: Object.freeze({ risk: RISK_LEVELS.READ_ONLY, execution: "automatic" }),
  draft_customer_message: Object.freeze({ risk: RISK_LEVELS.LOW, execution: "approval_required" }),
  propose_schedule_change: Object.freeze({ risk: RISK_LEVELS.LOW, execution: "approval_required" }),
  propose_assignment: Object.freeze({ risk: RISK_LEVELS.LOW, execution: "approval_required" }),
  propose_quote: Object.freeze({ risk: RISK_LEVELS.LOW, execution: "approval_required" }),
  issue_refund: Object.freeze({ risk: RISK_LEVELS.HIGH, execution: "owner_approval_required" }),
  modify_permissions: Object.freeze({ risk: RISK_LEVELS.HIGH, execution: "owner_approval_required" }),
  publish_changes: Object.freeze({ risk: RISK_LEVELS.HIGH, execution: "owner_approval_required" }),
  delete_record: Object.freeze({ risk: RISK_LEVELS.HIGH, execution: "owner_approval_required" }),
  expose_secret: Object.freeze({ risk: RISK_LEVELS.PROHIBITED, execution: "disabled" }),
  bypass_authorization: Object.freeze({ risk: RISK_LEVELS.PROHIBITED, execution: "disabled" })
});

function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[value] || "customer";
}

function capabilitiesForRole(role = "") {
  return [...(CAPABILITY_MATRIX[normalizeRole(role)] || [])];
}

function hasCapability(role = "", capability = "") {
  return capabilitiesForRole(role).includes(String(capability || ""));
}

function policyForAction(actionType = "") {
  return ACTION_POLICIES[String(actionType || "").trim()] || {
    risk: RISK_LEVELS.PROHIBITED,
    execution: "disabled"
  };
}

function canProposeAction(role = "", actionType = "") {
  const policy = policyForAction(actionType);
  if (policy.risk === RISK_LEVELS.NONE || policy.risk === RISK_LEVELS.READ_ONLY) return true;
  if (policy.risk === RISK_LEVELS.LOW) return hasCapability(role, "ai.propose.low_risk");
  if (policy.risk === RISK_LEVELS.HIGH) return hasCapability(role, "ai.propose.high_risk");
  return false;
}

function canApproveAction(role = "", actionType = "") {
  const policy = policyForAction(actionType);
  if (policy.risk === RISK_LEVELS.LOW) return hasCapability(role, "ai.approve.low_risk");
  if (policy.risk === RISK_LEVELS.HIGH) return hasCapability(role, "ai.approve.high_risk");
  return policy.risk === RISK_LEVELS.NONE || policy.risk === RISK_LEVELS.READ_ONLY;
}

module.exports = {
  ACTION_POLICIES,
  CAPABILITY_MATRIX,
  RISK_LEVELS,
  canApproveAction,
  canProposeAction,
  capabilitiesForRole,
  hasCapability,
  normalizeRole,
  policyForAction
};
