import { emitEvent } from './operations-events.js';
import { calculateServiceEstimate, getServiceCatalog } from './service-catalog-engine.js';

const quoteRegistry = new Map();
const quoteListeners = new Map();

let quoteCounter = 0;
let listenerCounter = 0;

function nextQuoteId() {
  quoteCounter += 1;
  return `quote_${Date.now()}_${quoteCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `quote_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeStatus(value = 'draft') {
  const status = String(value || 'draft').trim().toLowerCase();
  return ['draft', 'pending', 'approved', 'expired', 'rejected'].includes(status)
    ? status
    : 'draft';
}

function publish(item = null) {
  const snapshot = getQuotes();

  quoteListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Quote listener failure:', error);
    }
  });
}

function applyRecurringDiscount(subtotal, options = {}) {
  if (!options.subscription) return 0;

  const quantity = Number(options.quantity || 1);

  if (quantity >= 10) return Math.round(subtotal * 0.2);
  if (quantity >= 6) return Math.round(subtotal * 0.1);
  if (quantity >= 3) return Math.round(subtotal * 0.05);

  return 0;
}

function applyTerritoryFee(options = {}) {
  if (!options.territoryFeeCents) return 0;
  return cents(options.territoryFeeCents);
}

function applyLaborModifier(subtotal, options = {}) {
  const modifier = Number(options.laborMultiplier || 1);
  if (modifier <= 1) return 0;
  return Math.round(subtotal * (modifier - 1));
}

function buildLineItem(serviceId, options = {}) {
  const estimate = calculateServiceEstimate(serviceId, options.quantity || 1, {
    addOns: options.addOns || []
  });

  if (!estimate) return null;

  const recurringDiscount = applyRecurringDiscount(estimate.subtotalCents, options);
  const territoryFee = applyTerritoryFee(options);
  const laborModifier = applyLaborModifier(estimate.subtotalCents, options);

  const total = Math.max(
    0,
    estimate.subtotalCents - recurringDiscount + territoryFee + laborModifier
  );

  return {
    serviceId,
    serviceName: estimate.serviceName,
    pricingType: estimate.pricingType,
    quantity: estimate.quantity,
    subtotalCents: estimate.subtotalCents,
    recurringDiscountCents: recurringDiscount,
    territoryFeeCents: territoryFee,
    laborModifierCents: laborModifier,
    totalCents: total,
    estimatedDurationMinutes: estimate.estimatedDurationMinutes,
    requiresQuote: estimate.requiresQuote,
    metadata: options.metadata || {}
  };
}

export function createQuote(input = {}) {
  const lineItems = (input.lineItems || [])
    .map((item) => buildLineItem(item.serviceId, item))
    .filter(Boolean);

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.subtotalCents, 0);
  const discountCents = lineItems.reduce((sum, item) => sum + item.recurringDiscountCents, 0);
  const territoryFeesCents = lineItems.reduce((sum, item) => sum + item.territoryFeeCents, 0);
  const laborModifiersCents = lineItems.reduce((sum, item) => sum + item.laborModifierCents, 0);
  const totalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);

  const quote = {
    id: input.id || nextQuoteId(),
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    customerId: input.customerId || '',
    customerName: input.customerName || '',
    territoryId: input.territoryId || '',
    status: normalizeStatus(input.status),
    lineItems,
    subtotalCents,
    discountCents,
    territoryFeesCents,
    laborModifiersCents,
    totalCents,
    notes: input.notes || '',
    expiresAtMs: input.expiresAtMs || (Date.now() + (7 * 24 * 60 * 60 * 1000)),
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };

  quoteRegistry.set(quote.id, quote);
  publish(quote);

  emitEvent('quote.created', {
    quoteId: quote.id,
    companyId: quote.companyId,
    customerId: quote.customerId,
    totalCents: quote.totalCents,
    lineItemCount: quote.lineItems.length,
    status: quote.status
  }, {
    source: 'dynamic-quoting-engine',
    severity: 'info',
    correlationId: quote.id
  });

  return quote;
}

export function updateQuote(quoteId, patch = {}) {
  const existing = quoteRegistry.get(quoteId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    status: normalizeStatus(patch.status || existing.status),
    updatedAtMs: Date.now()
  };

  quoteRegistry.set(quoteId, updated);
  publish(updated);

  emitEvent('quote.updated', {
    quoteId,
    status: updated.status,
    totalCents: updated.totalCents
  }, {
    source: 'dynamic-quoting-engine',
    severity: 'info',
    correlationId: quoteId
  });

  return updated;
}

export function approveQuote(quoteId) {
  return updateQuote(quoteId, { status: 'approved', approvedAtMs: Date.now() });
}

export function rejectQuote(quoteId) {
  return updateQuote(quoteId, { status: 'rejected', rejectedAtMs: Date.now() });
}

export function expireQuotes() {
  const expired = [];

  quoteRegistry.forEach((quote) => {
    if (quote.status !== 'expired' && Number(quote.expiresAtMs || 0) <= Date.now()) {
      expired.push(updateQuote(quote.id, { status: 'expired' }));
    }
  });

  return expired.filter(Boolean);
}

export function createQuickQuoteFromCatalog(options = {}) {
  const catalog = getServiceCatalog({
    companyId: options.companyId,
    status: 'active'
  });

  const lineItems = catalog.services.slice(0, Number(options.limit || 3)).map((service) => ({
    serviceId: service.id,
    quantity: options.quantity || 1,
    subscription: Boolean(options.subscription)
  }));

  return createQuote({
    companyId: options.companyId,
    companyName: options.companyName,
    customerId: options.customerId,
    customerName: options.customerName,
    territoryId: options.territoryId,
    lineItems,
    metadata: {
      source: 'quick_quote_builder'
    }
  });
}

export function getQuotes(options = {}) {
  let rows = [...quoteRegistry.values()];

  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));

  return rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function summarizeQuotes(rows = getQuotes()) {
  return rows.reduce((summary, quote) => {
    summary.total += 1;
    summary.totalRevenueCents += Number(quote.totalCents || 0);
    summary.byStatus[quote.status] = (summary.byStatus[quote.status] || 0) + 1;

    if (quote.status === 'approved') summary.approvedRevenueCents += Number(quote.totalCents || 0);

    return summary;
  }, {
    total: 0,
    totalRevenueCents: 0,
    approvedRevenueCents: 0,
    byStatus: {}
  });
}

export function subscribeQuotes(callback) {
  if (typeof callback !== 'function') {
    throw new Error('subscribeQuotes requires a callback.');
  }

  const id = nextListenerId();
  quoteListeners.set(id, callback);
  callback(null, getQuotes());
  return id;
}

export function unsubscribeQuotes(listenerId) {
  return quoteListeners.delete(listenerId);
}

export function clearQuotes() {
  quoteRegistry.clear();
  publish(null);
}

window.EvaraDynamicQuotingEngine = {
  createQuote,
  updateQuote,
  approveQuote,
  rejectQuote,
  expireQuotes,
  createQuickQuoteFromCatalog,
  getQuotes,
  summarizeQuotes,
  subscribeQuotes,
  unsubscribeQuotes,
  clearQuotes
};
