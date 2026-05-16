import { emitEvent } from './operations-events.js';
import { getInvoices, updateInvoice } from './invoice-orchestration-engine.js';
import { getSubscriptions } from './subscription-lifecycle-engine.js';

const stripeSessionRegistry = new Map();
const stripeListeners = new Map();

let sessionCounter = 0;
let listenerCounter = 0;

function nextSessionId() {
  sessionCounter += 1;
  return `stripe_session_${Date.now()}_${sessionCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `stripe_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeMode(value = 'payment') {
  const mode = String(value || 'payment').trim().toLowerCase();
  return ['payment', 'subscription', 'setup'].includes(mode) ? mode : 'payment';
}

function normalizeStatus(value = 'pending') {
  const status = String(value || 'pending').trim().toLowerCase();
  return ['pending', 'created', 'requires_action', 'paid', 'failed', 'cancelled', 'expired'].includes(status) ? status : 'pending';
}

function publish(item = null) {
  const snapshot = getStripeSessions();
  stripeListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Stripe orchestration listener failure:', error);
    }
  });
}

function buildStripeSession(input = {}) {
  return {
    id: input.id || nextSessionId(),
    mode: normalizeMode(input.mode),
    status: normalizeStatus(input.status),
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    customerId: input.customerId || '',
    customerName: input.customerName || '',
    customerEmail: input.customerEmail || '',
    invoiceId: input.invoiceId || '',
    subscriptionId: input.subscriptionId || '',
    amountCents: cents(input.amountCents),
    currency: String(input.currency || 'usd').toLowerCase(),
    lineItems: Array.isArray(input.lineItems) ? input.lineItems : [],
    successUrl: input.successUrl || './dashboard.html',
    cancelUrl: input.cancelUrl || './dashboard.html',
    checkoutUrl: input.checkoutUrl || '',
    providerSessionId: input.providerSessionId || '',
    providerPaymentIntentId: input.providerPaymentIntentId || '',
    providerSubscriptionId: input.providerSubscriptionId || '',
    metadata: input.metadata || {},
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now()
  };
}

export function prepareStripeCheckoutSession(input = {}) {
  const session = buildStripeSession(input);
  stripeSessionRegistry.set(session.id, session);
  publish(session);

  emitEvent('stripe.checkout_prepared', {
    stripeSessionId: session.id,
    mode: session.mode,
    companyId: session.companyId,
    customerId: session.customerId,
    invoiceId: session.invoiceId,
    subscriptionId: session.subscriptionId,
    amountCents: session.amountCents,
    currency: session.currency
  }, {
    source: 'stripe-orchestration-layer',
    severity: 'info',
    correlationId: session.invoiceId || session.subscriptionId || session.id
  });

  return session;
}

export function prepareInvoicePaymentSession(invoiceId, options = {}) {
  const invoice = getInvoices().find((row) => row.id === invoiceId);
  if (!invoice) return null;

  return prepareStripeCheckoutSession({
    mode: 'payment',
    invoiceId: invoice.id,
    companyId: invoice.companyId,
    companyName: invoice.companyName,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    amountCents: invoice.balanceDueCents || invoice.totalCents,
    currency: options.currency || 'usd',
    lineItems: invoice.lineItems,
    successUrl: options.successUrl || './dashboard.html?payment=success',
    cancelUrl: options.cancelUrl || './dashboard.html?payment=cancelled',
    metadata: {
      source: 'invoice_payment',
      invoiceNumber: invoice.invoiceNumber,
      ...(options.metadata || {})
    }
  });
}

export function prepareSubscriptionCheckoutSession(subscriptionId, options = {}) {
  const subscription = getSubscriptions().find((row) => row.id === subscriptionId);
  if (!subscription) return null;

  return prepareStripeCheckoutSession({
    mode: 'subscription',
    subscriptionId: subscription.id,
    companyId: subscription.companyId,
    companyName: subscription.companyName,
    customerId: subscription.customerId,
    customerName: subscription.customerName,
    amountCents: subscription.amountCents,
    currency: options.currency || 'usd',
    lineItems: subscription.lineItems,
    successUrl: options.successUrl || './dashboard.html?subscription=success',
    cancelUrl: options.cancelUrl || './dashboard.html?subscription=cancelled',
    metadata: {
      source: 'subscription_checkout',
      interval: subscription.interval,
      termMonths: subscription.termMonths,
      ...(options.metadata || {})
    }
  });
}

