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
  getFirestoreSyncHealth,
  subscribeFirestoreSyncHealth,
  unsubscribeFirestoreSyncHealth
} from './firestore-sync-health.js';

import {
  getLatestProductionValidationReport,
  subscribeProductionValidation,
  unsubscribeProductionValidation
} from './production-data-validation.js';

import {
  loadPersistentRevenueAnalytics,
  subscribePersistentRevenueAnalytics,
  stopPersistentRevenueAnalyticsSubscription,
  getLatestPersistentRevenueAnalyticsSnapshot
} from './persistent-revenue-analytics-adapter.js';

import {
  loadPersistentStripeWebhookEvents,
  subscribePersistentStripeWebhookEvents
} from './stripe-webhook-persistence-adapter.js';

const statusNode = document.getElementById('operationsVisibilityStatus');
const healthNode = document.getElementById('operationsHealthStatus');
const adaptersNode = document.getElementById('operationsAdapterCount');
const failingNode = document.getElementById('operationsFailingAdapters');
const validationNode = document.getElementById('operationsValidationStatus');
const telemetryRoot = document.getElementById('operationsTelemetryRoot');
const validationRoot = document.getElementById('operationsValidationRoot');
const analyticsRoot = document.getElementById('operationsAnalyticsRoot');
const stripeRoot = document.getElementById('operationsStripeRoot');

const runtime = createDashboardRuntime({
  id: 'operations-visibility-dashboard-runtime',
  name: 'Operations Visibility Dashboard Runtime',
  metadata: { page: 'operations-visibility.html' }
});

let syncHealthListenerId = null;
let validationListenerId = null;
let analyticsUnsubscribe = null;
let stripeUnsubscribe = null;
let latestSyncHealth = null;
let latestValidation = null;
let latestAnalytics = [];
let latestStripeEvents = [];

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

function isOperationsAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'operations_coordinator'].includes(role);
}

function renderStats() {
  const health = latestSyncHealth || getFirestoreSyncHealth();
  const validation = latestValidation || getLatestProductionValidationReport() || { status: 'pending' };

  if (healthNode) healthNode.textContent = label(health.status || 'healthy');
  if (adaptersNode) adaptersNode.textContent = String(health.adapterCount || 0);
  if (failingNode) failingNode.textContent = String(health.failingAdapterCount || 0);
  if (validationNode) validationNode.textContent = label(validation.status || 'pending');
}

function renderTelemetry() {
  if (!telemetryRoot) return;
  const health = latestSyncHealth || getFirestoreSyncHealth();
  const rows = health.adapters || [];

  if (!rows.length) {
    telemetryRoot.innerHTML = '<div class="item muted">No adapter telemetry has reported yet.</div>';
    return;
  }

  telemetryRoot.innerHTML = rows.map((adapter) => {
    return '<article class="item"><h3>' + clean(adapter.adapterName || 'Adapter') + '</h3><p class="muted">' + clean(adapter.collectionName || 'Collection pending') + '</p><div class="row"><span class="pill">Ready: ' + clean(adapter.ready ? 'Yes' : 'No') + '</span><span class="pill">Last Sync: ' + clean(adapter.lastSyncAtMs ? new Date(adapter.lastSyncAtMs).toLocaleString() : 'Pending') + '</span></div>' + (adapter.lastError ? '<p class="muted">Error: ' + clean(adapter.lastError.message) + '</p>' : '') + '</article>';
  }).join('');
}

function renderValidation() {
  if (!validationRoot) return;
  const report = latestValidation || getLatestProductionValidationReport();

  if (!report) {
    validationRoot.innerHTML = '<div class="item muted">No validation report generated yet.</div>';
    return;
  }

  validationRoot.innerHTML = (report.collections || []).map((collection) => {
    return '<article class="item"><h3>' + clean(collection.collectionName) + '</h3><p class="muted">' + clean(label(collection.valid ? 'passed' : 'failed')) + ' • ' + clean(String(collection.total || 0)) + ' records checked.</p><div class="row"><span class="pill">Invalid: ' + clean(String(collection.invalidCount || 0)) + '</span><span class="pill">Warnings: ' + clean(String(collection.warningCount || 0)) + '</span></div></article>';
  }).join('') || '<div class="item muted">Validation report has no collections yet.</div>';
}

function renderAnalytics() {
  if (!analyticsRoot) return;
  const rows = latestAnalytics.length ? latestAnalytics : [getLatestPersistentRevenueAnalyticsSnapshot()].filter(Boolean);

  if (!rows.length) {
    analyticsRoot.innerHTML = '<div class="item muted">No persistent analytics snapshots yet.</div>';
    return;
  }

  analyticsRoot.innerHTML = rows.slice(0, 8).map((snapshot) => {
    const kpis = snapshot.kpis || {};
    const risk = snapshot.risk || {};
    return '<article class="item"><h3>' + clean(snapshot.id || 'Revenue Snapshot') + '</h3><p class="muted">Risk: ' + clean(label(risk.level || 'stable')) + ' • Score ' + clean(String(risk.score || 0)) + '</p><div class="row"><span class="pill">MRR: ' + clean(money(kpis.monthlyRecurringCents)) + '</span><span class="pill">Collected: ' + clean(money(kpis.collectedRevenueCents)) + '</span><span class="pill">Outstanding: ' + clean(money(kpis.outstandingRevenueCents)) + '</span></div></article>';
  }).join('');
}

