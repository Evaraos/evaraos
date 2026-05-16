import { emitEvent } from './operations-events.js';
import { getQuotes } from './dynamic-quoting-engine.js';
import { getSubscriptions } from './subscription-lifecycle-engine.js';

const invoiceRegistry = new Map();
const invoiceListeners = new Map();

let invoiceCounter = 0;
let listenerCounter = 0;
let invoiceSweepTimer = null;

const DEFAULT_DUE_DAYS = 7;
const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000;

function nextInvoiceId() {
  invoiceCounter += 1;
  return `invoice_${Date.now()}_${invoiceCounter}`;
}

function nextInvoiceNumber() {
  return `EV-${new Date().getFullYear()}-${String(invoiceCounter + 1).padStart(6, '0')}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `invoice_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeStatus(value = 'draft') {
  const status = String(value || 'draft').trim().toLowerCase();
  return ['draft', 'sent', 'viewed', 'paid', 'partial', 'past_due', 'void', 'uncollectible'].includes(status) ? status : 'draft';
}

function publish(item = null) {
  const snapshot = getInvoices();

  invoiceListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Invoice listener failure:', error);
    }
  });
}

function calculateTotals(lineItems = [], options = {}) {
  const subtotalCents = lineItems.reduce((sum, item) => sum + cents(item.amountCents || item.totalCents), 0);
  const discountCents = cents(options.discountCents);
  const taxCents = cents(options.taxCents);
  const feeCents = cents(options.feeCents);
  const paidCents = cents(options.paidCents);
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents + feeCents);
  const balanceDueCents = Math.max(0, totalCents - paidCents);

  return {
    subtotalCents,
    discountCents,
    taxCents,
    feeCents,
    paidCents,
    totalCents,
    balanceDueCents
  };
}

function normalizeLineItem(item = {}, index = 0) {
  return {
    id: item.id || `invoice_line_${Date.now()}_${index}`,
    title: item.title || item.serviceName || item.name || 'Invoice Item',
    description: item.description || '',
    quantity: Number(item.quantity || 1),
    unitAmountCents: cents(item.unitAmountCents || item.basePriceCents || item.totalCents || item.amountCents),
    amountCents: cents(item.amountCents || item.totalCents || ((item.unitAmountCents || item.basePriceCents || 0) * Number(item.quantity || 1))),
    serviceId: item.serviceId || '',
    metadata: item.metadata || {}
  };
}

