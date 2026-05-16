import { emitEvent } from './operations-events.js';
import { getQuotes } from './dynamic-quoting-engine.js';
import { getSubscriptions } from './subscription-lifecycle-engine.js';
import { getInvoices } from './invoice-orchestration-engine.js';
import { getStripeSessions } from './stripe-orchestration-layer.js';

const portalListeners = new Map();
let listenerCounter = 0;
let latestSnapshots = new Map();

function nextListenerId() {
  listenerCounter += 1;
  return `customer_portal_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function publish(customerId = '', snapshot = null) {
  const current = snapshot || getCustomerCommerceSnapshot(customerId);

  portalListeners.forEach((listener) => {
    try {
      listener(current);
    } catch (error) {
      console.error('Customer commerce portal listener failure:', error);
    }
  });
}

function summarizeCustomerFinance({ quotes = [], subscriptions = [], invoices = [], stripeSessions = [] } = {}) {
  const outstandingCents = invoices.reduce((sum, invoice) => sum + cents(invoice.balanceDueCents), 0);
  const paidCents = invoices.reduce((sum, invoice) => sum + cents(invoice.paidCents), 0);
  const quotedCents = quotes.reduce((sum, quote) => sum + cents(quote.totalCents), 0);
  const activeSubscriptionCents = subscriptions
    .filter((subscription) => subscription.status === 'active')
    .reduce((sum, subscription) => sum + cents(subscription.amountCents), 0);

  return {
    quoteCount: quotes.length,
    activeSubscriptions: subscriptions.filter((subscription) => subscription.status === 'active').length,
    invoiceCount: invoices.length,
    openInvoices: invoices.filter((invoice) => !['paid', 'void', 'uncollectible'].includes(invoice.status)).length,
    paymentSessionCount: stripeSessions.length,
    quotedCents,
    activeSubscriptionCents,
    outstandingCents,
    paidCents
  };
}

function buildCustomerActions(snapshot = {}) {
  const actions = [];
  const openInvoices = snapshot.invoices.filter((invoice) => !['paid', 'void', 'uncollectible'].includes(invoice.status));
  const pendingQuotes = snapshot.quotes.filter((quote) => ['draft', 'pending'].includes(quote.status));
  const pastDueInvoices = snapshot.invoices.filter((invoice) => invoice.status === 'past_due');
  const pastDueSubscriptions = snapshot.subscriptions.filter((subscription) => subscription.status === 'past_due');

  if (pastDueInvoices.length) {
    actions.push({
      type: 'pay_past_due_invoice',
      title: 'Past-due invoice needs payment',
      detail: `${pastDueInvoices.length} invoice(s) are past due.`,
      priority: 'high'
    });
  }

  if (openInvoices.length) {
    actions.push({
      type: 'pay_invoice',
      title: 'Pay open invoice',
      detail: `${openInvoices.length} open invoice(s) are ready for payment.`,
      priority: 'medium'
    });
  }

  if (pendingQuotes.length) {
    actions.push({
      type: 'review_quote',
      title: 'Review quote',
      detail: `${pendingQuotes.length} quote(s) are waiting for review.`,
      priority: 'medium'
    });
  }

  if (pastDueSubscriptions.length) {
    actions.push({
      type: 'update_subscription_payment',
      title: 'Update subscription payment',
      detail: `${pastDueSubscriptions.length} subscription(s) need payment attention.`,
      priority: 'high'
    });
  }

  if (!actions.length) {
    actions.push({
      type: 'portal_stable',
      title: 'Account is current',
      detail: 'No urgent commerce actions are needed right now.',
      priority: 'low'
    });
  }

  return actions;
}

export function buildCustomerCommerceSnapshot(customerId, options = {}) {
  if (!customerId) throw new Error('Customer commerce snapshot requires customerId.');

  const quotes = getQuotes({ customerId, companyId: options.companyId });
  const subscriptions = getSubscriptions({ customerId, companyId: options.companyId });
  const invoices = getInvoices({ customerId, companyId: options.companyId });
  const stripeSessions = getStripeSessions({ customerId, companyId: options.companyId });

  const snapshot = {
    id: `customer_commerce_${customerId}_${Date.now()}`,
    customerId,
    companyId: options.companyId || '',
    generatedAtMs: Date.now(),
    quotes,
    subscriptions,
    invoices,
    stripeSessions,
    summary: summarizeCustomerFinance({ quotes, subscriptions, invoices, stripeSessions })
  };

  snapshot.actions = buildCustomerActions(snapshot);
  return snapshot;
}

export function refreshCustomerCommerceSnapshot(customerId, options = {}) {
  const snapshot = buildCustomerCommerceSnapshot(customerId, options);
  latestSnapshots.set(customerId, snapshot);

  const urgent = snapshot.actions.filter((action) => action.priority === 'high');
  if (urgent.length) {
    emitEvent('customer.portal_attention_required', {
      customerId,
      companyId: snapshot.companyId,
      urgentCount: urgent.length,
      actions: urgent
    }, {
      source: 'customer-commerce-portal-engine',
      severity: 'warning',
      correlationId: customerId
    });
  }

  publish(customerId, snapshot);
  return snapshot;
}

export function getCustomerCommerceSnapshot(customerId, options = {}) {
  if (latestSnapshots.has(customerId) && !options.forceRefresh) return latestSnapshots.get(customerId);
  return buildCustomerCommerceSnapshot(customerId, options);
}

export function getCustomerPortalPaymentOptions(customerId, options = {}) {
  const snapshot = getCustomerCommerceSnapshot(customerId, options);

  return snapshot.invoices
    .filter((invoice) => !['paid', 'void', 'uncollectible'].includes(invoice.status))
    .map((invoice) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountDueCents: invoice.balanceDueCents,
      status: invoice.status,
      dueAtMs: invoice.dueAtMs,
      paymentUrl: invoice.paymentUrl || ''
    }));
}

export function getCustomerPortalSubscriptionOptions(customerId, options = {}) {
  const snapshot = getCustomerCommerceSnapshot(customerId, options);

  return snapshot.subscriptions.map((subscription) => ({
    subscriptionId: subscription.id,
    status: subscription.status,
    amountCents: subscription.amountCents,
    interval: subscription.interval,
    nextBillingAtMs: subscription.nextBillingAtMs,
    canPause: subscription.status === 'active',
    canResume: subscription.status === 'paused',
    canCancel: ['active', 'paused', 'past_due'].includes(subscription.status)
  }));
}

export function subscribeCustomerCommercePortal(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeCustomerCommercePortal requires a callback.');
  const id = nextListenerId();
  portalListeners.set(id, callback);
  return id;
}

export function unsubscribeCustomerCommercePortal(listenerId) {
  return portalListeners.delete(listenerId);
}

export function clearCustomerCommerceSnapshots() {
  latestSnapshots.clear();
  publish('');
}

window.EvaraCustomerCommercePortalEngine = {
  buildCustomerCommerceSnapshot,
  refreshCustomerCommerceSnapshot,
  getCustomerCommerceSnapshot,
  getCustomerPortalPaymentOptions,
  getCustomerPortalSubscriptionOptions,
  subscribeCustomerCommercePortal,
  unsubscribeCustomerCommercePortal,
  clearCustomerCommerceSnapshots
};
