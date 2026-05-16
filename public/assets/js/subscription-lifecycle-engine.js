import { emitEvent } from './operations-events.js';
import { getQuotes } from './dynamic-quoting-engine.js';

const subscriptionRegistry = new Map();
const subscriptionListeners = new Map();

let subscriptionCounter = 0;
let listenerCounter = 0;
let lifecycleTimer = null;

const DEFAULT_LIFECYCLE_INTERVAL_MS = 60 * 1000;

function nextSubscriptionId() {
  subscriptionCounter += 1;
  return `subscription_${Date.now()}_${subscriptionCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `subscription_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'active') {
  const status = String(value || 'active').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'past_due', 'cancelled', 'completed', 'expired'].includes(status) ? status : 'active';
}

function normalizeInterval(value = 'monthly') {
  const interval = String(value || 'monthly').trim().toLowerCase();
  return ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(interval) ? interval : 'monthly';
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function addMonths(ms, months = 1) {
  const date = new Date(Number(ms || Date.now()));
  date.setMonth(date.getMonth() + Number(months || 1));
  return date.getTime();
}

function intervalToMonths(interval = 'monthly') {
  if (interval === 'quarterly') return 3;
  if (interval === 'yearly') return 12;
  return 1;
}

function intervalToDays(interval = 'monthly') {
  if (interval === 'weekly') return 7;
  if (interval === 'biweekly') return 14;
  return 30;
}

function nextBillingDate(startAtMs, interval = 'monthly') {
  const normalized = normalizeInterval(interval);
  if (['monthly', 'quarterly', 'yearly'].includes(normalized)) {
    return addMonths(startAtMs, intervalToMonths(normalized));
  }
  return Number(startAtMs || Date.now()) + (intervalToDays(normalized) * 24 * 60 * 60 * 1000);
}

function publish(item = null) {
  const snapshot = getSubscriptions();
  subscriptionListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Subscription listener failure:', error);
    }
  });
}

function buildSubscription(input = {}) {
  const startAtMs = Number(input.startAtMs || Date.now());
  const interval = normalizeInterval(input.interval || input.subscriptionInterval || 'monthly');
  const termMonths = Number(input.termMonths || input.subscriptionTermMonths || 12);

  return {
    id: input.id || nextSubscriptionId(),
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    customerId: input.customerId || '',
    customerName: input.customerName || '',
    quoteId: input.quoteId || '',
    status: normalizeStatus(input.status || 'active'),
    interval,
    termMonths,
    startAtMs,
    endAtMs: input.endAtMs || addMonths(startAtMs, termMonths),
    nextBillingAtMs: input.nextBillingAtMs || nextBillingDate(startAtMs, interval),
    amountCents: cents(input.amountCents),
    lineItems: Array.isArray(input.lineItems) ? input.lineItems : [],
    billingCycleCount: Number(input.billingCycleCount || 0),
    paidCycleCount: Number(input.paidCycleCount || 0),
    failedPaymentCount: Number(input.failedPaymentCount || 0),
    pauseReason: input.pauseReason || '',
    cancelReason: input.cancelReason || '',
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

export function createSubscription(input = {}) {
  const subscription = buildSubscription(input);
  subscriptionRegistry.set(subscription.id, subscription);
  publish(subscription);

  emitEvent('subscription.created', {
    subscriptionId: subscription.id,
    companyId: subscription.companyId,
    customerId: subscription.customerId,
    quoteId: subscription.quoteId,
    amountCents: subscription.amountCents,
    interval: subscription.interval,
    status: subscription.status
  }, {
    source: 'subscription-lifecycle-engine',
    severity: 'info',
    correlationId: subscription.id
  });

  return subscription;
}

export function createSubscriptionFromQuote(quoteId, options = {}) {
  const quote = getQuotes().find((row) => row.id === quoteId);
  if (!quote) return null;

  return createSubscription({
    companyId: quote.companyId,
    companyName: quote.companyName,
    customerId: quote.customerId,
    customerName: quote.customerName,
    quoteId: quote.id,
    amountCents: quote.totalCents,
    lineItems: quote.lineItems,
    interval: options.interval || 'monthly',
    termMonths: options.termMonths || 12,
    metadata: {
      source: 'approved_quote',
      quote
    }
  });
}

export function updateSubscription(subscriptionId, patch = {}) {
  const existing = subscriptionRegistry.get(subscriptionId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    status: normalizeStatus(patch.status || existing.status),
    interval: normalizeInterval(patch.interval || existing.interval),
    amountCents: cents(patch.amountCents ?? existing.amountCents),
    updatedAtMs: Date.now()
  };

  subscriptionRegistry.set(subscriptionId, updated);
  publish(updated);

  emitEvent('subscription.updated', {
    subscriptionId,
    status: updated.status,
    amountCents: updated.amountCents,
    nextBillingAtMs: updated.nextBillingAtMs
  }, {
    source: 'subscription-lifecycle-engine',
    severity: 'info',
    correlationId: subscriptionId
  });

  return updated;
}

export function pauseSubscription(subscriptionId, reason = '') {
  return updateSubscription(subscriptionId, {
    status: 'paused',
    pauseReason: reason,
    pausedAtMs: Date.now()
  });
}

export function resumeSubscription(subscriptionId) {
  const existing = subscriptionRegistry.get(subscriptionId);
  if (!existing) return null;

  return updateSubscription(subscriptionId, {
    status: 'active',
    pauseReason: '',
    resumedAtMs: Date.now(),
    nextBillingAtMs: existing.nextBillingAtMs && existing.nextBillingAtMs > Date.now()
      ? existing.nextBillingAtMs
      : nextBillingDate(Date.now(), existing.interval)
  });
}

export function cancelSubscription(subscriptionId, reason = '') {
  return updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancelReason: reason,
    cancelledAtMs: Date.now()
  });
}

