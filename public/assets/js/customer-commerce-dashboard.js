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
  refreshCustomerCommerceSnapshot,
  subscribeCustomerCommercePortal,
  unsubscribeCustomerCommercePortal,
  getCustomerPortalPaymentOptions,
  getCustomerPortalSubscriptionOptions
} from './customer-commerce-portal-engine.js';

import {
  loadCustomerPersistentQuotes,
  subscribeCustomerPersistentQuotes,
  stopPersistentQuotesSubscription
} from './persistent-quotes-adapter.js';

import {
  loadCustomerPersistentInvoices,
  subscribeCustomerPersistentInvoices,
  stopPersistentInvoicesSubscription
} from './persistent-invoices-adapter.js';

import {
  loadCustomerPersistentSubscriptions,
  subscribeCustomerPersistentSubscriptions,
  stopPersistentSubscriptionsSubscription
} from './persistent-subscriptions-adapter.js';

import {
  loadCustomerNotifications,
  subscribeCustomerNotifications,
  getLocalCustomerNotifications,
  summarizeCustomerNotifications,
  markAllCustomerNotificationsRead,
  stopPersistentCustomerNotificationsSubscription
} from './persistent-customer-notifications-adapter.js';

import {
  getFirestoreSyncHealth,
  subscribeFirestoreSyncHealth,
  unsubscribeFirestoreSyncHealth
} from './firestore-sync-health.js';

const statusNode = document.getElementById('customerCommerceStatus');
const outstandingNode = document.getElementById('customerOutstanding');
const paidNode = document.getElementById('customerPaid');
const subscriptionsNode = document.getElementById('customerActiveSubscriptions');
const quotesNode = document.getElementById('customerQuoteCount');
const actionsRoot = document.getElementById('customerActionRoot');
const invoicesRoot = document.getElementById('customerInvoiceRoot');
const subscriptionsRoot = document.getElementById('customerSubscriptionRoot');
const quotesRoot = document.getElementById('customerQuoteRoot');

const runtime = createDashboardRuntime({
  id: 'customer-commerce-dashboard-runtime',
  name: 'Customer Commerce Dashboard Runtime',
  metadata: { page: 'customer-commerce.html' }
});

let portalListenerId = null;
let notificationUnsubscribe = null;
let syncHealthListenerId = null;
let activeCustomerId = '';
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

function resolveCustomerId() {
  const profile = getSavedUserProfile() || {};
  return profile.uid || profile.id || auth.currentUser?.uid || '';
}

function renderStats(snapshot = {}) {
  const summary = snapshot.summary || {};
  if (outstandingNode) outstandingNode.textContent = money(summary.outstandingCents);
  if (paidNode) paidNode.textContent = money(summary.paidCents);
  if (subscriptionsNode) subscriptionsNode.textContent = String(summary.activeSubscriptions || 0);
  if (quotesNode) quotesNode.textContent = String(summary.quoteCount || 0);
}

function renderActions(snapshot = {}) {
  if (!actionsRoot) return;
  const notificationsSummary = summarizeCustomerNotifications(latestNotifications);
  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();
  const rows = [...(snapshot.actions || [])];

  if (notificationsSummary.unread) {
    rows.unshift({
      type: 'notifications',
      title: 'Unread notifications',
      detail: `${notificationsSummary.unread} customer notification(s) need review.`,
      priority: notificationsSummary.urgent ? 'urgent' : 'medium'
    });
  }

  if (syncHealth.status === 'offline' || syncHealth.status === 'degraded') {
    rows.unshift({
      type: 'sync_health',
      title: 'Sync status needs attention',
      detail: `Current sync state is ${syncHealth.status}. Some account data may still be catching up.`,
      priority: 'medium'
    });
  }

  actionsRoot.innerHTML = rows.map((action) => {
    return '<article class="item"><h3>' + clean(action.title) + '</h3><p class="muted">' + clean(action.detail) + '</p><div class="row"><span class="pill">' + clean(label(action.priority)) + '</span><span class="pill">' + clean(label(action.type)) + '</span></div></article>';
  }).join('') || '<div class="item muted">No account actions right now.</div>';
}

function renderInvoices(snapshot = {}) {
  if (!invoicesRoot) return;
  const rows = getCustomerPortalPaymentOptions(snapshot.customerId, { companyId: snapshot.companyId });

  if (!rows.length) {
    invoicesRoot.innerHTML = '<div class="item muted">No open invoices right now.</div>';
    return;
  }

  invoicesRoot.innerHTML = rows.map((invoice) => {
    const action = invoice.paymentUrl
      ? '<a class="btn btn-theme-primary" href="' + clean(invoice.paymentUrl) + '">Pay Now</a>'
      : '<button class="btn btn-theme-secondary" type="button" disabled>Payment Link Pending</button>';

    return '<article class="item"><h3>' + clean(invoice.invoiceNumber || invoice.invoiceId) + '</h3><p class="muted">Status: ' + clean(label(invoice.status)) + '</p><div class="row"><span class="pill">Due: ' + clean(money(invoice.amountDueCents)) + '</span></div><div class="row" style="margin-top:12px">' + action + '</div></article>';
  }).join('');
}

function renderSubscriptions(snapshot = {}) {
  if (!subscriptionsRoot) return;
  const rows = getCustomerPortalSubscriptionOptions(snapshot.customerId, { companyId: snapshot.companyId });

  if (!rows.length) {
    subscriptionsRoot.innerHTML = '<div class="item muted">No active subscriptions yet.</div>';
    return;
  }

  subscriptionsRoot.innerHTML = rows.map((subscription) => {
    return '<article class="item"><h3>' + clean(subscription.subscriptionId) + '</h3><p class="muted">' + clean(label(subscription.status)) + ' • ' + clean(label(subscription.interval)) + '</p><div class="row"><span class="pill">Amount: ' + clean(money(subscription.amountCents)) + '</span><span class="pill">Next billing: ' + clean(subscription.nextBillingAtMs ? new Date(subscription.nextBillingAtMs).toLocaleDateString() : 'Not set') + '</span></div></article>';
  }).join('');
}

