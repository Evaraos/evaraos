import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import { emitEvent } from './operations-events.js';

const notificationAdapter = createCollectionAdapter(EvaraCollections.CUSTOMER_NOTIFICATIONS);
const notificationRegistry = new Map();
const notificationListeners = new Map();

let listenerCounter = 0;
let unsubscribeLiveNotifications = null;

function nextListenerId() {
  listenerCounter += 1;
  return `persistent_notification_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'unread') {
  const status = String(value || 'unread').trim().toLowerCase();
  return ['unread', 'read', 'archived', 'dismissed'].includes(status) ? status : 'unread';
}

function normalizePriority(value = 'normal') {
  const priority = String(value || 'normal').trim().toLowerCase();
  return ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
}

function normalizeType(value = 'account') {
  const type = String(value || 'account').trim().toLowerCase();
  return ['account', 'billing', 'invoice', 'quote', 'subscription', 'support', 'service', 'system', 'promotion'].includes(type) ? type : 'account';
}

function publish(item = null) {
  const snapshot = getLocalCustomerNotifications();
  notificationListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Persistent notification listener failure:', error);
    }
  });
}

function buildNotification(input = {}) {
  return {
    id: input.id || `customer_notification_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    customerId: input.customerId || '',
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    title: input.title || 'Notification',
    body: input.body || '',
    type: normalizeType(input.type),
    priority: normalizePriority(input.priority),
    status: normalizeStatus(input.status),
    relatedType: input.relatedType || '',
    relatedId: input.relatedId || '',
    actionUrl: input.actionUrl || '',
    readAtMs: Number(input.readAtMs || 0),
    archivedAtMs: Number(input.archivedAtMs || 0),
    dismissedAtMs: Number(input.dismissedAtMs || 0),
    createdAtMs: Number(input.createdAtMs || Date.now()),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

function hydrateLocalNotification(record = {}) {
  if (!record?.id) return null;
  const notification = buildNotification(record);
  notificationRegistry.set(notification.id, notification);
  publish(notification);
  return notification;
}

export async function createPersistentCustomerNotification(input = {}, options = {}) {
  const notification = buildNotification(input);
  notificationRegistry.set(notification.id, notification);
  await notificationAdapter.set(notification.id, notification, { merge: true, ...options });
  publish(notification);

  emitEvent('customer.notification_created', {
    notificationId: notification.id,
    customerId: notification.customerId,
    companyId: notification.companyId,
    type: notification.type,
    priority: notification.priority,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId
  }, {
    source: 'persistent-customer-notifications-adapter',
    severity: notification.priority === 'urgent' ? 'warning' : 'info',
    correlationId: notification.relatedId || notification.id
  });

  return notification;
}

export async function updatePersistentCustomerNotification(notificationId, patch = {}, options = {}) {
  const existing = notificationRegistry.get(notificationId) || { id: notificationId };
  const updated = buildNotification({ ...existing, ...patch, id: notificationId });
  notificationRegistry.set(notificationId, updated);
  await notificationAdapter.update(notificationId, { ...patch, updatedAtMs: Date.now() }, options);
  publish(updated);
  return updated;
}

export async function markPersistentNotificationRead(notificationId, options = {}) {
  return updatePersistentCustomerNotification(notificationId, {
    status: 'read',
    readAtMs: Date.now()
  }, options);
}

export async function archivePersistentNotification(notificationId, options = {}) {
  return updatePersistentCustomerNotification(notificationId, {
    status: 'archived',
    archivedAtMs: Date.now()
  }, options);
}

export async function dismissPersistentNotification(notificationId, options = {}) {
  return updatePersistentCustomerNotification(notificationId, {
    status: 'dismissed',
    dismissedAtMs: Date.now()
  }, options);
}

export async function loadPersistentCustomerNotifications(options = {}) {
  const records = await notificationAdapter.list(options);
  records.forEach(hydrateLocalNotification);
  return getLocalCustomerNotifications();
}

export function subscribePersistentCustomerNotifications(options = {}, callback = () => {}) {
  if (unsubscribeLiveNotifications) unsubscribeLiveNotifications();

  unsubscribeLiveNotifications = notificationAdapter.subscribe(options, (records = [], error = null) => {
    if (error) {
      callback(getLocalCustomerNotifications(), error);
      return;
    }

    records.forEach(hydrateLocalNotification);
    callback(getLocalCustomerNotifications(), null);
  });

  return unsubscribeLiveNotifications;
}

export function stopPersistentCustomerNotificationsSubscription() {
  if (unsubscribeLiveNotifications) unsubscribeLiveNotifications();
  unsubscribeLiveNotifications = null;
}

export async function loadCustomerNotifications(customerId, options = {}) {
  return loadPersistentCustomerNotifications({
    where: [['customerId', '==', customerId]],
    orderBy: [['createdAtMs', 'desc']],
    ...options
  });
}

export function subscribeCustomerNotifications(customerId, callback = () => {}, options = {}) {
  return subscribePersistentCustomerNotifications({
    where: [['customerId', '==', customerId]],
    orderBy: [['createdAtMs', 'desc']],
    ...options
  }, callback);
}

export async function markAllCustomerNotificationsRead(customerId) {
  const rows = getLocalCustomerNotifications({ customerId, status: 'unread' });
  await Promise.all(rows.map((notification) => markPersistentNotificationRead(notification.id)));
  return getLocalCustomerNotifications({ customerId });
}

export function getLocalCustomerNotifications(options = {}) {
  let rows = [...notificationRegistry.values()];
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.type) rows = rows.filter((row) => row.type === normalizeType(options.type));
  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function summarizeCustomerNotifications(rows = getLocalCustomerNotifications()) {
  return rows.reduce((summary, notification) => {
    summary.total += 1;
    summary.byStatus[notification.status] = (summary.byStatus[notification.status] || 0) + 1;
    summary.byType[notification.type] = (summary.byType[notification.type] || 0) + 1;
    summary.byPriority[notification.priority] = (summary.byPriority[notification.priority] || 0) + 1;
    if (notification.status === 'unread') summary.unread += 1;
    if (notification.priority === 'urgent') summary.urgent += 1;
    return summary;
  }, {
    total: 0,
    unread: 0,
    urgent: 0,
    byStatus: {},
    byType: {},
    byPriority: {}
  });
}

export function subscribeLocalCustomerNotifications(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeLocalCustomerNotifications requires a callback.');
  const id = nextListenerId();
  notificationListeners.set(id, callback);
  callback(null, getLocalCustomerNotifications());
  return id;
}

export function unsubscribeLocalCustomerNotifications(listenerId) {
  return notificationListeners.delete(listenerId);
}

window.EvaraPersistentCustomerNotificationsAdapter = {
  createPersistentCustomerNotification,
  updatePersistentCustomerNotification,
  markPersistentNotificationRead,
  archivePersistentNotification,
  dismissPersistentNotification,
  loadPersistentCustomerNotifications,
  subscribePersistentCustomerNotifications,
  stopPersistentCustomerNotificationsSubscription,
  loadCustomerNotifications,
  subscribeCustomerNotifications,
  markAllCustomerNotificationsRead,
  getLocalCustomerNotifications,
  summarizeCustomerNotifications,
  subscribeLocalCustomerNotifications,
  unsubscribeLocalCustomerNotifications
};
