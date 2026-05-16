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
  if (['critical', 'warning', 'success', 'info'].includes(normalized)) return normalized;
  return 'info';
}

function normalizeAudience(audience = 'operations') {
  const normalized = String(audience || 'operations').trim().toLowerCase();
  if (['executive', 'operations', 'dispatch', 'sales', 'finance', 'people', 'system'].includes(normalized)) return normalized;
  return 'operations';
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

export function createNotification(input = {}) {
  const notification = {
    id: input.id || createNotificationId(),
    title: input.title || 'Operational Notification',
    detail: input.detail || '',
    level: normalizeLevel(input.level),
    audience: normalizeAudience(input.audience),
    sourceEventId: input.sourceEventId || '',
    sourceEventType: input.sourceEventType || '',
    actionUrl: input.actionUrl || '',
    metadata: input.metadata || {},
    read: Boolean(input.read || false),
    createdAtMs: input.createdAtMs || Date.now()
  };

  notificationRegistry.set(notification.id, notification);
  notifySubscribers(notification);

  return notification;
}

export function markNotificationRead(notificationId) {
  const notification = notificationRegistry.get(notificationId);
  if (!notification) return null;

  const updated = {
    ...notification,
    read: true,
    readAtMs: Date.now()
  };

  notificationRegistry.set(notificationId, updated);
  notifySubscribers(updated);

  return updated;
}

export function markAllNotificationsRead() {
  notificationRegistry.forEach((notification, id) => {
    notificationRegistry.set(id, {
      ...notification,
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

  if (options.unreadOnly) {
    rows = rows.filter((notification) => !notification.read);
  }

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
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
      level: 'critical',
      audience: 'executive',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './alerts-dashboard.html',
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.ALERT_WARNING) {
    return createNotification({
      title: payload.title || 'Operational warning',
      detail: payload.detail || 'A warning threshold was triggered.',
      level: 'warning',
      audience: 'operations',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './alerts-dashboard.html',
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.JOB_ASSIGNED) {
    return createNotification({
      title: 'Job assigned',
      detail: payload.customerName ? `New job assignment for ${payload.customerName}.` : 'A job was assigned.',
      level: 'info',
      audience: 'dispatch',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './jobs.html',
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.LEAD_ASSIGNED) {
    return createNotification({
      title: 'Lead assigned',
      detail: payload.customerName ? `New lead assignment for ${payload.customerName}.` : 'A lead was assigned.',
      level: 'info',
      audience: 'sales',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './leads.html',
      metadata: payload
    });
  }

  if (type === OPERATIONS_EVENT_TYPES.TERRITORY_OVERLOADED) {
    return createNotification({
      title: 'Territory overloaded',
      detail: payload.territoryName ? `${payload.territoryName} needs operational review.` : 'A territory needs operational review.',
      level: 'warning',
      audience: 'operations',
      sourceEventId: event.id,
      sourceEventType: type,
      actionUrl: './territories.html',
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
    severity: notification.level || 'info'
  });
}

window.EvaraOperationsNotifications = {
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  getNotifications,
  subscribeNotifications,
  unsubscribeNotifications,
  startNotificationEventBridge,
  stopNotificationEventBridge,
  clearNotifications,
  emitNotificationEvent
};