function renderQuotes(snapshot = {}) {
  if (!quotesRoot) return;
  const rows = snapshot.quotes || [];
  const notifications = latestNotifications.slice(0, 3);

  if (!rows.length && !notifications.length) {
    quotesRoot.innerHTML = '<div class="item muted">No quotes or notifications yet.</div>';
    return;
  }

  const quoteHtml = rows.slice(0, 6).map((quote) => {
    return '<article class="item"><h3>Quote ' + clean(quote.id) + '</h3><p class="muted">Status: ' + clean(label(quote.status)) + '</p><div class="row"><span class="pill">Total: ' + clean(money(quote.totalCents)) + '</span><span class="pill">Items: ' + clean(String(quote.lineItems?.length || 0)) + '</span></div></article>';
  }).join('');

  const notificationHtml = notifications.map((notification) => {
    return '<article class="item"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.body || 'Customer notification') + '</p><div class="row"><span class="pill">' + clean(label(notification.type)) + '</span><span class="pill">' + clean(label(notification.status)) + '</span></div></article>';
  }).join('');

  quotesRoot.innerHTML = quoteHtml + notificationHtml;
}

function renderCustomerCommerce(snapshot = {}) {
  renderStats(snapshot);
  renderActions(snapshot);
  renderInvoices(snapshot);
  renderSubscriptions(snapshot);
  renderQuotes(snapshot);
  const syncHealth = latestSyncHealth || getFirestoreSyncHealth();
  status(`Customer commerce portal synced • ${label(syncHealth.status || 'healthy')}`);
}

async function hydratePersistentCustomerCommerce() {
  await Promise.allSettled([
    loadCustomerPersistentQuotes(activeCustomerId),
    loadCustomerPersistentInvoices(activeCustomerId),
    loadCustomerPersistentSubscriptions(activeCustomerId),
    loadCustomerNotifications(activeCustomerId).then((rows) => { latestNotifications = rows || []; })
  ]);

  renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId));
}

async function startCustomerCommerceDashboard() {
  stopCustomerCommerceDashboard();
  activeCustomerId = resolveCustomerId();

  if (!activeCustomerId) {
    status('Customer profile not ready.');
    return;
  }

  await hydratePersistentCustomerCommerce();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Subscribe customer commerce renderer',
      run() {
        portalListenerId = subscribeCustomerCommercePortal((snapshot) => {
          if (!snapshot || snapshot.customerId !== activeCustomerId) return;
          renderCustomerCommerce(snapshot);
        });

        return () => {
          if (portalListenerId) unsubscribeCustomerCommercePortal(portalListenerId);
          portalListenerId = null;
        };
      }
    },
    {
      label: 'Subscribe persistent customer commerce records',
      run() {
        subscribeCustomerPersistentQuotes(activeCustomerId, () => renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId)));
        subscribeCustomerPersistentInvoices(activeCustomerId, () => renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId)));
        subscribeCustomerPersistentSubscriptions(activeCustomerId, () => renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId)));

        return () => {
          stopPersistentQuotesSubscription();
          stopPersistentInvoicesSubscription();
          stopPersistentSubscriptionsSubscription();
        };
      }
    },
    {
      label: 'Subscribe customer notifications',
      run() {
        notificationUnsubscribe = subscribeCustomerNotifications(activeCustomerId, (rows = []) => {
          latestNotifications = rows || [];
          renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId));
        });

        return () => {
          if (notificationUnsubscribe) notificationUnsubscribe();
          notificationUnsubscribe = null;
          stopPersistentCustomerNotificationsSubscription();
        };
      }
    },
    {
      label: 'Subscribe customer sync health',
      run() {
        syncHealthListenerId = subscribeFirestoreSyncHealth((health) => {
          latestSyncHealth = health;
          renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId));
        });
        return () => {
          if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);
          syncHealthListenerId = null;
        };
      }
    }
  ]);

  renderCustomerCommerce(refreshCustomerCommerceSnapshot(activeCustomerId));
}

function stopCustomerCommerceDashboard() {
  if (portalListenerId) unsubscribeCustomerCommercePortal(portalListenerId);
  if (notificationUnsubscribe) notificationUnsubscribe();
  if (syncHealthListenerId) unsubscribeFirestoreSyncHealth(syncHealthListenerId);

  portalListenerId = null;
  notificationUnsubscribe = null;
  syncHealthListenerId = null;

  stopPersistentQuotesSubscription();
  stopPersistentInvoicesSubscription();
  stopPersistentSubscriptionsSubscription();
  stopPersistentCustomerNotificationsSubscription();
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopCustomerCommerceDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopCustomerCommerceDashboard);
  window.addEventListener('pagehide', stopCustomerCommerceDashboard);

  window.EvaraCustomerCommerceActions = {
    markAllNotificationsRead: () => markAllCustomerNotificationsRead(activeCustomerId)
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopCustomerCommerceDashboard();
      window.location.assign('/login.html');
      return;
    }

    startCustomerCommerceDashboard().catch((error) => {
      console.error(error);
      status('Customer commerce portal failed to start.');
    });
  });
}

window.EvaraCustomerCommerceDashboard = {
  startCustomerCommerceDashboard,
  stopCustomerCommerceDashboard,
  renderCustomerCommerce
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
