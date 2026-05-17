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
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  getFirestoreSyncHealth,
  subscribeFirestoreSyncHealth,
  unsubscribeFirestoreSyncHealth
} from './firestore-sync-health.js';

const statusNode = document.getElementById('marketplacePayoutStatus');
const grossNode = document.getElementById('marketplacePayoutGross');
const platformNode = document.getElementById('marketplacePayoutPlatform');
const companyNode = document.getElementById('marketplacePayoutCompany');
const vendorNode = document.getElementById('marketplacePayoutVendors');
const pendingNode = document.getElementById('marketplacePayoutPending');
const paidNode = document.getElementById('marketplacePayoutPaid');
const summaryRoot = document.getElementById('marketplacePayoutSummaryRoot');
const payoutRoot = document.getElementById('marketplacePayoutRoot');
const splitRoot = document.getElementById('marketplaceSplitRoot');

const payoutAdapter = createCollectionAdapter(EvaraCollections.MARKETPLACE_PAYOUTS);
const runtime = createDashboardRuntime({
  id: 'marketplace-payout-dashboard-runtime',
  name: 'Marketplace Payout Dashboard Runtime',
  metadata: { page: 'marketplace-payouts.html' }
});

let payoutUnsubscribe = null;
let syncHealthListenerId = null;
let payouts = [];
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

function isFinanceAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function summarize(rows = payouts) {
  return rows.reduce((summary, payout) => {
    summary.total += 1;
    summary.grossCents += Number(payout.grossCents || 0);
    summary.platformCents += Number(payout.platformCents || 0);
    summary.companyCents += Number(payout.companyCents || 0);
    summary.vendorCents += Number(payout.leadVendorCents || 0) + Number(payout.serviceVendorCents || 0);
    summary.pending += ['pending', 'processing', 'ready'].includes(String(payout.status || '').toLowerCase()) ? 1 : 0;
    summary.paid += ['paid', 'settled', 'completed'].includes(String(payout.status || '').toLowerCase()) ? 1 : 0;
    summary.byStatus[payout.status || 'unknown'] = (summary.byStatus[payout.status || 'unknown'] || 0) + 1;
    return summary;
  }, {
    total: 0,
    grossCents: 0,
    platformCents: 0,
    companyCents: 0,
    vendorCents: 0,
    pending: 0,
    paid: 0,
    byStatus: {}
  });
}

function renderStats() {
  const summary = summarize();
  if (grossNode) grossNode.textContent = money(summary.grossCents);
  if (platformNode) platformNode.textContent = money(summary.platformCents);
  if (companyNode) companyNode.textContent = money(summary.companyCents);
  if (vendorNode) vendorNode.textContent = money(summary.vendorCents);
  if (pendingNode) pendingNode.textContent = String(summary.pending);
  if (paidNode) paidNode.textContent = String(summary.paid);
}