function renderStripe() {
  if (!stripeRoot) return;

  if (!latestStripeEvents.length) {
    stripeRoot.innerHTML = '<div class="item muted">No Stripe webhook events persisted yet.</div>';
    return;
  }

  stripeRoot.innerHTML = latestStripeEvents.slice(0, 10).map((event) => {
    return '<article class="item"><h3>' + clean(label(event.type || 'stripe event')) + '</h3><p class="muted">' + clean(event.id || '') + '</p><div class="row"><span class="pill">Processed: ' + clean(event.processed ? 'Yes' : 'No') + '</span><span class="pill">Invoice: ' + clean(event.invoiceId || 'None') + '</span><span class="pill">Subscription: ' + clean(event.subscriptionId || 'None') + '</span></div></article>';
  }).join('');
}

function renderOperationsVisibility() {
  renderStats();
  renderTelemetry();
  renderValidation();
  renderAnalytics();
  renderStripe();
  const health = latestSyncHealth || getFirestoreSyncHealth();
  status(`Operations visibility synced • ${label(health.status || 'healthy')}`);
}

async function hydrateOperationsVisibility() {
  await Promise.allSettled([
    loadPersistentRevenueAnalytics().then((rows) => { latestAnalytics = rows || []; }),
    loadPersistentStripeWebhookEvents().then((rows) => { latestStripeEvents = rows || []; })
  ]);

  latestSyncHealth = getFirestoreSyncHealth();
  latestValidation = getLatestProductionValidationReport();
  renderOperationsVisibility();
}

async function startOperationsVisibilityDashboard() {
  stopOperationsVisibilityDashboard();
  await hydrateOperationsVisibility();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Subscribe sync health telemetry',
      run() {
        syncHealthListenerId = subscribeFirestoreSyncHealth((health) => {
          latestSyncHealth = health;
          renderOperationsVisibility();
        });
        return () => {
          if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
          syncHealthListenerId = null;
        };
      }
    },
    {
      label: 'Subscribe validation telemetry',
      run() {
        validationListenerId = subscribeProductionValidation((report) => {
          latestValidation = report || latestValidation;
          renderOperationsVisibility();
        });
        return () => {
          if (validationListenerId) unsubscribeProductionValidation(validationListenerId);
          validationListenerId = null;
        };
      }
    },
    {
      label: 'Subscribe analytics snapshots',
      run() {
        analyticsUnsubscribe = subscribePersistentRevenueAnalytics({}, (rows = []) => {
          latestAnalytics = rows || [];
          renderOperationsVisibility();
        });
        return () => {
          if (analyticsUnsubscribe) analyticsUnsubscribe();
          analyticsUnsubscribe = null;
          stopPersistentRevenueAnalyticsSubscription();
        };
      }
    },
    {
      label: 'Subscribe Stripe webhook telemetry',
      run() {
        stripeUnsubscribe = subscribePersistentStripeWebhookEvents({}, (rows = []) => {
          latestStripeEvents = rows || [];
          renderOperationsVisibility();
        });
        return () => {
          if (stripeUnsubscribe) stripeUnsubscribe();
          stripeUnsubscribe = null;
        };
      }
    }
  ]);

  renderOperationsVisibility();
}

function stopOperationsVisibilityDashboard() {
  if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
  if (validationListenerId) unsubscribeProductionValidation(validationListenerId);
  if (analyticsUnsubscribe) analyticsUnsubscribe();
  if (stripeUnsubscribe) stripeUnsubscribe();

  syncHealthListenerId = null;
  validationListenerId = null;
  analyticsUnsubscribe = null;
  stripeUnsubscribe = null;

  stopPersistentRevenueAnalyticsSubscription();
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopOperationsVisibilityDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopOperationsVisibilityDashboard);
  window.addEventListener('pagehide', stopOperationsVisibilityDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopOperationsVisibilityDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isOperationsAdmin()) {
      status('Operations visibility requires leadership permissions.');
      if (telemetryRoot) telemetryRoot.innerHTML = '<div class="item muted">You do not have access to operations visibility tools.</div>';
      return;
    }

    startOperationsVisibilityDashboard().catch((error) => {
      console.error(error);
      status('Operations visibility failed to start.');
    });
  });
}

window.EvaraOperationsVisibilityDashboard = {
  startOperationsVisibilityDashboard,
  stopOperationsVisibilityDashboard,
  renderOperationsVisibility
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
