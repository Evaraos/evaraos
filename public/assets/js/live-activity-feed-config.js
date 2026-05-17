// Evaraos Live Activity Feed
// Real-time operational intelligence foundation for owner, organization, vendor, admin, HR, staff, and customer dashboards.

export const LIVE_ACTIVITY_FEED_VERSION = "2026.05.17-live-operational-intelligence";

export const ACTIVITY_PRIORITY = Object.freeze({
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info"
});

export const ACTIVITY_CATEGORIES = Object.freeze({
  ecosystem: "ecosystem",
  organization: "organization",
  office: "office",
  vendor: "vendor",
  managementProgram: "management_program",
  sales: "sales",
  operations: "operations",
  payroll: "payroll",
  hr: "hr",
  customer: "customer",
  finance: "finance",
  compliance: "compliance",
  system: "system"
});

export const ACTIVITY_TYPES = Object.freeze({
  organizationCreated: "organization_created",
  officeCreated: "office_created",
  vendorCreated: "vendor_created",
  leaderPromoted: "leader_promoted",
  promotionReady: "promotion_ready",
  payrollProcessed: "payroll_processed",
  payrollIssue: "payroll_issue",
  newLead: "new_lead",
  jobCreated: "job_created",
  jobCompleted: "job_completed",
  customerMessage: "customer_message",
  customerComplaint: "customer_complaint",
  revenueMilestone: "revenue_milestone",
  riskDetected: "risk_detected",
  complianceFlag: "compliance_flag",
  systemHealthChange: "system_health_change"
});

export function createActivityEvent({
  type = ACTIVITY_TYPES.systemHealthChange,
  category = ACTIVITY_CATEGORIES.system,
  priority = ACTIVITY_PRIORITY.info,
  title = "Activity Update",
  message = "An Evaraos activity event occurred.",
  actorId = null,
  actorName = null,
  organizationId = null,
  officeId = null,
  vendorId = null,
  customerId = null,
  relatedId = null,
  metadata = {}
} = {}) {
  return {
    id: metadata.id || `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    category,
    priority,
    title,
    message,
    actorId,
    actorName,
    organizationId,
    officeId,
    vendorId,
    customerId,
    relatedId,
    metadata,
    read: false,
    archived: false,
    createdAtMs: Date.now(),
    version: LIVE_ACTIVITY_FEED_VERSION
  };
}

export function activityVisibleToRole(activity = {}, role = "customer") {
  const normalized = String(role || "customer").toLowerCase();

  if (["owner", "super_admin"].includes(normalized)) return true;
  if (["admin", "manager", "operations_manager", "operations_coordinator"].includes(normalized)) {
    return ![ACTIVITY_CATEGORIES.finance, ACTIVITY_CATEGORIES.compliance].includes(activity.category) || activity.priority !== ACTIVITY_PRIORITY.critical;
  }
  if (["hr", "hr_manager"].includes(normalized)) return [ACTIVITY_CATEGORIES.hr, ACTIVITY_CATEGORIES.payroll, ACTIVITY_CATEGORIES.system].includes(activity.category);
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(normalized)) return [ACTIVITY_CATEGORIES.vendor, ACTIVITY_CATEGORIES.managementProgram, ACTIVITY_CATEGORIES.operations, ACTIVITY_CATEGORIES.customer].includes(activity.category);
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(normalized)) return [ACTIVITY_CATEGORIES.organization, ACTIVITY_CATEGORIES.office, ACTIVITY_CATEGORIES.vendor, ACTIVITY_CATEGORIES.managementProgram, ACTIVITY_CATEGORIES.operations, ACTIVITY_CATEGORIES.sales].includes(activity.category);
  if (["sales", "sales_rep", "technician", "cleaner", "staff"].includes(normalized)) return [ACTIVITY_CATEGORIES.sales, ACTIVITY_CATEGORIES.operations, ACTIVITY_CATEGORIES.customer].includes(activity.category);
  return [ACTIVITY_CATEGORIES.customer, ACTIVITY_CATEGORIES.system].includes(activity.category);
}

export function summarizeActivityFeed(activities = []) {
  const summary = {
    total: activities.length,
    critical: 0,
    high: 0,
    unread: 0,
    archived: 0,
    riskEvents: 0,
    promotionEvents: 0,
    payrollEvents: 0,
    customerEvents: 0
  };

  activities.forEach((activity) => {
    if (activity.priority === ACTIVITY_PRIORITY.critical) summary.critical += 1;
    if (activity.priority === ACTIVITY_PRIORITY.high) summary.high += 1;
    if (!activity.read) summary.unread += 1;
    if (activity.archived) summary.archived += 1;
    if (activity.type === ACTIVITY_TYPES.riskDetected || activity.type === ACTIVITY_TYPES.complianceFlag) summary.riskEvents += 1;
    if (activity.type === ACTIVITY_TYPES.leaderPromoted || activity.type === ACTIVITY_TYPES.promotionReady) summary.promotionEvents += 1;
    if (activity.category === ACTIVITY_CATEGORIES.payroll) summary.payrollEvents += 1;
    if (activity.category === ACTIVITY_CATEGORIES.customer) summary.customerEvents += 1;
  });

  return {
    ...summary,
    generatedAtMs: Date.now(),
    version: LIVE_ACTIVITY_FEED_VERSION
  };
}

export function formatActivityForDashboard(activity = {}) {
  return {
    id: activity.id,
    title: activity.title || "Activity Update",
    message: activity.message || "No details available.",
    category: activity.category || ACTIVITY_CATEGORIES.system,
    priority: activity.priority || ACTIVITY_PRIORITY.info,
    timestamp: activity.createdAtMs || Date.now(),
    isCritical: activity.priority === ACTIVITY_PRIORITY.critical,
    isUnread: activity.read !== true,
    linkTarget: activity.metadata?.linkTarget || null
  };
}
