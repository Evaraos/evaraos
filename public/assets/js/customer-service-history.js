import { emitEvent } from './operations-events.js';
import { getInvoices } from './invoice-orchestration-engine.js';
import { getRoutes } from './route-coordination.js';
import { getCustomerMessageThreads } from './customer-messaging-center.js';

const historyRegistry = new Map();
const historyListeners = new Map();

let historyCounter = 0;
let listenerCounter = 0;

function nextHistoryId() {
  historyCounter += 1;
  return `service_history_${Date.now()}_${historyCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `service_history_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeType(value = 'service') {
  const type = String(value || 'service').trim().toLowerCase();
  return ['service', 'job', 'route', 'invoice', 'message', 'quote', 'subscription', 'media', 'note'].includes(type) ? type : 'service';
}

function normalizeStatus(value = 'completed') {
  const status = String(value || 'completed').trim().toLowerCase();
  return ['scheduled', 'active', 'completed', 'cancelled', 'failed', 'archived'].includes(status) ? status : 'completed';
}

function publish(item = null) {
  const snapshot = getCustomerServiceHistory();
  historyListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Customer service history listener failure:', error);
    }
  });
}

function buildEntry(input = {}) {
  return {
    id: input.id || nextHistoryId(),
    customerId: input.customerId || '',
    customerName: input.customerName || '',
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    type: normalizeType(input.type),
    status: normalizeStatus(input.status),
    title: input.title || 'Service History Entry',
    description: input.description || '',
    relatedId: input.relatedId || '',
    relatedType: input.relatedType || '',
    serviceDateMs: Number(input.serviceDateMs || input.completedAtMs || input.createdAtMs || Date.now()),
    amountCents: Math.max(0, Math.round(Number(input.amountCents || 0))),
    location: input.location || null,
    address: input.address || '',
    media: Array.isArray(input.media) ? input.media : [],
    notes: input.notes || '',
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

export function addCustomerServiceHistory(input = {}) {
  const entry = buildEntry(input);
  historyRegistry.set(entry.id, entry);
  publish(entry);

  emitEvent('customer.service_history_created', {
    historyId: entry.id,
    customerId: entry.customerId,
    companyId: entry.companyId,
    type: entry.type,
    status: entry.status,
    relatedId: entry.relatedId
  }, {
    source: 'customer-service-history',
    severity: 'info',
    correlationId: entry.relatedId || entry.id
  });

  return entry;
}

export function updateCustomerServiceHistory(historyId, patch = {}) {
  const existing = historyRegistry.get(historyId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    type: normalizeType(patch.type || existing.type),
    status: normalizeStatus(patch.status || existing.status),
    updatedAtMs: Date.now()
  };

  historyRegistry.set(historyId, updated);
  publish(updated);

  emitEvent('customer.service_history_updated', {
    historyId,
    customerId: updated.customerId,
    type: updated.type,
    status: updated.status
  }, {
    source: 'customer-service-history',
    severity: 'info',
    correlationId: updated.relatedId || historyId
  });

  return updated;
}

export function syncCustomerServiceHistory(customerId, options = {}) {
  const created = [];

  getInvoices({ customerId, companyId: options.companyId }).forEach((invoice) => {
    const exists = getCustomerServiceHistory({ customerId }).some((entry) => entry.relatedType === 'invoice' && entry.relatedId === invoice.id);
    if (exists) return;

    created.push(addCustomerServiceHistory({
      customerId,
      customerName: invoice.customerName,
      companyId: invoice.companyId,
      companyName: invoice.companyName,
      type: 'invoice',
      relatedType: 'invoice',
      relatedId: invoice.id,
      title: `Invoice ${invoice.invoiceNumber}`,
      description: `${invoice.status} invoice for ${invoice.customerName || 'customer'}.`,
      status: invoice.status === 'paid' ? 'completed' : 'active',
      amountCents: invoice.totalCents,
      serviceDateMs: invoice.issuedAtMs,
      metadata: invoice
    }));
  });

  getRoutes().forEach((route) => {
    route.stops?.forEach((stop) => {
      const stopCustomerId = stop.metadata?.customerId || stop.customerId || '';
      if (stopCustomerId && stopCustomerId !== customerId) return;
      if (!stopCustomerId && !options.includeUnmatchedRoutes) return;

      const exists = getCustomerServiceHistory({ customerId }).some((entry) => entry.relatedType === 'route_stop' && entry.relatedId === stop.id);
      if (exists) return;

      created.push(addCustomerServiceHistory({
        customerId,
        companyId: route.companyId,
        type: 'route',
        relatedType: 'route_stop',
        relatedId: stop.id,
        title: stop.title || route.title,
        description: `Route stop handled by ${route.assignedToName || 'team member'}.`,
        status: stop.status === 'completed' ? 'completed' : 'active',
        serviceDateMs: route.updatedAtMs,
        address: stop.address,
        location: stop.location,
        metadata: { route, stop }
      }));
    });
  });

  getCustomerMessageThreads({ customerId, companyId: options.companyId }).forEach((thread) => {
    const exists = getCustomerServiceHistory({ customerId }).some((entry) => entry.relatedType === 'message_thread' && entry.relatedId === thread.id);
    if (exists) return;

    created.push(addCustomerServiceHistory({
      customerId,
      customerName: thread.customerName,
      companyId: thread.companyId,
      companyName: thread.companyName,
      type: 'message',
      relatedType: 'message_thread',
      relatedId: thread.id,
      title: thread.subject,
      description: thread.lastMessagePreview || 'Customer support conversation.',
      status: thread.status === 'resolved' || thread.status === 'closed' ? 'completed' : 'active',
      serviceDateMs: thread.lastMessageAtMs,
      metadata: thread
    }));
  });

  return created;
}

export function getCustomerServiceHistory(options = {}) {
  let rows = [...historyRegistry.values()];
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.type) rows = rows.filter((row) => row.type === normalizeType(options.type));
  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  return rows.sort((a, b) => Number(b.serviceDateMs || 0) - Number(a.serviceDateMs || 0));
}

export function summarizeCustomerServiceHistory(rows = getCustomerServiceHistory()) {
  return rows.reduce((summary, entry) => {
    summary.total += 1;
    summary.byType[entry.type] = (summary.byType[entry.type] || 0) + 1;
    summary.byStatus[entry.status] = (summary.byStatus[entry.status] || 0) + 1;
    summary.totalValueCents += Number(entry.amountCents || 0);
    if (entry.media?.length) summary.mediaEntries += 1;
    if (entry.status === 'completed') summary.completed += 1;
    return summary;
  }, {
    total: 0,
    completed: 0,
    mediaEntries: 0,
    totalValueCents: 0,
    byType: {},
    byStatus: {}
  });
}

export function subscribeCustomerServiceHistory(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeCustomerServiceHistory requires a callback.');
  const id = nextListenerId();
  historyListeners.set(id, callback);
  callback(null, getCustomerServiceHistory());
  return id;
}

export function unsubscribeCustomerServiceHistory(listenerId) {
  return historyListeners.delete(listenerId);
}

export function clearCustomerServiceHistory() {
  historyRegistry.clear();
  publish(null);
}

window.EvaraCustomerServiceHistory = {
  addCustomerServiceHistory,
  updateCustomerServiceHistory,
  syncCustomerServiceHistory,
  getCustomerServiceHistory,
  summarizeCustomerServiceHistory,
  subscribeCustomerServiceHistory,
  unsubscribeCustomerServiceHistory,
  clearCustomerServiceHistory
};
