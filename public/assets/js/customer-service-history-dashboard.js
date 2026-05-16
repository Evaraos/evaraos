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
  getCustomerServiceHistory,
  summarizeCustomerServiceHistory,
  subscribeCustomerServiceHistory,
  unsubscribeCustomerServiceHistory
} from './customer-service-history.js';

import {
  syncPersistentCustomerServiceHistory,
  loadCustomerPersistentServiceHistory,
  loadCompanyPersistentServiceHistory,
  subscribeCustomerPersistentServiceHistory,
  subscribeCompanyPersistentServiceHistory,
  stopPersistentCustomerServiceHistorySubscription
} from './persistent-customer-service-history-adapter.js';

import {
  loadCustomerNotifications,
  subscribeCustomerNotifications,
  summarizeCustomerNotifications,
  stopPersistentCustomerNotificationsSubscription
} from './persistent-customer-notifications-adapter.js';

import {
  getFirestoreSyncHealth,
  subscribeFirestoreSyncHealth,
  unsubscribeFirestoreSyncHealth
} from './firestore-sync-health.js';

const statusNode = document.getElementById('customerHistoryStatus');
const totalNode = document.getElementById('customerHistoryTotal');
const completedNode = document.getElementById('customerHistoryCompleted');
const mediaNode = document.getElementById('customerHistoryMedia');
const valueNode = document.getElementById('customerHistoryValue');
const timelineRoot = document.getElementById('customerHistoryTimelineRoot');
const summaryRoot = document.getElementById('customerHistorySummaryRoot');

const runtime = createDashboardRuntime({
  id: 'customer-service-history-dashboard-runtime',
  name: 'Customer Service History Dashboard Runtime',
  metadata: { page: 'customer-service-history.html' }
});

let listenerId = null;
let persistentHistoryUnsubscribe = null;
let notificationUnsubscribe = null;
let syncHealthListenerId = null;
let activeCustomerId = '';
let activeCompanyId = '';
let latestNotifications = [];
let latestSyncHealth = null;

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

function profile() {
  return getSavedUserProfile() || {};
}

function currentRole() {
  return String(profile().role || 'customer').toLowerCase();
}

function isTeamRole() {
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'operations_coordinator', 'staff', 'technician', 'cleaner', 'sales_rep'].includes(currentRole());
}

function resolveCustomerId() {
  const saved = profile();
  return isTeamRole() ? (saved.activeCustomerId || '') : (saved.uid || saved.id || auth.currentUser?.uid || '');
}

function resolveCompanyId() {
  const saved = profile();
  return saved.companyId || '';
}

function visibleHistory() {
  if (!activeCustomerId && isTeamRole()) return getCustomerServiceHistory(activeCompanyId ? { companyId: activeCompanyId } : {});
  return getCustomerServiceHistory({ customerId: activeCustomerId });
}

function renderStats(rows = visibleHistory()) {
  const summary = summarizeCustomerServiceHistory(rows);
  if (totalNode) totalNode.textContent = String(summary.total || 0);
  if (completedNode) completedNode.textContent = String(summary.completed || 0);
  if (mediaNode) mediaNode.textContent = String(summary.mediaEntries || 0);
  if (valueNode) valueNode.textContent = money(summary.totalValueCents);
}