function renderSummary() {
  if (!summaryRoot) return;
  const summary = summarize();
  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();
  const rows = [
    ['Total Payouts', `${summary.total} marketplace payout records.`],
    ['Gross Volume', `${money(summary.grossCents)} total gross marketplace volume.`],
    ['Platform Share', `${money(summary.platformCents)} retained by Evaraos.`],
    ['Company Share', `${money(summary.companyCents)} allocated to companies / LLCs.`],
    ['Vendor Share', `${money(summary.vendorCents)} allocated to lead and service vendors.`],
    ['Sync Health', `${label(syncHealth.status || 'healthy')} • ${syncHealth.failingAdapterCount || 0} failing adapters.`]
  ];

  summaryRoot.innerHTML = rows.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderPayouts() {
  if (!payoutRoot) return;
  if (!payouts.length) {
    payoutRoot.innerHTML = '<div class="item muted">No marketplace payouts yet.</div>';
    return;
  }

  payoutRoot.innerHTML = payouts.slice(0, 50).map((payout) => {
    return '<article class="item"><h3>' + clean(payout.companyName || payout.companyId || 'Marketplace Payout') + '</h3><p class="muted">' + clean(label(payout.status || 'pending')) + ' • ' + clean(payout.payoutId || payout.id || '') + '</p><div class="row"><span class="pill">Gross: ' + clean(money(payout.grossCents)) + '</span><span class="pill">Platform: ' + clean(money(payout.platformCents)) + '</span><span class="pill">Company: ' + clean(money(payout.companyCents)) + '</span></div></article>';
  }).join('');
}

function renderSplits() {
  if (!splitRoot) return;
  if (!payouts.length) {
    splitRoot.innerHTML = '<div class="item muted">No split intelligence yet.</div>';
    return;
  }

  splitRoot.innerHTML = payouts.slice(0, 30).map((payout) => {
    const gross = Number(payout.grossCents || 0) || 1;
    const leadPct = Math.round((Number(payout.leadVendorCents || 0) / gross) * 100);
    const servicePct = Math.round((Number(payout.serviceVendorCents || 0) / gross) * 100);
    const platformPct = Math.round((Number(payout.platformCents || 0) / gross) * 100);
    const companyPct = Math.round((Number(payout.companyCents || 0) / gross) * 100);

    return '<article class="item"><h3>' + clean(payout.companyName || payout.companyId || 'Split Model') + '</h3><p class="muted">Marketplace settlement split</p><div class="row"><span class="pill">Lead: ' + clean(money(payout.leadVendorCents)) + ' / ' + leadPct + '%</span><span class="pill">Service: ' + clean(money(payout.serviceVendorCents)) + ' / ' + servicePct + '%</span></div><div class="row"><span class="pill">Platform: ' + clean(money(payout.platformCents)) + ' / ' + platformPct + '%</span><span class="pill">Company: ' + clean(money(payout.companyCents)) + ' / ' + companyPct + '%</span></div></article>';
  }).join('');
}

function renderMarketplacePayoutDashboard() {
  renderStats();
  renderSummary();
  renderPayouts();
  renderSplits();
  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();
  status(`Marketplace payout dashboard synced • ${label(syncHealth.status || 'healthy')}`);
}

async function hydrateMarketplacePayouts() {
  payouts = await payoutAdapter.list({ orderBy: [['updatedAtMs', 'desc']], limit: 100 }).catch(() => []);
  renderMarketplacePayoutDashboard();
}

async function startMarketplacePayoutDashboard() {
  stopMarketplacePayoutDashboard();
  await hydrateMarketplacePayouts();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Subscribe marketplace payouts',
      run() {
        payoutUnsubscribe = payoutAdapter.subscribe({ orderBy: [['updatedAtMs', 'desc']], limit: 100 }, (rows = []) => {
          payouts = rows || [];
          renderMarketplacePayoutDashboard();
        });
        return () => {
          if (payoutUnsubscribe) payoutUnsubscribe();
          payoutUnsubscribe = null;
        };
      }
    },
    {
      label: 'Subscribe payout sync health',
      run() {
        syncHealthListenerId = subscribeFirestoreSyncHealth((health) => {
          latestSyncHealth = health;
          renderMarketplacePayoutDashboard();
        });
        return () => {
          if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
          syncHealthListenerId = null;
        };
      }
    }
  ]);
}

function stopMarketplacePayoutDashboard() {
  if (payoutUnsubscribe) payoutUnsubscribe();
  if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
  payoutUnsubscribe = null;
  syncHealthListenerId = null;
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopMarketplacePayoutDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopMarketplacePayoutDashboard);
  window.addEventListener('pagehide', stopMarketplacePayoutDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopMarketplacePayoutDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isFinanceAdmin()) {
      status('Marketplace payout dashboard requires leadership permissions.');
      if (summaryRoot) summaryRoot.innerHTML = '<div class="item muted">You do not have access to marketplace payout tools.</div>';
      return;
    }

    startMarketplacePayoutDashboard().catch((error) => {
      console.error(error);
      status('Marketplace payout dashboard failed to start.');
    });
  });
}

window.EvaraMarketplacePayoutDashboard = {
  startMarketplacePayoutDashboard,
  stopMarketplacePayoutDashboard,
  renderMarketplacePayoutDashboard
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
