import { emitEvent } from './operations-events.js';
import { getQuotes, summarizeQuotes } from './dynamic-quoting-engine.js';
import { getSubscriptions, summarizeSubscriptions } from './subscription-lifecycle-engine.js';
import { getInvoices, summarizeInvoices } from './invoice-orchestration-engine.js';
import { getStripeSessions, summarizeStripeSessions } from './stripe-orchestration-layer.js';
import { getMarketplacePayouts, summarizeMarketplacePayouts } from './marketplace-payout-engine.js';

const analyticsListeners = new Map();
let listenerCounter = 0;
let latestSnapshot = null;
let analyticsTimer = null;

const DEFAULT_REFRESH_MS = 60 * 1000;

function nextListenerId() {
  listenerCounter += 1;
  return `revenue_analytics_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function publish(snapshot = null) {
  const current = snapshot || latestSnapshot || buildRevenueAnalytics();
  analyticsListeners.forEach((listener) => {
    try {
      listener(current);
    } catch (error) {
      console.error('Revenue analytics listener failure:', error);
    }
  });
}

function calculateRevenueRisk({ invoices, stripe, subscriptions, payouts } = {}) {
  let score = 0;
  score += Number(invoices?.pastDue || 0) * 12;
  score += Number(stripe?.failed || 0) * 10;
  score += Number(subscriptions?.pastDue || 0) * 14;
  score += Number(payouts?.failed || 0) * 16;

  const normalized = Math.min(100, Number(score.toFixed(1)));
  let level = 'stable';
  if (normalized >= 75) level = 'critical';
  else if (normalized >= 50) level = 'high';
  else if (normalized >= 25) level = 'elevated';

  return { score: normalized, level };
}

function buildRecommendations(snapshot = {}) {
  const recommendations = [];

  if (snapshot.invoiceSummary?.pastDue > 0) {
    recommendations.push('Review past-due invoices and trigger customer follow-up before outstanding balance grows.');
  }

  if (snapshot.subscriptionSummary?.pastDue > 0) {
    recommendations.push('Review past-due subscriptions and retry or update payment methods.');
  }

  if (snapshot.stripeSummary?.failed > 0) {
    recommendations.push('Investigate failed Stripe sessions and reconcile payment errors.');
  }

  if (snapshot.payoutSummary?.failed > 0) {
    recommendations.push('Review failed marketplace payouts before approving new settlement batches.');
  }

  if (snapshot.quoteSummary?.byStatus?.approved && !snapshot.invoiceSummary?.total) {
    recommendations.push('Convert approved quotes into invoices to avoid revenue leakage.');
  }

  if (!recommendations.length) {
    recommendations.push('Revenue systems appear stable. Continue monitoring quotes, invoices, subscriptions, and payouts.');
  }

  return recommendations.slice(0, 8);
}

export function buildRevenueAnalytics(options = {}) {
  const quotes = getQuotes(options);
  const subscriptions = getSubscriptions(options);
  const invoices = getInvoices(options);
  const stripeSessions = getStripeSessions(options);
  const payouts = getMarketplacePayouts(options);

  const quoteSummary = summarizeQuotes(quotes);
  const subscriptionSummary = summarizeSubscriptions(subscriptions);
  const invoiceSummary = summarizeInvoices(invoices);
  const stripeSummary = summarizeStripeSessions(stripeSessions);
  const payoutSummary = summarizeMarketplacePayouts(payouts);

  const risk = calculateRevenueRisk({
    invoices: invoiceSummary,
    stripe: stripeSummary,
    subscriptions: subscriptionSummary,
    payouts: payoutSummary
  });

  const snapshot = {
    id: `revenue_analytics_${Date.now()}`,
    generatedAtMs: Date.now(),
    risk,
    quoteSummary,
    subscriptionSummary,
    invoiceSummary,
    stripeSummary,
    payoutSummary,
    kpis: {
      quotedRevenueCents: cents(quoteSummary.totalRevenueCents),
      approvedQuoteRevenueCents: cents(quoteSummary.approvedRevenueCents),
      monthlyRecurringCents: cents(subscriptionSummary.monthlyRecurringCents),
      billedRevenueCents: cents(invoiceSummary.totalBilledCents),
      collectedRevenueCents: cents(invoiceSummary.totalPaidCents),
      outstandingRevenueCents: cents(invoiceSummary.totalOutstandingCents),
      stripePaidCents: cents(stripeSummary.paidCents),
      grossMarketplaceCents: cents(payoutSummary.grossCents),
      platformRevenueCents: cents(payoutSummary.platformCents),
      companyRevenueCents: cents(payoutSummary.companyCents),
      vendorPayoutCents: cents(Number(payoutSummary.leadVendorCents || 0) + Number(payoutSummary.serviceVendorCents || 0))
    },
    quotes,
    subscriptions,
    invoices,
    stripeSessions,
    payouts
  };

  snapshot.recommendations = buildRecommendations(snapshot);
  return snapshot;
}

export function refreshRevenueAnalytics(options = {}) {
  latestSnapshot = buildRevenueAnalytics(options);

  if (['critical', 'high'].includes(latestSnapshot.risk.level)) {
    emitEvent('revenue.risk_detected', {
      riskScore: latestSnapshot.risk.score,
      riskLevel: latestSnapshot.risk.level,
      recommendations: latestSnapshot.recommendations,
      kpis: latestSnapshot.kpis
    }, {
      source: 'revenue-analytics-engine',
      severity: latestSnapshot.risk.level === 'critical' ? 'critical' : 'warning',
      correlationId: latestSnapshot.id
    });
  }

  publish(latestSnapshot);
  return latestSnapshot;
}

export function getRevenueAnalyticsSnapshot() {
  return latestSnapshot || buildRevenueAnalytics();
}

export function subscribeRevenueAnalytics(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeRevenueAnalytics requires a callback.');
  const id = nextListenerId();
  analyticsListeners.set(id, callback);
  callback(getRevenueAnalyticsSnapshot());
  return id;
}

export function unsubscribeRevenueAnalytics(listenerId) {
  return analyticsListeners.delete(listenerId);
}

export function startRevenueAnalyticsEngine(options = {}) {
  stopRevenueAnalyticsEngine();
  refreshRevenueAnalytics(options);

  analyticsTimer = window.setInterval(() => {
    refreshRevenueAnalytics(options);
  }, Number(options.refreshMs || DEFAULT_REFRESH_MS));

  return stopRevenueAnalyticsEngine;
}

export function stopRevenueAnalyticsEngine() {
  if (analyticsTimer) window.clearInterval(analyticsTimer);
  analyticsTimer = null;
}

export function clearRevenueAnalyticsSnapshot() {
  latestSnapshot = null;
  publish(null);
}

window.EvaraRevenueAnalyticsEngine = {
  buildRevenueAnalytics,
  refreshRevenueAnalytics,
  getRevenueAnalyticsSnapshot,
  subscribeRevenueAnalytics,
  unsubscribeRevenueAnalytics,
  startRevenueAnalyticsEngine,
  stopRevenueAnalyticsEngine,
  clearRevenueAnalyticsSnapshot
};