export function attachStripeProviderSession(sessionId, provider = {}) {
  const existing = stripeSessionRegistry.get(sessionId);
  if (!existing) return null;

  const updated = {
    ...existing,
    status: normalizeStatus(provider.status || 'created'),
    checkoutUrl: provider.checkoutUrl || existing.checkoutUrl,
    providerSessionId: provider.providerSessionId || provider.id || existing.providerSessionId,
    providerPaymentIntentId: provider.providerPaymentIntentId || existing.providerPaymentIntentId,
    providerSubscriptionId: provider.providerSubscriptionId || existing.providerSubscriptionId,
    providerPayload: provider,
    updatedAtMs: Date.now()
  };

  stripeSessionRegistry.set(sessionId, updated);
  publish(updated);

  emitEvent('stripe.checkout_created', {
    stripeSessionId: updated.id,
    providerSessionId: updated.providerSessionId,
    invoiceId: updated.invoiceId,
    subscriptionId: updated.subscriptionId,
    checkoutUrl: updated.checkoutUrl ? 'available' : 'missing'
  }, {
    source: 'stripe-orchestration-layer',
    severity: 'success',
    correlationId: updated.invoiceId || updated.subscriptionId || updated.id
  });

  return updated;
}

export function markStripeSessionPaid(sessionId, payment = {}) {
  const existing = stripeSessionRegistry.get(sessionId);
  if (!existing) return null;

  const updated = {
    ...existing,
    status: 'paid',
    paidAtMs: Date.now(),
    providerPaymentIntentId: payment.providerPaymentIntentId || payment.paymentIntentId || existing.providerPaymentIntentId,
    providerSubscriptionId: payment.providerSubscriptionId || existing.providerSubscriptionId,
    paymentPayload: payment,
    updatedAtMs: Date.now()
  };

  stripeSessionRegistry.set(sessionId, updated);
  publish(updated);

  if (updated.invoiceId) {
    updateInvoice(updated.invoiceId, {
      paidCents: updated.amountCents,
      status: 'paid',
      paidAtMs: Date.now(),
      lastPayment: {
        provider: 'stripe',
        stripeSessionId: updated.id,
        ...payment
      }
    });
  }

  emitEvent('stripe.payment_succeeded', {
    stripeSessionId: updated.id,
    invoiceId: updated.invoiceId,
    subscriptionId: updated.subscriptionId,
    amountCents: updated.amountCents
  }, {
    source: 'stripe-orchestration-layer',
    severity: 'success',
    correlationId: updated.invoiceId || updated.subscriptionId || updated.id
  });

  return updated;
}

export function markStripeSessionFailed(sessionId, failure = {}) {
  const existing = stripeSessionRegistry.get(sessionId);
  if (!existing) return null;

  const updated = {
    ...existing,
    status: 'failed',
    failedAtMs: Date.now(),
    failure,
    updatedAtMs: Date.now()
  };

  stripeSessionRegistry.set(sessionId, updated);
  publish(updated);

  emitEvent('stripe.payment_failed', {
    stripeSessionId: updated.id,
    invoiceId: updated.invoiceId,
    subscriptionId: updated.subscriptionId,
    reason: failure.reason || failure.message || 'payment_failed'
  }, {
    source: 'stripe-orchestration-layer',
    severity: 'warning',
    correlationId: updated.invoiceId || updated.subscriptionId || updated.id
  });

  return updated;
}

export function getStripeSessions(options = {}) {
  let rows = [...stripeSessionRegistry.values()];

  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.mode) rows = rows.filter((row) => row.mode === normalizeMode(options.mode));
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.invoiceId) rows = rows.filter((row) => row.invoiceId === options.invoiceId);
  if (options.subscriptionId) rows = rows.filter((row) => row.subscriptionId === options.subscriptionId);

  return rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function summarizeStripeSessions(rows = getStripeSessions()) {
  return rows.reduce((summary, session) => {
    summary.total += 1;
    summary.byStatus[session.status] = (summary.byStatus[session.status] || 0) + 1;
    summary.byMode[session.mode] = (summary.byMode[session.mode] || 0) + 1;
    if (session.status === 'paid') summary.paidCents += Number(session.amountCents || 0);
    if (session.status === 'failed') summary.failed += 1;
    return summary;
  }, {
    total: 0,
    failed: 0,
    paidCents: 0,
    byStatus: {},
    byMode: {}
  });
}

export function subscribeStripeSessions(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeStripeSessions requires a callback.');
  const id = nextListenerId();
  stripeListeners.set(id, callback);
  callback(null, getStripeSessions());
  return id;
}

export function unsubscribeStripeSessions(listenerId) {
  return stripeListeners.delete(listenerId);
}

export function clearStripeSessions() {
  stripeSessionRegistry.clear();
  publish(null);
}

window.EvaraStripeOrchestrationLayer = {
  prepareStripeCheckoutSession,
  prepareInvoicePaymentSession,
  prepareSubscriptionCheckoutSession,
  attachStripeProviderSession,
  markStripeSessionPaid,
  markStripeSessionFailed,
  getStripeSessions,
  summarizeStripeSessions,
  subscribeStripeSessions,
  unsubscribeStripeSessions,
  clearStripeSessions
};
