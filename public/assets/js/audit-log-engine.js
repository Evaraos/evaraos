import {
  subscribeEvent,
  unsubscribeEvent,
  emitEvent
} from './operations-events.js';

const auditRegistry = new Map();
const auditListeners = new Map();

let auditCounter = 0;
let listenerCounter = 0;
let eventSubscriptionId = null;

function createAuditId() {
  auditCounter += 1;
  return `audit_${Date.now()}_${auditCounter}`;
}

function createListenerId() {
  listenerCounter += 1;
  return `audit_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeSeverity(value = 'info') {
  const severity = String(value || 'info').trim().toLowerCase();
  if (['critical', 'warning', 'info', 'success'].includes(severity)) return severity;
  return 'info';
}

function normalizeCategory(type = '') {
  const root = String(type || '').split('.')[0];

  if (['lead', 'job', 'worker', 'territory', 'alert', 'automation', 'notification', 'governance'].includes(root)) {
    return root;
  }

  return 'system';
}

function notifyAuditSubscribers(entry = null) {
  const entries = getAuditEntries();

  auditListeners.forEach((listener) => {
    try {
      listener(entry, entries);
    } catch (error) {
      console.error('Audit listener failure:', error);
    }
  });
}

export function createAuditEntry(event = {}, options = {}) {
  const entry = {
    id: options.id || createAuditId(),
    eventId: event.id || '',
    eventType: event.type || 'system.event',
    category: options.category || normalizeCategory(event.type),
    severity: normalizeSeverity(options.severity || event.severity),
    actor: event.actor || options.actor || null,
    source: event.source || options.source || 'evaraos',
    correlationId: event.correlationId || options.correlationId || null,
    payloadSnapshot: event.payload || {},
    metadata: {
      ...(event.metadata || {}),
      ...(options.metadata || {})
    },
    createdAtMs: options.createdAtMs || event.timestamp || Date.now()
  };

  auditRegistry.set(entry.id, entry);
  notifyAuditSubscribers(entry);

  return entry;
}

export function getAuditEntries(options = {}) {
  let rows = [...auditRegistry.values()];

  if (options.category) {
    rows = rows.filter((entry) => entry.category === options.category);
  }

  if (options.severity) {
    rows = rows.filter((entry) => entry.severity === normalizeSeverity(options.severity));
  }

  if (options.eventType) {
    rows = rows.filter((entry) => entry.eventType === options.eventType);
  }

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function subscribeAuditLog(callback) {
  if (typeof callback !== 'function') {
    throw new Error('subscribeAuditLog requires a callback.');
  }

  const listenerId = createListenerId();
  auditListeners.set(listenerId, callback);
  callback(null, getAuditEntries());

  return listenerId;
}

export function unsubscribeAuditLog(listenerId) {
  return auditListeners.delete(listenerId);
}

export function clearAuditLog() {
  auditRegistry.clear();
  notifyAuditSubscribers(null);
}

export function startAuditLogEngine() {
  stopAuditLogEngine();

  eventSubscriptionId = subscribeEvent('*', (event) => {
    if (event.type === 'audit.entry_created') return;

    const entry = createAuditEntry(event);

    emitEvent('audit.entry_created', {
      auditId: entry.id,
      eventId: entry.eventId,
      eventType: entry.eventType,
      category: entry.category,
      severity: entry.severity
    }, {
      source: 'audit-log-engine',
      severity: entry.severity,
      correlationId: entry.eventId
    });
  });

  return stopAuditLogEngine;
}

export function stopAuditLogEngine() {
  if (eventSubscriptionId) unsubscribeEvent(eventSubscriptionId);
  eventSubscriptionId = null;
}

export function summarizeAuditLog(entries = getAuditEntries()) {
  return entries.reduce((summary, entry) => {
    summary.total += 1;
    summary.byCategory[entry.category] = (summary.byCategory[entry.category] || 0) + 1;
    summary.bySeverity[entry.severity] = (summary.bySeverity[entry.severity] || 0) + 1;
    return summary;
  }, {
    total: 0,
    byCategory: {},
    bySeverity: {}
  });
}

window.EvaraAuditLogEngine = {
  createAuditEntry,
  getAuditEntries,
  subscribeAuditLog,
  unsubscribeAuditLog,
  clearAuditLog,
  startAuditLogEngine,
  stopAuditLogEngine,
  summarizeAuditLog
};
