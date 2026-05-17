// Evaraos Notification Engine
// Converts live activity events into dashboard alerts, role-filtered notifications, and future push/email/SMS triggers.

import {
  ACTIVITY_PRIORITY,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPES,
  activityVisibleToRole,
  formatActivityForDashboard
} from "./live-activity-feed-config.js";

export const NOTIFICATION_ENGINE_VERSION = "2026.05.17-notification-engine";

export const NOTIFICATION_CHANNELS = Object.freeze({
  dashboard: "dashboard",
  push: "push",
  email: "email",
  sms: "sms",
  inApp: "in_app"
});

export const NOTIFICATION_STATUS = Object.freeze({
  pending: "pending",
  delivered: "delivered",
  read: "read",
  dismissed: "dismissed",
  archived: "archived",
  failed: "failed"
});

export const NOTIFICATION_AUDIENCES = Object.freeze({
  owner: "owner",
  leadership: "leadership",
  organization: "organization",
  vendor: "vendor",
  admin: "admin",
  hr: "hr",
  staff: "staff",
  customer: "customer"
});

export function priorityToChannels(priority = ACTIVITY_PRIORITY.info) {
  if (priority === ACTIVITY_PRIORITY.critical) {
    return [NOTIFICATION_CHANNELS.dashboard, NOTIFICATION_CHANNELS.inApp, NOTIFICATION_CHANNELS.push, NOTIFICATION_CHANNELS.email];
  }

  if (priority === ACTIVITY_PRIORITY.high) {
    return [NOTIFICATION_CHANNELS.dashboard, NOTIFICATION_CHANNELS.inApp, NOTIFICATION_CHANNELS.push];
  }

  if (priority === ACTIVITY_PRIORITY.medium) {
    return [NOTIFICATION_CHANNELS.dashboard, NOTIFICATION_CHANNELS.inApp];
  }

  return [NOTIFICATION_CHANNELS.dashboard];
}

export function audienceForActivity(activity = {}) {
  const category = activity.category || ACTIVITY_CATEGORIES.system;
  const type = activity.type || ACTIVITY_TYPES.systemHealthChange;
  const priority = activity.priority || ACTIVITY_PRIORITY.info;

  if (priority === ACTIVITY_PRIORITY.critical) return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.leadership];
  if ([ACTIVITY_TYPES.payrollIssue, ACTIVITY_TYPES.payrollProcessed].includes(type)) return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.hr, NOTIFICATION_AUDIENCES.admin];
  if ([ACTIVITY_TYPES.promotionReady, ACTIVITY_TYPES.leaderPromoted].includes(type)) return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.organization, NOTIFICATION_AUDIENCES.vendor];
  if (category === ACTIVITY_CATEGORIES.customer) return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.admin, NOTIFICATION_AUDIENCES.staff, NOTIFICATION_AUDIENCES.customer];
  if (category === ACTIVITY_CATEGORIES.vendor) return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.vendor, NOTIFICATION_AUDIENCES.organization];
  if (category === ACTIVITY_CATEGORIES.office || category === ACTIVITY_CATEGORIES.organization) return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.organization];

  return [NOTIFICATION_AUDIENCES.owner, NOTIFICATION_AUDIENCES.leadership];
}

export function buildNotificationFromActivity(activity = {}) {
  const formatted = formatActivityForDashboard(activity);

  return {
    id: `notification_${formatted.id || Date.now()}`,
    activityId: formatted.id,
    title: formatted.title,
    message: formatted.message,
    category: formatted.category,
    priority: formatted.priority,
    audiences: audienceForActivity(activity),
    channels: priorityToChannels(formatted.priority),
    status: NOTIFICATION_STATUS.pending,
    linkTarget: formatted.linkTarget,
    createdAtMs: Date.now(),
    deliveredAtMs: null,
    readAtMs: null,
    dismissedAtMs: null,
    version: NOTIFICATION_ENGINE_VERSION
  };
}

export function notificationVisibleToRole(notification = {}, role = "customer") {
  const normalized = String(role || "customer").toLowerCase();
  const activityShape = {
    category: notification.category,
    priority: notification.priority
  };

  if (["owner", "super_admin"].includes(normalized)) return true;
  if (!activityVisibleToRole(activityShape, normalized)) return false;

  const audiences = notification.audiences || [];
  if (["admin", "manager", "operations_manager", "operations_coordinator"].includes(normalized)) return audiences.includes(NOTIFICATION_AUDIENCES.admin) || audiences.includes(NOTIFICATION_AUDIENCES.leadership);
  if (["hr", "hr_manager"].includes(normalized)) return audiences.includes(NOTIFICATION_AUDIENCES.hr);
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(normalized)) return audiences.includes(NOTIFICATION_AUDIENCES.vendor);
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(normalized)) return audiences.includes(NOTIFICATION_AUDIENCES.organization);
  if (["sales", "sales_rep", "technician", "cleaner", "staff"].includes(normalized)) return audiences.includes(NOTIFICATION_AUDIENCES.staff);

  return audiences.includes(NOTIFICATION_AUDIENCES.customer);
}

export function summarizeNotifications(notifications = []) {
  const summary = {
    total: notifications.length,
    pending: 0,
    delivered: 0,
    read: 0,
    critical: 0,
    high: 0,
    failed: 0
  };

  notifications.forEach((notification) => {
    if (notification.status === NOTIFICATION_STATUS.pending) summary.pending += 1;
    if (notification.status === NOTIFICATION_STATUS.delivered) summary.delivered += 1;
    if (notification.status === NOTIFICATION_STATUS.read) summary.read += 1;
    if (notification.status === NOTIFICATION_STATUS.failed) summary.failed += 1;
    if (notification.priority === ACTIVITY_PRIORITY.critical) summary.critical += 1;
    if (notification.priority === ACTIVITY_PRIORITY.high) summary.high += 1;
  });

  return {
    ...summary,
    generatedAtMs: Date.now(),
    version: NOTIFICATION_ENGINE_VERSION
  };
}
