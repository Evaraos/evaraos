import { createCollectionAdapter } from './firestore-collection-adapter.js';
import { emitEvent } from './operations-events.js';

const jobsAdapter = createCollectionAdapter('jobs');
const ACTIVE_ORDER_STATUSES = new Set([
  'scheduled',
  'claimed',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'failed'
]);

function cleanId(value = '') {
  return String(value || '')
    .trim()
    .replaceAll('/', '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 180);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveScheduledAtMs(quote = {}, options = {}) {
  const candidates = [
    options.scheduledAtMs,
    options.scheduledAt,
    quote.scheduledAtMs,
    quote.scheduledAt,
    quote.scheduledFor,
    quote.scheduleDate,
    quote.requestedScheduleAtMs,
    quote.requestedScheduleAt,
    quote.metadata?.scheduledAtMs,
    quote.metadata?.scheduledAt
  ];

  for (const candidate of candidates) {
    const value = timestampMs(candidate);
    if (value > 0) return value;
  }

  return 0;
}

function resolveAddress(quote = {}, options = {}) {
  return String(
    options.serviceAddress ||
    quote.serviceAddress ||
    quote.customerAddress ||
    quote.address ||
    quote.metadata?.serviceAddress ||
    quote.metadata?.address ||
    ''
  ).trim();
}

function resolveCoordinates(quote = {}, options = {}) {
  const lat = finiteNumber(
    options.lat ??
    options.latitude ??
    quote.lat ??
    quote.latitude ??
    quote.location?.lat ??
    quote.metadata?.lat ??
    quote.metadata?.latitude
  );
  const lng = finiteNumber(
    options.lng ??
    options.longitude ??
    quote.lng ??
    quote.longitude ??
    quote.location?.lng ??
    quote.metadata?.lng ??
    quote.metadata?.longitude
  );

  return { lat, lng };
}

function serviceSummary(quote = {}) {
  const items = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  const names = items
    .map((item) => String(item.serviceName || item.name || '').trim())
    .filter(Boolean);

  return {
    names,
    service: names[0] || quote.serviceName || quote.service || 'Marketplace service',
    serviceIds: items.map((item) => item.serviceId).filter(Boolean)
  };
}

function validateApprovedQuote(quote = {}) {
  if (!quote.id) throw new Error('A quote ID is required before an order can be created.');
  if (String(quote.status || '').toLowerCase() !== 'approved') {
    throw new Error('Only approved quotes can be converted into marketplace orders.');
  }
  if (!quote.customerId && !quote.customerUid) {
    throw new Error('The approved quote is missing a customer ID.');
  }
  if (!quote.companyId) {
    throw new Error('The approved quote is missing a service company ID.');
  }
  if (!Array.isArray(quote.lineItems) || !quote.lineItems.length) {
    throw new Error('The approved quote has no service line items.');
  }
}

export function marketplaceOrderIdForQuote(quoteId = '') {
  const normalized = cleanId(quoteId);
  if (!normalized) throw new Error('A valid quote ID is required.');
  return `order_${normalized}`;
}

export function buildMarketplaceOrderFromQuote(quote = {}, options = {}, existing = null) {
  validateApprovedQuote(quote);

  const now = Date.now();
  const orderId = marketplaceOrderIdForQuote(quote.id);
  const scheduledAtMs = resolveScheduledAtMs(quote, options);
  const scheduleStatus = scheduledAtMs ? 'scheduled' : 'needs_scheduling';
  const proposedStatus = scheduledAtMs ? 'scheduled' : 'dispatch_review';
  const existingStatus = String(existing?.status || '').toLowerCase();
  const status = ACTIVE_ORDER_STATUSES.has(existingStatus) ? existingStatus : proposedStatus;
  const address = resolveAddress(quote, options);
  const coordinates = resolveCoordinates(quote, options);
  const services = serviceSummary(quote);
  const scheduledIso = scheduledAtMs ? new Date(scheduledAtMs).toISOString() : '';

  return {
    ...(existing || {}),
    id: orderId,
    orderId,
    quoteId: quote.id,
    sourceQuoteId: quote.id,
    source: 'approved_marketplace_quote',
    marketplaceLifecycleVersion: 1,
    companyId: quote.companyId,
    companyName: quote.companyName || '',
    vendorCompanyId: quote.companyId,
    vendorCompanyName: quote.companyName || '',
    customerId: quote.customerId || quote.customerUid || '',
    customerUid: quote.customerUid || quote.customerId || '',
    customerName: quote.customerName || '',
    customerEmail: quote.customerEmail || quote.metadata?.customerEmail || '',
    customerPhone: quote.customerPhone || quote.metadata?.customerPhone || '',
    service: services.service,
    serviceType: services.service,
    serviceName: services.service,
    serviceNames: services.names,
    serviceIds: services.serviceIds,
    lineItems: quote.lineItems,
    subtotalCents: Number(quote.subtotalCents || 0),
    discountCents: Number(quote.discountCents || 0),
    totalCents: Number(quote.totalCents || 0),
    quotedTotalCents: Number(quote.totalCents || 0),
    currency: quote.currency || 'usd',
    paymentStatus: existing?.paymentStatus || 'pending',
    status,
    scheduleStatus,
    scheduledAtMs,
    scheduledAt: scheduledIso,
    scheduledFor: scheduledIso,
    scheduleDate: scheduledIso,
    serviceAddress: address,
    customerAddress: address,
    address,
    lat: coordinates.lat,
    lng: coordinates.lng,
    priority: options.priority || quote.priority || quote.metadata?.priority || 'normal',
    notes: options.notes || quote.notes || '',
    requestedAtMs: Number(existing?.requestedAtMs || quote.approvedAtMs || now),
    approvedQuoteAtMs: Number(quote.approvedAtMs || now),
    createdAtMs: Number(existing?.createdAtMs || now),
    updatedAtMs: now,
    orderConversionStatus: 'converted',
    orderConversionAtMs: Number(existing?.orderConversionAtMs || now),
    metadata: {
      ...(quote.metadata || {}),
      ...(existing?.metadata || {}),
      ...(options.metadata || {}),
      quoteId: quote.id
    }
  };
}

export async function createOrderFromApprovedQuote(quote = {}, options = {}) {
  const orderId = marketplaceOrderIdForQuote(quote.id);
  const existing = await jobsAdapter.get(orderId);
  const order = buildMarketplaceOrderFromQuote(quote, options, existing);

  await jobsAdapter.set(orderId, order, { merge: true });

  emitEvent(existing ? 'marketplace.order_reconciled' : 'marketplace.order_created', {
    orderId,
    quoteId: quote.id,
    companyId: order.companyId,
    customerId: order.customerId,
    totalCents: order.totalCents,
    status: order.status,
    scheduleStatus: order.scheduleStatus
  }, {
    source: 'marketplace-order-engine',
    severity: 'success',
    correlationId: orderId
  });

  return order;
}

window.EvaraMarketplaceOrderEngine = {
  marketplaceOrderIdForQuote,
  buildMarketplaceOrderFromQuote,
  createOrderFromApprovedQuote
};