function renderSummary(rows = visibleHistory()) {
  if (!summaryRoot) return;
  const summary = summarizeCustomerServiceHistory(rows);
  const notificationSummary = summarizeCustomerNotifications(latestNotifications);
  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();

  const items = [
    ['History Entries', `${summary.total || 0} total timeline entries.`],
    ['Completed Services', `${summary.completed || 0} completed activity records.`],
    ['Media Evidence', `${summary.mediaEntries || 0} entries include before/after media.`],
    ['Recorded Value', `${money(summary.totalValueCents)} tracked across this customer history.`],
    ['Notifications', `${notificationSummary.unread || 0} unread • ${notificationSummary.urgent || 0} urgent.`],
    ['Sync Health', `${label(syncHealth.status || 'healthy')} • ${syncHealth.adapterCount || 0} adapters.`]
  ];

  summaryRoot.innerHTML = items.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderTimeline(rows = visibleHistory()) {
  if (!timelineRoot) return;

  renderStats(rows);
  renderSummary(rows);

  if (!rows.length) {
    timelineRoot.innerHTML = '<div class="item muted">No service history yet.</div>';
    return;
  }

  timelineRoot.innerHTML = rows.slice(0, 50).map((entry) => {
    const mediaCount = Array.isArray(entry.media) ? entry.media.length : 0;
    return '<article class="item"><h3>' + clean(entry.title) + '</h3><p class="muted">' + clean(new Date(entry.serviceDateMs).toLocaleString()) + ' • ' + clean(label(entry.type)) + ' • ' + clean(label(entry.status)) + '</p><p>' + clean(entry.description || 'No description added.') + '</p><div class="row"><span class="pill">Value: ' + clean(money(entry.amountCents)) + '</span><span class="pill">Media: ' + clean(String(mediaCount)) + '</span><span class="pill">' + clean(entry.relatedType || 'history') + '</span></div></article>';
  }).join('');

  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();
  status(`Customer service history synced • ${label(syncHealth.status || 'healthy')}`);
}

async function hydratePersistentHistory() {
  if (activeCustomerId) {
    await syncPersistentCustomerServiceHistory(activeCustomerId, { companyId: activeCompanyId }).catch(console.warn);
    await loadCustomerPersistentServiceHistory(activeCustomerId).catch(console.warn);
    await loadCustomerNotifications(activeCustomerId).then((rows) => { latestNotifications = rows || []; }).catch(console.warn);
    return;
  }

  if (isTeamRole() && activeCompanyId) {
    await loadCompanyPersistentServiceHistory(activeCompanyId).catch(console.warn);
  }
}

async function startCustomerServiceHistoryDashboard() {
  stopCustomerServiceHistoryDashboard();
  activeCustomerId = resolveCustomerId();
  activeCompanyId = resolveCompanyId();

  await hydratePersistentHistory();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Subscribe customer service history renderer',
      run() {
        listenerId = subscribeCustomerServiceHistory(() => {
          renderTimeline();
        });

        return () => {
          if (listenerId) unsubscribeCustomerServiceHistory(listenerId);
          listenerId = null;
        };
      }
    },
    {
      label: 'Subscribe persistent customer service history',
      run() {
        persistentHistoryUnsubscribe = activeCustomerId
          ? subscribeCustomerPersistentServiceHistory(activeCustomerId, () => renderTimeline())
          : activeCompanyId
            ? subscribeCompanyPersistentServiceHistory(activeCompanyId, () => renderTimeline())
            : null;

        return () => {
          if (persistentHistoryUnsubscribe) persistentHistoryUnsubscribe();
          persistentHistoryUnsubscribe = null;
          stopPersistentCustomerServiceHistorySubscription();
        };
      }
    },
    {
      label: 'Subscribe customer history notifications',
      run() {
        if (!activeCustomerId) return () => {};
        notificationUnsubscribe = subscribeCustomerNotifications(activeCustomerId, (rows = []) => {
          latestNotifications = rows || [];
          renderTimeline();
        });

        return () => {
          if (notificationUnsubscribe) notificationUnsubscribe();
          notificationUnsubscribe = null;
          stopPersistentCustomerNotificationsSubscription();
        };
      }
    },
    {
      label: 'Subscribe service history sync health',
      run() {
        syncHealthListenerId = subscribeFirestoreSyncHealth((health) => {
          latestSyncHealth = health;
          renderTimeline();
        });
        return () => {
          if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
          syncHealthListenerId = null;
        };
      }
    }
  ]);

  renderTimeline();
}

function stopCustomerServiceHistoryDashboard() {
  if (listenerId) unsubscribeCustomerServiceHistory(listenerId);
  if (persistentHistoryUnsubscribe) persistentHistoryUnsubscribe();
  if (notificationUnsubscribe) notificationUnsubscribe();
  if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);

  listenerId = null;
  persistentHistoryUnsubscribe = null;
  notificationUnsubscribe = null;
  syncHealthListenerId = null;

  stopPersistentCustomerServiceHistorySubscription();
  stopPersistentCustomerNotificationsSubscription();
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopCustomerServiceHistoryDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopCustomerServiceHistoryDashboard);
  window.addEventListener('pagehide', stopCustomerServiceHistoryDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopCustomerServiceHistoryDashboard();
      window.location.assign('/login.html');
      return;
    }

    startCustomerServiceHistoryDashboard().catch((error) => {
      console.error(error);
      status('Customer service history failed to start.');
    });
  });
}

window.EvaraCustomerServiceHistoryDashboard = {
  startCustomerServiceHistoryDashboard,
  stopCustomerServiceHistoryDashboard,
  renderTimeline
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