export function markSubscriptionPaid(subscriptionId, payment = {}) {
  const existing = subscriptionRegistry.get(subscriptionId);
  if (!existing) return null;

  return updateSubscription(subscriptionId, {
    status: 'active',
    paidCycleCount: Number(existing.paidCycleCount || 0) + 1,
    billingCycleCount: Number(existing.billingCycleCount || 0) + 1,
    failedPaymentCount: 0,
    lastPaidAtMs: Date.now(),
    lastPayment: payment,
    nextBillingAtMs: nextBillingDate(Date.now(), existing.interval)
  });
}

export function markSubscriptionPastDue(subscriptionId, payment = {}) {
  const existing = subscriptionRegistry.get(subscriptionId);
  if (!existing) return null;

  return updateSubscription(subscriptionId, {
    status: 'past_due',
    failedPaymentCount: Number(existing.failedPaymentCount || 0) + 1,
    lastFailedPaymentAtMs: Date.now(),
    lastFailedPayment: payment
  });
}

export function runSubscriptionLifecycleSweep(timeMs = Date.now()) {
  const actions = [];

  subscriptionRegistry.forEach((subscription) => {
    if (subscription.status === 'active' && Number(subscription.endAtMs || 0) <= timeMs) {
      actions.push(updateSubscription(subscription.id, { status: 'completed', completedAtMs: timeMs }));
      return;
    }

    if (subscription.status === 'active' && Number(subscription.nextBillingAtMs || 0) <= timeMs) {
      emitEvent('subscription.billing_due', {
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        customerId: subscription.customerId,
        amountCents: subscription.amountCents,
        nextBillingAtMs: subscription.nextBillingAtMs
      }, {
        source: 'subscription-lifecycle-engine',
        severity: 'info',
        correlationId: subscription.id
      });

      actions.push(subscription);
    }
  });

  return actions.filter(Boolean);
}

export function getSubscriptions(options = {}) {
  let rows = [...subscriptionRegistry.values()];

  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.customerId) rows = rows.filter((row) => row.customerId === options.customerId);
  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));

  return rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function summarizeSubscriptions(rows = getSubscriptions()) {
  return rows.reduce((summary, subscription) => {
    summary.total += 1;
    summary.monthlyRecurringCents += subscription.status === 'active' ? Number(subscription.amountCents || 0) : 0;
    summary.byStatus[subscription.status] = (summary.byStatus[subscription.status] || 0) + 1;
    summary.byInterval[subscription.interval] = (summary.byInterval[subscription.interval] || 0) + 1;
    if (subscription.status === 'active') summary.active += 1;
    if (subscription.status === 'past_due') summary.pastDue += 1;
    return summary;
  }, {
    total: 0,
    active: 0,
    pastDue: 0,
    monthlyRecurringCents: 0,
    byStatus: {},
    byInterval: {}
  });
}

export function subscribeSubscriptions(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeSubscriptions requires a callback.');
  const id = nextListenerId();
  subscriptionListeners.set(id, callback);
  callback(null, getSubscriptions());
  return id;
}

export function unsubscribeSubscriptions(listenerId) {
  return subscriptionListeners.delete(listenerId);
}

export function startSubscriptionLifecycleEngine(options = {}) {
  stopSubscriptionLifecycleEngine();

  lifecycleTimer = window.setInterval(() => {
    runSubscriptionLifecycleSweep();
  }, Number(options.intervalMs || DEFAULT_LIFECYCLE_INTERVAL_MS));

  runSubscriptionLifecycleSweep();
  return stopSubscriptionLifecycleEngine;
}

export function stopSubscriptionLifecycleEngine() {
  if (lifecycleTimer) window.clearInterval(lifecycleTimer);
  lifecycleTimer = null;
}

export function clearSubscriptions() {
  subscriptionRegistry.clear();
  publish(null);
}

window.EvaraSubscriptionLifecycleEngine = {
  createSubscription,
  createSubscriptionFromQuote,
  updateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  markSubscriptionPaid,
  markSubscriptionPastDue,
  runSubscriptionLifecycleSweep,
  getSubscriptions,
  summarizeSubscriptions,
  subscribeSubscriptions,
  unsubscribeSubscriptions,
  startSubscriptionLifecycleEngine,
  stopSubscriptionLifecycleEngine,
  clearSubscriptions
};
