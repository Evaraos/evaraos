import {
  auth,
  db,
  functions,
  httpsCallable,
  onAuthStateChanged,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  getSavedUserProfile
} from './firebase.js';

const PLATFORM_ROLES = new Set(['owner', 'super_admin', 'admin']);
const VENDOR_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'dispatcher',
  'sales_manager',
  'sales',
  'sales_rep'
]);

const respondCall = httpsCallable(functions, 'vendorRespondMarketplaceOrder');
const marketplaceOrders = new Map();
let unsubscribe = null;
let observer = null;
let busyOrderId = '';

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function notify(title, message, tone = 'info') {
  window.dispatchEvent(new CustomEvent('evara:notify', {
    detail: { title, message, tone }
  }));
}

function actorProfile() {
  const profile = getSavedUserProfile?.() || {};
  return {
    role: normalize(profile.role),
    companyId: String(profile.companyId || '').trim()
  };
}

function isMarketplaceOrder(order = {}) {
  return Boolean(
    order.vendorAcceptanceStatus ||
    order.source === 'customer_quote_acceptance' ||
    order.quoteId ||
    order.invoiceId
  );
}

function pill(status = 'pending') {
  const value = normalize(status || 'pending');
  const label = value === 'accepted'
    ? 'Vendor Accepted'
    : value === 'rejected'
      ? 'Vendor Rejected'
      : 'Vendor Review';
  const cls = value === 'accepted' ? 'success' : value === 'rejected' ? 'empty' : 'warning';
  return `<span class="dashboard-status-pill ${cls}" data-vendor-state>${escapeHtml(label)}</span>`;
}

function controls(order = {}) {
  const status = normalize(order.vendorAcceptanceStatus || 'pending');
  if (status === 'accepted' || status === 'rejected') return pill(status);

  return `
    ${pill(status)}
    <button type="button" class="btn btn-theme-primary" data-vendor-order-action="accept" data-order-id="${escapeHtml(order.id)}">Accept Marketplace Order</button>
    <button type="button" class="btn btn-theme-secondary" data-vendor-order-action="reject" data-order-id="${escapeHtml(order.id)}">Reject</button>
  `;
}

function syncCard(order = {}) {
  const card = document.querySelector(`[data-job-id="${CSS.escape(String(order.id || ''))}"]`);
  const actions = card?.querySelector('.job-dispatch-actions');
  if (!actions) return;

  let root = actions.querySelector('[data-marketplace-vendor-controls]');
  if (!root) {
    root = document.createElement('div');
    root.dataset.marketplaceVendorControls = 'true';
    root.className = 'marketplace-vendor-controls';
    actions.appendChild(root);
  }

  root.innerHTML = controls(order);
  root.querySelectorAll('button').forEach((button) => {
    button.disabled = Boolean(busyOrderId);
    if (busyOrderId === order.id) button.textContent = 'Working…';
  });
}

function syncAllCards() {
  marketplaceOrders.forEach(syncCard);
}

function installStyles() {
  if (document.getElementById('marketplaceVendorHandoffStyles')) return;
  const style = document.createElement('style');
  style.id = 'marketplaceVendorHandoffStyles';
  style.textContent = `
    .marketplace-vendor-controls{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;width:100%}
    .marketplace-vendor-controls .btn{min-height:34px;padding:8px 10px;font-size:12px}
    @media(max-width:760px){.marketplace-vendor-controls{justify-content:flex-start}}
  `;
  document.head.appendChild(style);
}

function startObserver() {
  if (observer) return;
  const target = document.getElementById('jobsList') || document.body;
  observer = new MutationObserver(syncAllCards);
  observer.observe(target, { childList: true, subtree: true });
}

async function respond(orderId, action) {
  if (busyOrderId) return;
  const order = marketplaceOrders.get(orderId);
  if (!order) return;

  let reason = '';
  if (action === 'reject') {
    reason = window.prompt('Why is this Marketplace order being rejected?') || '';
    if (!reason.trim()) return;
  }

  busyOrderId = orderId;
  syncAllCards();

  try {
    await respondCall({ orderId, action, reason: reason.trim() });
    notify(
      action === 'accept' ? 'Marketplace order accepted' : 'Marketplace order rejected',
      action === 'accept'
        ? 'The order is now in the vendor fulfillment workflow.'
        : 'The order was returned to dispatch review for reassignment.',
      action === 'accept' ? 'success' : 'warning'
    );
  } catch (error) {
    console.error('Marketplace vendor response failed:', error);
    notify('Vendor response failed', error?.message || 'The Marketplace order could not be updated.', 'error');
  } finally {
    busyOrderId = '';
    syncAllCards();
  }
}

function bindActions() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-vendor-order-action]');
    if (!button) return;
    respond(button.dataset.orderId, button.dataset.vendorOrderAction);
  });
}

function startFeed() {
  if (unsubscribe) unsubscribe();
  marketplaceOrders.clear();

  const profile = actorProfile();
  if (!VENDOR_ROLES.has(profile.role)) return;

  const source = collection(db, 'jobs');
  const feed = profile.companyId
    ? query(source, where('companyId', '==', profile.companyId), limit(100))
    : PLATFORM_ROLES.has(profile.role)
      ? query(source, limit(100))
      : null;

  if (!feed) return;

  unsubscribe = onSnapshot(feed, (snapshot) => {
    marketplaceOrders.clear();
    snapshot.docs.forEach((docSnap) => {
      const order = { id: docSnap.id, ...docSnap.data() };
      if (isMarketplaceOrder(order)) marketplaceOrders.set(order.id, order);
    });
    syncAllCards();
  }, (error) => {
    console.warn('Marketplace vendor handoff feed unavailable:', error);
  });
}

function cleanup() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  observer?.disconnect();
  observer = null;
}

function init() {
  installStyles();
  bindActions();
  startObserver();
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      cleanup();
      return;
    }
    startFeed();
  });
}

window.addEventListener('pagehide', cleanup);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
