import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  createDashboardRuntime,
  startDashboardRuntime,
  stopDashboardRuntime,
  registerRuntimeCleanup
} from './dashboard-runtime.js';

import {
  startInvoiceOrchestration,
  stopInvoiceOrchestration
} from './invoice-orchestration-engine.js';

import {
  startSubscriptionLifecycleEngine,
  stopSubscriptionLifecycleEngine
} from './subscription-lifecycle-engine.js';

import {
  startRevenueAnalyticsEngine,
  stopRevenueAnalyticsEngine,
  subscribeRevenueAnalytics,
  unsubscribeRevenueAnalytics,
  refreshRevenueAnalytics
} from './revenue-analytics-engine.js';

import {
  loadPersistentQuotes,
  subscribePersistentQuotes,
  stopPersistentQuotesSubscription
} from './persistent-quotes-adapter.js';

import {
  loadPersistentSubscriptions,
  subscribePersistentSubscriptions,
  stopPersistentSubscriptionsSubscription
} from './persistent-subscriptions-adapter.js';

import {
  loadPersistentInvoices,
  subscribePersistentInvoices,
  stopPersistentInvoicesSubscription
} from './persistent-invoices-adapter.js';

import {
  refreshAndPersistRevenueAnalytics,
  subscribePersistentRevenueAnalytics,
  stopPersistentRevenueAnalyticsSubscription
} from './persistent-revenue-analytics-adapter.js';

import {
  loadPersistentStripeWebhookEvents,
  subscribePersistentStripeWebhookEvents
} from './stripe-webhook-persistence-adapter.js';

import {
  getFirestoreSyncHealth,
  subscribeFirestoreSyncHealth,
  unsubscribeFirestoreSyncHealth
} from './firestore-sync-health.js';

import {
  buildProductionValidationReport,
  subscribeProductionValidation,
  unsubscribeProductionValidation
} from './production-data-validation.js';

import {
  buildExecutiveTelemetryVisualModel,
  renderExecutiveTelemetryCards,
  renderExecutiveTelemetryBars
} from './executive-telemetry-visuals.js';

const statusNode = document.getElementById('financeDashboardStatus');
const riskScoreNode = document.getElementById('financeRiskScore');
const riskLevelNode = document.getElementById('financeRiskLevel');
const mrrNode = document.getElementById('financeMrr');
const billedNode = document.getElementById('financeBilled');
const collectedNode = document.getElementById('financeCollected');
const outstandingNode = document.getElementById('financeOutstanding');
const platformNode = document.getElementById('financePlatformRevenue');
const vendorNode = document.getElementById('financeVendorPayouts');
const summaryRoot = document.getElementById('financeSummaryRoot');
const recommendationRoot = document.getElementById('financeRecommendationRoot');
const invoiceRoot = document.getElementById('financeInvoiceRoot');
const payoutRoot = document.getElementById('financePayoutRoot');
const telemetryCardsRoot = document.getElementById('financeTelemetryCardsRoot');
const telemetryBarsRoot = document.getElementById('financeTelemetryBarsRoot');

const runtime = createDashboardRuntime({
  id: 'enterprise-finance-dashboard-runtime',
  name: 'Enterprise Finance Dashboard Runtime',
  metadata: { page: 'enterprise-finance-dashboard.html' }
});