function buildInvoice(input = {}) {
  const lineItems = (input.lineItems || []).map(normalizeLineItem);
  const dueAtMs = Number(input.dueAtMs || (Date.now() + (DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000)));
  const totals = calculateTotals(lineItems, input);

  return {
    id: input.id || nextInvoiceId(),
    invoiceNumber: input.invoiceNumber || nextInvoiceNumber(),
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    customerId: input.customerId || '',
    customerName: input.customerName || '',
    customerEmail: input.customerEmail || '',
    quoteId: input.quoteId || '',
    subscriptionId: input.subscriptionId || '',
    status: normalizeStatus(input.status),
    lineItems,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    feeCents: totals.feeCents,
    paidCents: totals.paidCents,
    totalCents: totals.totalCents,
    balanceDueCents: totals.balanceDueCents,
    issuedAtMs: Number(input.issuedAtMs || Date.now()),
    dueAtMs,
    paidAtMs: input.paidAtMs || 0,
    notes: input.notes || '',
    paymentUrl: input.paymentUrl || '',
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

export function createInvoice(input = {}) {
  const invoice = buildInvoice(input);
  invoiceRegistry.set(invoice.id, invoice);
  publish(invoice);

  emitEvent('invoice.created', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    companyId: invoice.companyId,
    customerId: invoice.customerId,
    totalCents: invoice.totalCents,
    balanceDueCents: invoice.balanceDueCents,
    status: invoice.status
  }, {
    source: 'invoice-orchestration-engine',
    severity: 'info',
    correlationId: invoice.id
  });

  return invoice;
}

export function createInvoiceFromQuote(quoteId, options = {}) {
  const quote = getQuotes().find((row) => row.id === quoteId);
  if (!quote) return null;

  return createInvoice({
    companyId: quote.companyId,
    companyName: quote.companyName,
    customerId: quote.customerId,
    customerName: quote.customerName,
    quoteId: quote.id,
    status: options.status || 'draft',
    lineItems: quote.lineItems.map((item) => ({
      title: item.serviceName,
      quantity: item.quantity,
      amountCents: item.totalCents,
      serviceId: item.serviceId,
      metadata: item
    })),
    notes: options.notes || quote.notes || '',
    metadata: {
      source: 'quote',
      quote,
      ...(options.metadata || {})
    }
  });
}

export function createInvoiceFromSubscription(subscriptionId, options = {}) {
  const subscription = getSubscriptions().find((row) => row.id === subscriptionId);
  if (!subscription) return null;

  return createInvoice({
    companyId: subscription.companyId,
    companyName: subscription.companyName,
    customerId: subscription.customerId,
    customerName: subscription.customerName,
    subscriptionId: subscription.id,
    status: options.status || 'draft',
    lineItems: (subscription.lineItems || []).map((item) => ({
      title: item.serviceName || item.title || 'Subscription Service',
      quantity: item.quantity || 1,
      amountCents: item.totalCents || item.amountCents || subscription.amountCents,
      serviceId: item.serviceId || '',
      metadata: item
    })),
    notes: options.notes || 'Recurring subscription invoice',
    metadata: {
      source: 'subscription',
      subscription,
      billingCycle: Number(subscription.billingCycleCount || 0) + 1,
      ...(options.metadata || {})
    }
  });
}

export function updateInvoice(invoiceId, patch = {}) {
  const existing = invoiceRegistry.get(invoiceId);
  if (!existing) return null;

  const updated = buildInvoice({
    ...existing,
    ...patch,
    id: invoiceId,
    invoiceNumber: existing.invoiceNumber,
    createdAtMs: existing.createdAtMs,
    lineItems: patch.lineItems || existing.lineItems
  });

  invoiceRegistry.set(invoiceId, updated);
  publish(updated);

  emitEvent('invoice.updated', {
    invoiceId,
    invoiceNumber: updated.invoiceNumber,
    status: updated.status,
    totalCents: updated.totalCents,
    balanceDueCents: updated.balanceDueCents
  }, {
    source: 'invoice-orchestration-engine',
    severity: 'info',
    correlationId: invoiceId
  });

  return updated;
}

export function sendInvoice(invoiceId, options = {}) {
  return updateInvoice(invoiceId, {
    status: 'sent',
    sentAtMs: Date.now(),
    customerEmail: options.customerEmail,
    paymentUrl: options.paymentUrl
  });
}

export function markInvoiceViewed(invoiceId) {
  return updateInvoice(invoiceId, {
    status: 'viewed',
    viewedAtMs: Date.now()
  });
}

export function applyInvoicePayment(invoiceId, payment = {}) {
  const invoice = invoiceRegistry.get(invoiceId);
  if (!invoice) return null;

  const paidCents = cents(invoice.paidCents) + cents(payment.amountCents);
  const status = paidCents >= cents(invoice.totalCents) ? 'paid' : 'partial';

  return updateInvoice(invoiceId, {
    paidCents,
    status,
    paidAtMs: status === 'paid' ? Date.now() : invoice.paidAtMs,
    lastPayment: payment
  });
}

export function voidInvoice(invoiceId, reason = '') {
  return updateInvoice(invoiceId, {
    status: 'void',
    voidReason: reason,
    voidedAtMs: Date.now()
  });
}

export function runInvoicePastDueSweep(timeMs = Date.now()) {
  const pastDue = [];

  invoiceRegistry.forEach((invoice) => {
    if (['paid', 'void', 'uncollectible'].includes(invoice.status)) return;
    if (Number(invoice.dueAtMs || 0) > timeMs) return;

    pastDue.push(updateInvoice(invoice.id, {
      status: 'past_due',
      pastDueAtMs: timeMs
    }));
  });

  return pastDue.filter(Boolean);
}

export function getInvoices(options = {}) {
  let rows = [...invoiceRegistry.values()];

  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.subscriptionId) rows = rows.filter((row) => row.subscriptionId === options.subscriptionId);
  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));

  return rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function summarizeInvoices(rows = getInvoices()) {
  return rows.reduce((summary, invoice) => {
    summary.total += 1;
    summary.totalBilledCents += Number(invoice.totalCents || 0);
    summary.totalPaidCents += Number(invoice.paidCents || 0);
    summary.totalOutstandingCents += Number(invoice.balanceDueCents || 0);
    summary.byStatus[invoice.status] = (summary.byStatus[invoice.status] || 0) + 1;
    if (invoice.status === 'past_due') summary.pastDue += 1;
    if (invoice.status === 'paid') summary.paid += 1;
    return summary;
  }, {
    total: 0,
    paid: 0,
    pastDue: 0,
    totalBilledCents: 0,
    totalPaidCents: 0,
    totalOutstandingCents: 0,
    byStatus: {}
  });
}

export function subscribeInvoices(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeInvoices requires a callback.');
  const id = nextListenerId();
  invoiceListeners.set(id, callback);
  callback(null, getInvoices());
  return id;
}

export function unsubscribeInvoices(listenerId) {
  return invoiceListeners.delete(listenerId);
}

export function startInvoiceOrchestration(options = {}) {
  stopInvoiceOrchestration();
  runInvoicePastDueSweep();

  invoiceSweepTimer = window.setInterval(() => {
    runInvoicePastDueSweep();
  }, Number(options.intervalMs || DEFAULT_SWEEP_INTERVAL_MS));

  return stopInvoiceOrchestration;
}

export function stopInvoiceOrchestration() {
  if (invoiceSweepTimer) window.clearInterval(invoiceSweepTimer);
  invoiceSweepTimer = null;
}

export function clearInvoices() {
  invoiceRegistry.clear();
  publish(null);
}

window.EvaraInvoiceOrchestrationEngine = {
  createInvoice,
  createInvoiceFromQuote,
  createInvoiceFromSubscription,
  updateInvoice,
  sendInvoice,
  markInvoiceViewed,
  applyInvoicePayment,
  voidInvoice,
  runInvoicePastDueSweep,
  getInvoices,
  summarizeInvoices,
  subscribeInvoices,
  unsubscribeInvoices,
  startInvoiceOrchestration,
  stopInvoiceOrchestration,
  clearInvoices
};
