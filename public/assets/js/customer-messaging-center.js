import { emitEvent } from './operations-events.js';

const threadRegistry = new Map();
const messageRegistry = new Map();
const messageListeners = new Map();

let threadCounter = 0;
let messageCounter = 0;
let listenerCounter = 0;

function nextThreadId() {
  threadCounter += 1;
  return `customer_thread_${Date.now()}_${threadCounter}`;
}

function nextMessageId() {
  messageCounter += 1;
  return `customer_message_${Date.now()}_${messageCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `customer_message_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'open') {
  const status = String(value || 'open').trim().toLowerCase();
  return ['open', 'pending_customer', 'pending_team', 'resolved', 'closed'].includes(status) ? status : 'open';
}

function normalizePriority(value = 'normal') {
  const priority = String(value || 'normal').trim().toLowerCase();
  return ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
}

function normalizeChannel(value = 'portal') {
  const channel = String(value || 'portal').trim().toLowerCase();
  return ['portal', 'email', 'sms', 'phone', 'internal'].includes(channel) ? channel : 'portal';
}

function publish(item = null) {
  const snapshot = getCustomerMessageThreads();
  messageListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Customer messaging listener failure:', error);
    }
  });
}

function buildThread(input = {}) {
  return {
    id: input.id || nextThreadId(),
    customerId: input.customerId || '',
    customerName: input.customerName || '',
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    subject: input.subject || 'Customer Conversation',
    status: normalizeStatus(input.status),
    priority: normalizePriority(input.priority),
    channel: normalizeChannel(input.channel),
    relatedType: input.relatedType || '',
    relatedId: input.relatedId || '',
    assignedToUid: input.assignedToUid || '',
    assignedToName: input.assignedToName || '',
    unreadForCustomer: Number(input.unreadForCustomer || 0),
    unreadForTeam: Number(input.unreadForTeam || 0),
    lastMessagePreview: input.lastMessagePreview || '',
    lastMessageAtMs: input.lastMessageAtMs || Date.now(),
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

function buildMessage(thread = {}, input = {}) {
  return {
    id: input.id || nextMessageId(),
    threadId: thread.id,
    customerId: thread.customerId,
    companyId: thread.companyId,
    senderId: input.senderId || '',
    senderName: input.senderName || 'User',
    senderRole: input.senderRole || 'customer',
    body: input.body || '',
    channel: normalizeChannel(input.channel || thread.channel),
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    readByCustomer: Boolean(input.readByCustomer),
    readByTeam: Boolean(input.readByTeam),
    createdAtMs: input.createdAtMs || Date.now(),
    metadata: input.metadata || {}
  };
}

export function createCustomerMessageThread(input = {}) {
  const thread = buildThread(input);
  threadRegistry.set(thread.id, thread);
  messageRegistry.set(thread.id, []);
  publish(thread);

  emitEvent('customer.thread_created', {
    threadId: thread.id,
    customerId: thread.customerId,
    companyId: thread.companyId,
    subject: thread.subject,
    priority: thread.priority,
    relatedType: thread.relatedType,
    relatedId: thread.relatedId
  }, {
    source: 'customer-messaging-center',
    severity: thread.priority === 'urgent' ? 'warning' : 'info',
    correlationId: thread.relatedId || thread.id
  });

  return thread;
}

export function addCustomerMessage(threadId, input = {}) {
  const thread = threadRegistry.get(threadId);
  if (!thread) return null;

  const message = buildMessage(thread, input);
  const rows = messageRegistry.get(threadId) || [];
  rows.push(message);
  messageRegistry.set(threadId, rows);

  const fromCustomer = String(message.senderRole || '').toLowerCase() === 'customer';
  const updatedThread = {
    ...thread,
    status: fromCustomer ? 'pending_team' : 'pending_customer',
    unreadForTeam: fromCustomer ? Number(thread.unreadForTeam || 0) + 1 : Number(thread.unreadForTeam || 0),
    unreadForCustomer: fromCustomer ? Number(thread.unreadForCustomer || 0) : Number(thread.unreadForCustomer || 0) + 1,
    lastMessagePreview: message.body.slice(0, 160),
    lastMessageAtMs: message.createdAtMs,
    updatedAtMs: Date.now()
  };

  threadRegistry.set(threadId, updatedThread);
  publish(updatedThread);

  emitEvent('customer.message_created', {
    threadId,
    messageId: message.id,
    customerId: thread.customerId,
    companyId: thread.companyId,
    senderRole: message.senderRole,
    relatedType: thread.relatedType,
    relatedId: thread.relatedId
  }, {
    source: 'customer-messaging-center',
    severity: thread.priority === 'urgent' ? 'warning' : 'info',
    correlationId: thread.relatedId || threadId
  });

  return message;
}

export function updateCustomerMessageThread(threadId, patch = {}) {
  const thread = threadRegistry.get(threadId);
  if (!thread) return null;

  const updated = {
    ...thread,
    ...patch,
    status: normalizeStatus(patch.status || thread.status),
    priority: normalizePriority(patch.priority || thread.priority),
    updatedAtMs: Date.now()
  };

  threadRegistry.set(threadId, updated);
  publish(updated);

  emitEvent('customer.thread_updated', {
    threadId,
    customerId: updated.customerId,
    companyId: updated.companyId,
    status: updated.status,
    priority: updated.priority
  }, {
    source: 'customer-messaging-center',
    severity: updated.priority === 'urgent' ? 'warning' : 'info',
    correlationId: updated.relatedId || threadId
  });

  return updated;
}

export function markCustomerThreadRead(threadId, reader = 'customer') {
  const thread = threadRegistry.get(threadId);
  if (!thread) return null;

  const patch = reader === 'team'
    ? { unreadForTeam: 0, teamReadAtMs: Date.now() }
    : { unreadForCustomer: 0, customerReadAtMs: Date.now() };

  return updateCustomerMessageThread(threadId, patch);
}

export function resolveCustomerThread(threadId, resolvedBy = {}) {
  return updateCustomerMessageThread(threadId, {
    status: 'resolved',
    resolvedAtMs: Date.now(),
    resolvedBy
  });
}

export function getCustomerMessageThreads(options = {}) {
  let rows = [...threadRegistry.values()];
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.priority) rows = rows.filter((row) => row.priority === normalizePriority(options.priority));
  if (options.relatedType) rows = rows.filter((row) => row.relatedType === options.relatedType);
  if (options.relatedId) rows = rows.filter((row) => row.relatedId === options.relatedId);
  return rows.sort((a, b) => Number(b.lastMessageAtMs || 0) - Number(a.lastMessageAtMs || 0));
}

export function getCustomerThreadMessages(threadId) {
  return [...(messageRegistry.get(threadId) || [])].sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
}

export function summarizeCustomerMessages(rows = getCustomerMessageThreads()) {
  return rows.reduce((summary, thread) => {
    summary.total += 1;
    summary.byStatus[thread.status] = (summary.byStatus[thread.status] || 0) + 1;
    summary.byPriority[thread.priority] = (summary.byPriority[thread.priority] || 0) + 1;
    summary.unreadForTeam += Number(thread.unreadForTeam || 0);
    summary.unreadForCustomer += Number(thread.unreadForCustomer || 0);
    if (['open', 'pending_team', 'pending_customer'].includes(thread.status)) summary.open += 1;
    if (thread.priority === 'urgent') summary.urgent += 1;
    return summary;
  }, {
    total: 0,
    open: 0,
    urgent: 0,
    unreadForTeam: 0,
    unreadForCustomer: 0,
    byStatus: {},
    byPriority: {}
  });
}

export function subscribeCustomerMessages(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeCustomerMessages requires a callback.');
  const id = nextListenerId();
  messageListeners.set(id, callback);
  callback(null, getCustomerMessageThreads());
  return id;
}

export function unsubscribeCustomerMessages(listenerId) {
  return messageListeners.delete(listenerId);
}

export function clearCustomerMessages() {
  threadRegistry.clear();
  messageRegistry.clear();
  publish(null);
}

window.EvaraCustomerMessagingCenter = {
  createCustomerMessageThread,
  addCustomerMessage,
  updateCustomerMessageThread,
  markCustomerThreadRead,
  resolveCustomerThread,
  getCustomerMessageThreads,
  getCustomerThreadMessages,
  summarizeCustomerMessages,
  subscribeCustomerMessages,
  unsubscribeCustomerMessages,
  clearCustomerMessages
};