let analyticsListenerId = null;
let persistentAnalyticsUnsubscribe = null;
let stripeWebhookUnsubscribe = null;
let syncHealthListenerId = null;
let validationListenerId = null;
let latestStripeEvents = [];
let latestSyncHealth = null;
let latestValidationReport = null;

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(cents = 0) {
  return '$' + (Number(cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isFinanceAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function renderStats(snapshot = {}) {
  const kpis = snapshot.kpis || {};

  if (riskScoreNode) riskScoreNode.textContent = String(snapshot.risk?.score || 0);
  if (riskLevelNode) riskLevelNode.textContent = label(snapshot.risk?.level || 'stable');
  if (mrrNode) mrrNode.textContent = money(kpis.monthlyRecurringCents);
  if (billedNode) billedNode.textContent = money(kpis.billedRevenueCents);
  if (collectedNode) collectedNode.textContent = money(kpis.collectedRevenueCents);
  if (outstandingNode) outstandingNode.textContent = money(kpis.outstandingRevenueCents);
  if (platformNode) platformNode.textContent = money(kpis.platformRevenueCents);
  if (vendorNode) vendorNode.textContent = money(kpis.vendorPayoutCents);
}

function renderVisuals(snapshot = {}) {
  const model = buildExecutiveTelemetryVisualModel({
    revenueSnapshot: snapshot,
    syncHealth: latestSyncHealth || getFirestoreSyncHealth(),
    validation: latestValidationReport || { status: 'pending', invalidCount: 0, warningCount: 0 },
    stripeEvents: latestStripeEvents || []
  });

  renderExecutiveTelemetryCards(telemetryCardsRoot, model);
  renderExecutiveTelemetryBars(telemetryBarsRoot, model);
}

function renderSummary(snapshot = {}) {
  if (!summaryRoot) return;

  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();
  const validation = latestValidationReport || { status: 'pending', invalidCount: 0, warningCount: 0 };

  const rows = [
    ['Quotes', `${snapshot.quoteSummary?.total || 0} quotes • ${money(snapshot.kpis?.quotedRevenueCents)} quoted.`],
    ['Subscriptions', `${snapshot.subscriptionSummary?.active || 0} active • ${money(snapshot.kpis?.monthlyRecurringCents)} MRR.`],
    ['Invoices', `${snapshot.invoiceSummary?.total || 0} invoices • ${money(snapshot.kpis?.outstandingRevenueCents)} outstanding.`],
    ['Stripe', `${snapshot.stripeSummary?.total || 0} sessions • ${money(snapshot.kpis?.stripePaidCents)} paid • ${latestStripeEvents.length} webhook events.`],
    ['Marketplace', `${money(snapshot.kpis?.grossMarketplaceCents)} gross • ${money(snapshot.kpis?.platformRevenueCents)} platform share.`],
    ['Sync Health', `${label(syncHealth.status || 'healthy')} • ${syncHealth.adapterCount || 0} adapters • ${syncHealth.failingAdapterCount || 0} failing.`],
    ['Validation', `${label(validation.status || 'pending')} • ${validation.invalidCount || 0} invalid • ${validation.warningCount || 0} warnings.`]
  ];

  summaryRoot.innerHTML = rows.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderRecommendations(snapshot = {}) {
  if (!recommendationRoot) return;

  const rows = [...(snapshot.recommendations || [])];
  if (latestSyncHealth?.status === 'degraded') rows.unshift('Review Firestore sync health because one or more adapters are degraded.');
  if (latestValidationReport?.status === 'failed') rows.unshift('Review production validation failures before deployment.');
  if (latestStripeEvents.some((event) => String(event.type || '').includes('failed'))) rows.unshift('Review failed Stripe webhook events and reconcile payment lifecycle states.');

  if (!rows.length) {
    recommendationRoot.innerHTML = '<div class="item muted">No finance recommendations yet.</div>';
    return;
  }

  recommendationRoot.innerHTML = rows.slice(0, 10).map((recommendation) => {
    return '<article class="item"><h3>Finance Recommendation</h3><p class="muted">' + clean(recommendation) + '</p></article>';
  }).join('');
}

function renderInvoices(snapshot = {}) {
  if (!invoiceRoot) return;

  const invoiceRows = snapshot.invoices || [];
  const stripeRows = latestStripeEvents || [];

  if (!invoiceRows.length && !stripeRows.length) {
    invoiceRoot.innerHTML = '<div class="item muted">No invoices or Stripe events yet.</div>';
    return;
  }

  const invoiceHtml = invoiceRows.slice(0, 7).map((invoice) => {
    return '<article class="item"><h3>' + clean(invoice.invoiceNumber || invoice.id) + '</h3><p class="muted">' + clean(invoice.customerName || 'Customer') + ' • ' + clean(label(invoice.status)) + '</p><div class="row"><span class="pill">Total: ' + clean(money(invoice.totalCents)) + '</span><span class="pill">Paid: ' + clean(money(invoice.paidCents)) + '</span><span class="pill">Due: ' + clean(money(invoice.balanceDueCents)) + '</span></div></article>';
  }).join('');

  const stripeHtml = stripeRows.slice(0, 3).map((event) => {
    return '<article class="item"><h3>Stripe ' + clean(label(event.type || 'event')) + '</h3><p class="muted">' + clean(event.invoiceId || event.subscriptionId || event.stripeCheckoutSessionId || event.id) + '</p><div class="row"><span class="pill">Processed: ' + clean(event.processed ? 'Yes' : 'No') + '</span><span class="pill">Live: ' + clean(event.livemode ? 'Yes' : 'No') + '</span></div></article>';
  }).join('');

  invoiceRoot.innerHTML = invoiceHtml + stripeHtml;
}

function renderPayouts(snapshot = {}) {
  if (!payoutRoot) return;

  const rows = snapshot.payouts || [];
  if (!rows.length) {
    payoutRoot.innerHTML = '<div class="item muted">No marketplace payouts yet.</div>';
    return;
  }

  payoutRoot.innerHTML = rows.slice(0, 10).map((payout) => {
    return '<article class="item"><h3>' + clean(payout.companyName || payout.companyId || 'Marketplace Payout') + '</h3><p class="muted">' + clean(label(payout.status)) + ' • Gross ' + clean(money(payout.grossCents)) + '</p><div class="row"><span class="pill">Platform: ' + clean(money(payout.platformCents)) + '</span><span class="pill">Company: ' + clean(money(payout.companyCents)) + '</span><span class="pill">Vendor: ' + clean(money(Number(payout.leadVendorCents || 0) + Number(payout.serviceVendorCents || 0))) + '</span></div></article>';
  }).join('');
}

function buildValidationFromSnapshot(snapshot = {}) {
  return buildProductionValidationReport({
    quotes: snapshot.quotes || [],
    subscriptions: snapshot.subscriptions || [],
    invoices: snapshot.invoices || [],
    stripe_sessions: snapshot.stripeSessions || [],
    marketplace_payouts: snapshot.payouts || [],
    revenue_analytics: [snapshot].filter(Boolean),
    stripe_webhook_events: latestStripeEvents || []
  });
}

function renderFinanceDashboard(snapshot = {}) {
  latestValidationReport = buildValidationFromSnapshot(snapshot);
  renderStats(snapshot);
  renderVisuals(snapshot);
  renderSummary(snapshot);
  renderRecommendations(snapshot);
  renderInvoices(snapshot);
  renderPayouts(snapshot);
  status('Enterprise finance dashboard synced with persistent production data.');
}

async function hydratePersistentFinanceData() {
  await Promise.allSettled([
    loadPersistentQuotes(),
    loadPersistentSubscriptions(),
    loadPersistentInvoices(),
    loadPersistentStripeWebhookEvents().then((events) => { latestStripeEvents = events || []; })
  ]);

  const snapshot = await refreshAndPersistRevenueAnalytics();
  renderFinanceDashboard(snapshot);
}

async function startEnterpriseFinanceDashboard() {
  stopEnterpriseFinanceDashboard();

  await hydratePersistentFinanceData();

  await startDashboardRuntime(runtime.id, [
    { label: 'Start invoice orchestration', run() { startInvoiceOrchestration(); return stopInvoiceOrchestration; } },
    { label: 'Start subscription lifecycle', run() { startSubscriptionLifecycleEngine(); return stopSubscriptionLifecycleEngine; } },
    { label: 'Start revenue analytics', run() { startRevenueAnalyticsEngine(); return stopRevenueAnalyticsEngine; } },
    {
      label: 'Subscribe finance dashboard renderer',
      run() {
        analyticsListenerId = subscribeRevenueAnalytics((snapshot) => renderFinanceDashboard(snapshot));
        return () => { if (analyticsListenerId) unsubscribeRevenueAnalytics(analyticsListenerId); analyticsListenerId = null; };
      }
    },
    {
      label: 'Subscribe persistent finance adapters',
      run() {
        subscribePersistentQuotes({}, () => renderFinanceDashboard(refreshRevenueAnalytics()));
        subscribePersistentSubscriptions({}, () => renderFinanceDashboard(refreshRevenueAnalytics()));
        subscribePersistentInvoices({}, () => renderFinanceDashboard(refreshRevenueAnalytics()));
        return () => { stopPersistentQuotesSubscription(); stopPersistentSubscriptionsSubscription(); stopPersistentInvoicesSubscription(); };
      }
    },
    {
      label: 'Subscribe persistent analytics snapshots',
      run() {
        persistentAnalyticsUnsubscribe = subscribePersistentRevenueAnalytics({}, () => renderFinanceDashboard(refreshRevenueAnalytics()));
        return () => { if (persistentAnalyticsUnsubscribe) persistentAnalyticsUnsubscribe(); persistentAnalyticsUnsubscribe = null; stopPersistentRevenueAnalyticsSubscription(); };
      }
    },
    {
      label: 'Subscribe Stripe webhook events',
      run() {
        stripeWebhookUnsubscribe = subscribePersistentStripeWebhookEvents({}, (events = []) => { latestStripeEvents = events || []; renderFinanceDashboard(refreshRevenueAnalytics()); });
        return () => { if (stripeWebhookUnsubscribe) stripeWebhookUnsubscribe(); stripeWebhookUnsubscribe = null; };
      }
    },
    {
      label: 'Subscribe sync health telemetry',
      run() {
        syncHealthListenerId = subscribeFirestoreSyncHealth((health) => { latestSyncHealth = health; renderFinanceDashboard(refreshRevenueAnalytics()); });
        return () => { if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId); syncHealthListenerId = null; };
      }
    },
    {
      label: 'Subscribe production validation telemetry',
      run() {
        validationListenerId = subscribeProductionValidation((report) => { latestValidationReport = report || latestValidationReport; renderVisuals(refreshRevenueAnalytics()); renderSummary(refreshRevenueAnalytics()); });
        return () => { if (validationListenerId) unsubscribeProductionValidation(validationListenerId); validationListenerId = null; };
      }
    }
  ]);

  renderFinanceDashboard(refreshRevenueAnalytics());
}

function stopEnterpriseFinanceDashboard() {
  if (analyticsListenerId) unsubscribeRevenueAnalytics(analyticsListenerId);
  if (persistentAnalyticsUnsubscribe) persistentAnalyticsUnsubscribe();
  if (stripeWebhookUnsubscribe) stripeWebhookUnsubscribe();
  if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
  if (validationListenerId) unsubscribeProductionValidation(validationListenerId);

  analyticsListenerId = null;
  persistentAnalyticsUnsubscribe = null;
  stripeWebhookUnsubscribe = null;
  syncHealthListenerId = null;
  validationListenerId = null;

  stopPersistentQuotesSubscription();
  stopPersistentSubscriptionsSubscription();
  stopPersistentInvoicesSubscription();
  stopPersistentRevenueAnalyticsSubscription();
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopEnterpriseFinanceDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopEnterpriseFinanceDashboard);
  window.addEventListener('pagehide', stopEnterpriseFinanceDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopEnterpriseFinanceDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isFinanceAdmin()) {
      status('Enterprise finance dashboard requires leadership permissions.');
      if (summaryRoot) summaryRoot.innerHTML = '<div class="item muted">You do not have access to enterprise finance tools.</div>';
      return;
    }

    startEnterpriseFinanceDashboard().catch((error) => {
      console.error(error);
      status('Enterprise finance dashboard failed to start.');
    });
  });
}

window.EvaraEnterpriseFinanceDashboard = {
  startEnterpriseFinanceDashboard,
  stopEnterpriseFinanceDashboard,
  renderFinanceDashboard
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
