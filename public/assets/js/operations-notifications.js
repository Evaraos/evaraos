import {
  emitEvent,
  subscribeEvent,
  unsubscribeEvent,
  OPERATIONS_EVENT_TYPES
} from './operations-events.js';

const notificationRegistry = new Map();
const notificationListeners = new Map();
let notificationCounter = 0;
let listenerCounter = 0;
let eventSubscriptionIds = [];

export const NOTIFICATION_LEVELS = Object.freeze(['critical', 'warning', 'success', 'info']);
export const NOTIFICATION_PRIORITIES = Object.freeze(['critical', 'high', 'medium', 'low']);
export const NOTIFICATION_AUDIENCES = Object.freeze(['executive', 'operations', 'dispatch', 'sales', 'finance', 'people', 'system']);
export const NOTIFICATION_STATES = Object.freeze(['unread', 'read', 'archived', 'resolved', 'expired']);
export const NOTIFICATION_ACTIONS = Object.freeze(['view', 'review', 'assign', 'resolve', 'approve', 'open', 'reroute', 'acknowledge']);

function createNotificationId() {
  notificationCounter += 1;
  return `note_${Date.now()}_${notificationCounter}`;
}

function createListenerId() {
  listenerCounter += 1;
  return `note_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeLevel(level = 'info') {
  const normalized = String(level || 'info').trim().toLowerCase();
  return NOTIFICATION_LEVELS.includes(normalized) ? normalized : 'info';
}

function normalizePriority(priority = '') {
  const normalized = String(priority || '').trim().toLowerCase();
  if (NOTIFICATION_PRIORITIES.includes(normalized)) return normalized;
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning') return 'high';
  return 'medium';
}

function normalizeAudience(audience = 'operations') {
  const normalized = String(audience || 'operations').trim().toLowerCase();
  return NOTIFICATION_AUDIENCES.includes(normalized) ? normalized : 'operations';
}

function normalizeState(state = 'unread') {
  const normalized = String(state || 'unread').trim().toLowerCase();
  return NOTIFICATION_STATES.includes(normalized) ? normalized : 'unread';
}

function normalizeAction(action = 'view') {
  const normalized = String(action || 'view').trim().toLowerCase();
  return NOTIFICATION_ACTIONS.includes(normalized) ? normalized : 'view';
}

function normalizeType(type = 'operational_update') {
  return String(type || 'operational_update').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
}

function notifySubscribers(notification) {
  notificationListeners.forEach((listener) => {
    try {
      listener(notification, getNotifications());
    } catch (error) {
      console.error('Notification listener failure:', error);
    }
  });
}

function inferPriority(level = 'info', priority = '') {
  if (priority) return normalizePriority(priority);
  const normalized = normalizeLevel(level);
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning') return 'high';
  if (normalized === 'success') return 'low';
  return 'medium';
}

export function createNotification(input = {}) {
  const level = normalizeLevel(input.level);
  const state = normalizeState(input.state || (input.read ? 'read' : 'unread'));

  const notification = {
    id: input.id || createNotificationId(),
    title: input.title || 'Operational Notification',
    detail: input.detail || '',
    type: normalizeType(input.type),
    level,
    priority: inferPriority(level, input.priority),
    audience: normalizeAudience(input.audience),
    sourceEventId: input.sourceEventId || '',
    sourceEventType: input.sourceEventType || '',
    actionUrl: input.actionUrl || '',
    actionType: normalizeAction(input.actionType || input.action || 'view'),
    actionLabel: input.actionLabel || 'View',
    actor: input.actor || null,
    metadata: input.metadata || {},
    read: state === 'read' || Boolean(input.read || false),
    archived: state === 'archived' || Boolean(input.archived || false),
    resolved: state === 'resolved' || Boolean(input.resolved || false),
    state,
    createdAtMs: input.createdAtMs || Date.now(),
    expiresAtMs: input.expiresAtMs || null
  };

  notificationRegistry.set(notification.id, notification);
  notifySubscribers(notification);

  emitNotificationEvent(notification);

  return notification;
}

export function updateNotificationState(notificationId, state = 'read') {
  const notification = notificationRegistry.get(notificationId);
  if (!notification) return null;

  const nextState = normalizeState(state);
  const updated = {
    ...notification,
    state: nextState,
    read: nextState === 'read' || notification.read,
    archived: nextState === 'archived',
    resolved: nextState === 'resolved',
    updatedAtMs: Date.now()
  };

  if (nextState === 'read') updated.readAtMs = Date.now();
  if (nextState === 'archived') updated.archivedAtMs = Date.now();
  if (nextState === 'resolved') updated.resolvedAtMs = Date.now();

  notificationRegistry.set(notificationId, updated);
  notifySubscribers(updated);

  return updated;
}

export function markNotificationRead(notificationId) {
  return updateNotificationState(notificationId, 'read');
}

export function markNotificationUnread(notificationId) {
  const notification = notificationRegistry.get(notificationId);
  if (!notification) return null;

  const updated = {
    ...notification,
    state: 'unread',
    read: false,
    updatedAtMs: Date.now()
  };

  notificationRegistry.set(notificationId, updated);
  notifySubscribers(updated);

  return updated;
}

export function resolveNotification(notificationId) {
  return updateNotificationState(notificationId, 'resolved');
}

export function archiveNotification(notificationId) {
  return updateNotificationState(notificationId, 'archived');
}

export function markAllNotificationsRead() {
  notificationRegistry.forEach((notification, id) => {
    notificationRegistry.set(id, {
      ...notification,
      state: notification.state === 'archived' || notification.state === 'resolved' ? notification.state : 'read',
      read: true,
      readAtMs: Date.now()
    });
  });

  notifySubscribers(null);
  return getNotifications();
}

export function getNotifications(options = {}) {
  let rows = [...notificationRegistry.values()];

  if (options.audience) {
    const audience = normalizeAudience(options.audience);
    rows = rows.filter((notification) => notification.audience === audience);
  }

  if (options.level) {
    const level = normalizeLevel(options.level);
    rows = rows.filter((notification) => notification.level === level);
  }

  if (options.priority) {
    const priority = normalizePriority(options.priority);
    rows = rows.filter((notification) => notification.priority === priority);
  }

  if (options.state) {
    const state = normalizeState(options.state);
    rows = rows.filter((notification) => notification.state === state);
  }

  if (options.unreadOnly) {
    rows = rows.filter((notification) => !notification.read && notification.state === 'unread');
  }

  if (!options.includeArchived) {
    rows = rows.filter((notification) => !notification.archived && notification.state !== 'archived');
  }

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function getNotificationSummary() {
  return getNotifications({ includeArchived: true }).reduce((summary, notification) => {
    summary.total += 1;
    summary.byAudience[notification.audience] = (summary.byAudience[notification.audience] || 0) + 1;
    summary.byLevel[notification.level] = (summary.byLevel[notification.level] || 0) + 1;
    summary.byState[notification.state] = (summary.byState[notification.state] || 0) + 1;
    if (!notification.read && notification.state === 'unread') summary.unread += 1;
    return summary;
  }, {
    total: 0,
    unread: 0,
    byAudience: {},
    byLevel: {},
    byState: {}
  });
}

export function subscribeNotifications(callback) {
  if (typeof callback !== 'function') {
    throw new Error('subscribeNotifications requires a callback.');
  }

  const listenerId = createListenerId();
  notificationListeners.set(listenerId, callback);

  callback(null, getNotifications());

  return listenerId;
}

export function unsubscribeNotifications(listenerId) {
  return notificationListeners.delete(listenerId);
}

function eventToNotification(event = {}) {
  const type = event.type || '';
  const payload = event.payload || {};

  if (type === OPERATIONS_EVENT_TYPES.ALERT_CRITICAL) {
    return createNotification({
      title: payload.title || 'Critical operational alert',
      detail: payload.detail || 'A critical operational threshold was triggered.',
      type: 'critical_alert',
      level: 'critical',
      priority: 'critical',
      audience: 'executive',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './alerts-dashboard.html',
      actionType: 'review',
      actionLabel: 'Review Alert',
      actor: event.actor || null,
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.ALERT_WARNING) {
    return createNotification({
      title: payload.title || 'Operational warning',
      detail: payload.detail || 'A warning threshold was triggered.',
      type: 'performance_warning',
      level: 'warning',
      priority: 'high',
      audience: 'operations',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './alerts-dashboard.html',
      actionType: 'review',
      actionLabel: 'Review Warning',
      actor: event.actor || null,
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.JOB_ASSIGNED) {
    return createNotification({
      title: 'Job assigned',
      detail: payload.customerName ? `New job assignment for ${payload.customerName}.` : 'A job was assigned.',
      type: 'job_assignment',
      level: 'info',
      priority: 'medium',
      audience: 'dispatch',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './jobs.html',
      actionType: 'open',
      actionLabel: 'Open Job',
      actor: event.actor || null,
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.LEAD_ASSIGNED) {
    return createNotification({
      title: 'Lead assigned',
      detail: payload.customerName ? `New lead assignment for ${payload.customerName}.` : 'A lead was assigned.',
      type: 'lead_assignment',
      level: 'info',
      priority: 'medium',
      audience: 'sales',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './leads.html',
      actionType: 'open',
      actionLabel: 'Open Lead',
      actor: event.actor || null,
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.TERRITORY_OVERLOADED) {
    return createNotification({
      title: 'Territory overloaded',
      detail: payload.territoryName ? `${payload.territoryName} needs operational review.` : 'A territory needs operational review.',
      type: 'territory_overload',
      level: 'warning',
      priority: 'high',
      audience: 'operations',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './territories.html',
      actionType: 'review',
      actionLabel: 'Review Territory',
      actor: event.actor || null,
      metadata: payload
    });
  }

  return null;
}

export function startNotificationEventBridge() {
  stopNotificationEventBridge();

  eventSubscriptionIds = [
    subscribeEvent('alert.*', eventToNotification),
    subscribeEvent('job.assigned', eventToNotification),
    subscribeEvent('lead.assigned', eventToNotification),
    subscribeEvent('territory.overloaded', eventToNotification)
  ];

  return stopNotificationEventBridge;
}

export function stopNotificationEventBridge() {
  eventSubscriptionIds.forEach((id) => unsubscribeEvent(id));
  eventSubscriptionIds = [];
}

export function clearNotifications() {
  notificationRegistry.clear();
  notifySubscribers(null);
}

export function emitNotificationEvent(notification = {}) {
  return emitEvent('notification.created', notification, {
    source: 'operations-notifications',
    severity: notification.level || 'info',
    correlationId: notification.sourceEventId || null
  });
}

window.EvaraOperationsNotifications = {
  NOTIFICATION_LEVELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_STATES,
  NOTIFICATION_ACTIONS,
  createNotification,
  updateNotificationState,
  markNotificationRead,
  markNotificationUnread,
  resolveNotification,
  archiveNotification,
  markAllNotificationsRead,
  getNotifications,
  getNotificationSummary,
  subscribeNotifications,
  unsubscribeNotifications,
  startNotificationEventBridge,
  stopNotificationEventBridge,
  clearNotifications,
  emitNotificationEvent
};
