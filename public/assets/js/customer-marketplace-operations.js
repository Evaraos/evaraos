import { auth, functions, httpsCallable, onAuthStateChanged } from './firebase.js';

const getSnapshot = httpsCallable(functions, 'getMarketplaceOperationsSnapshot');
const requestReschedule = httpsCallable(functions, 'requestMarketplaceReschedule');
const cancelOrder = httpsCallable(functions, 'cancelMarketplaceOrder');

const ordersRoot = document.getElementById('customerOrderRoot');
const notificationsRoot = document.getElementById('customerNotificationRoot');
const refundsRoot = document.getElementById('customerRefundRoot');
const activeOrdersNode = document.getElementById('customerActiveOrders');
const updatesNode = document.getElementById('customerUnreadUpdates');
const statusNode = document.getElementById('customerOperationsStatus');

const state = { busy: '', timer: null, started: false, snapshot: null };

const clean = (value = '') => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const label = (value = '') => String(value || '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value = 0) => '$' + (Number(value || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dateTime(value) {
  const ms = Number(value || 0);
  if (!ms) return 'Not scheduled';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dateInput(value) {
  const date = new Date(Number(value || Date.now() + 3600000));
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

function setBusy(key = '') {
  state.busy = key;
  document.querySelectorAll('[data-marketplace-operation]').forEach((button) => {
    const active = key && button.dataset.busyKey === key;
    button.disabled = Boolean(key);
    if (active) {
      button.dataset.originalText ||= button.textContent;
      button.textContent = 'Working…';
    } else if (!key && button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  });
}

function tracking(order) {
  const row = order.tracking || {};
  if (!row.available) {
    const messages = {
      not_active: 'Live tracking begins when your assigned professional is en route or working.',
      worker_offline: 'Your assigned professional is not sharing live location right now.',
      destination_unavailable: 'ETA is waiting for the service location to be confirmed.',
      location_unavailable: 'Live location is temporarily unavailable.'
    };
    return `<div class="item muted">${clean(messages[row.state] || 'Live tracking is not active yet.')}</div>`;
  }
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${row.lat},${row.lng}`)}`;
  return `
    <div class="item">
      <strong>${clean(row.workerName)} is live</strong>
      <p class="muted">Approximately ${clean(row.etaMinutes)} minutes away · ${clean(row.distanceMiles)} miles</p>
      <div class="row">
        <span class="pill">Updated ${clean(dateTime(row.lastSeenMs))}</span>
        <a class="btn btn-theme-secondary" href="${clean(mapUrl)}" target="_blank" rel="noopener noreferrer">Open live map</a>
      </div>
    </div>`;
}

function refundText(order) {
  const estimate = order.refundEstimate || {};
  if (estimate.disposition === 'eligible') return `Estimated refund if cancelled now: ${money(estimate.amountCents)} (${estimate.percent}%).`;
  if (estimate.disposition === 'manual_review') return 'A cancellation now would require a policy review.';
  if (estimate.disposition === 'not_eligible') return 'The automatic refund window has passed.';
  return 'No captured payment requires a refund.';
}

function controls(order) {
  if (order.cancellationPending) return '<span class="pill">Cancellation awaiting review</span>';
  if (order.reschedulePending) return '<span class="pill">Reschedule awaiting review</span>';
  const parts = [];
  if (order.canReschedule) {
    parts.push(`
      <label class="marketplace-change-field">
        <span>New appointment</span>
        <input type="datetime-local" data-reschedule-input="${clean(order.id)}" min="${clean(dateInput(Date.now() + 3600000))}" value="${clean(dateInput(order.scheduledAtMs))}" />
      </label>
      <button class="btn btn-theme-secondary" type="button" data-marketplace-operation="reschedule" data-order-id="${clean(order.id)}" data-busy-key="order:${clean(order.id)}">Request reschedule</button>`);
  }
  if (order.canCancel) parts.push(`<button class="btn btn-theme-secondary" type="button" data-marketplace-operation="cancel" data-order-id="${clean(order.id)}" data-busy-key="order:${clean(order.id)}">Cancel order</button>`);
  return parts.join('') || '<span class="pill">No order changes available</span>';
}

function renderOrders(rows = []) {
  if (!ordersRoot) return;
  if (!rows.length) {
    ordersRoot.innerHTML = '<div class="item muted">No Marketplace orders yet.</div>';
    return;
  }
  ordersRoot.innerHTML = rows.slice(0, 20).map((order) => `
    <article class="item" id="order-${clean(order.id)}">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3>${clean(order.serviceName)}</h3><p class="muted">${clean(order.companyName || 'Marketplace provider')} · Order ${clean(order.id)}</p></div>
        <strong>${clean(money(order.totalCents))}</strong>
      </div>
      <div class="row">
        <span class="pill">${clean(label(order.status))}</span>
        <span class="pill">Payment: ${clean(label(order.paymentStatus || 'pending'))}</span>
        <span class="pill">Provider: ${clean(label(order.vendorAcceptanceStatus || 'pending'))}</span>
        <span class="pill">${clean(dateTime(order.scheduledAtMs))}</span>
        ${order.refundStatus ? `<span class="pill">Refund: ${clean(label(order.refundStatus))}</span>` : ''}
      </div>
      <p class="muted" style="margin-top:10px">${clean(refundText(order))}</p>
      <div class="dashboard-list" style="margin-top:12px">${tracking(order)}</div>
      <div class="row marketplace-order-controls" style="margin-top:12px">${controls(order)}</div>
    </article>`).join('');
}

function renderNotifications(rows = []) {
  if (!notificationsRoot) return;
  if (!rows.length) {
    notificationsRoot.innerHTML = '<div class="item muted">No Marketplace updates yet.</div>';
    return;
  }
  notificationsRoot.innerHTML = rows.slice(0, 20).map((note) => `
    <article class="item">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><h3>${clean(note.title)}</h3><span class="pill">${clean(label(note.status))}</span></div>
      <p class="muted">${clean(note.body)}</p>
      <div class="row"><span class="pill">${clean(label(note.type))}</span><span class="pill">${clean(label(note.priority))}</span><span class="pill">${clean(dateTime(note.createdAtMs))}</span></div>
    </article>`).join('');
}

function renderRefunds(rows = []) {
  if (!refundsRoot) return;
  if (!rows.length) {
    refundsRoot.innerHTML = '<div class="item muted">No refund requests.</div>';
    return;
  }
  refundsRoot.innerHTML = rows.slice(0, 10).map((refund) => `
    <article class="item">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3>${clean(money(refund.amountCents))} refund</h3><p class="muted">Order ${clean(refund.orderId)}</p></div>
        <span class="pill">${clean(label(refund.status))}</span>
      </div>
      <p class="muted">${clean(refund.policyReason || refund.reason || 'Refund processing')}</p>
      <div class="row"><span class="pill">${clean(refund.refundPercent)}%</span><span class="pill">${clean(dateTime(refund.updatedAtMs || refund.createdAtMs))}</span></div>
    </article>`).join('');
}

function render(snapshot = {}) {
  state.snapshot = snapshot;
  renderOrders(snapshot.orders || []);
  renderNotifications(snapshot.notifications || []);
  renderRefunds(snapshot.refunds || []);
  if (activeOrdersNode) activeOrdersNode.textContent = String(snapshot.summary?.activeOrders || 0);
  if (updatesNode) updatesNode.textContent = String(snapshot.summary?.unreadNotifications || 0);
  setBusy('');
  setStatus(`Operations synced · ${new Date(snapshot.generatedAtMs || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
}

async function refresh() {
  if (!auth.currentUser) return;
  try {
    const response = await getSnapshot({});
    render(response.data || {});
  } catch (error) {
    console.error('Marketplace operations refresh failed:', error);
    setStatus(error?.message || 'Marketplace operations could not load.');
  }
}

async function reschedule(button) {
  const orderId = button.dataset.orderId;
  const input = document.querySelector(`[data-reschedule-input="${CSS.escape(orderId)}"]`);
  const newScheduledAtMs = input?.value ? new Date(input.value).getTime() : 0;
  if (!newScheduledAtMs || newScheduledAtMs <= Date.now()) return setStatus('Choose a future appointment time.');
  const reason = window.prompt('Add a reason for the appointment change (optional):') || '';
  setBusy(`order:${orderId}`);
  setStatus('Checking policy and appointment capacity…');
  try {
    const response = await requestReschedule({ orderId, newScheduledAtMs, reason });
    setStatus(response.data?.requiresReview ? 'Your reschedule request was submitted for review.' : 'Your appointment was rescheduled successfully.');
    await refresh();
  } catch (error) {
    setStatus(error?.message || 'The appointment could not be rescheduled.');
    setBusy('');
  }
}

async function cancel(button) {
  const orderId = button.dataset.orderId;
  const order = (state.snapshot?.orders || []).find((row) => row.id === orderId) || {};
  if (!window.confirm(`Cancel this order?\n\n${refundText(order)}`)) return;
  const reason = window.prompt('Why are you cancelling this order?') || 'Customer requested cancellation';
  setBusy(`order:${orderId}`);
  setStatus('Applying the cancellation policy…');
  try {
    const response = await cancelOrder({ orderId, reason });
    if (response.data?.requiresReview) setStatus('Your cancellation request was submitted for policy review.');
    else if (response.data?.refundAmountCents > 0) setStatus(`Order cancelled. ${money(response.data.refundAmountCents)} was queued for refund processing.`);
    else setStatus('Order cancelled.');
    await refresh();
  } catch (error) {
    setStatus(error?.message || 'The order could not be cancelled.');
    setBusy('');
  }
}

function installStyles() {
  if (document.getElementById('marketplaceOperationalStyles')) return;
  const style = document.createElement('style');
  style.id = 'marketplaceOperationalStyles';
  style.textContent = `.marketplace-order-controls{align-items:flex-end}.marketplace-change-field{display:grid;gap:6px;min-width:min(100%,260px)}.marketplace-change-field span{font-size:12px;font-weight:800;color:var(--text-muted)}.marketplace-change-field input{min-height:42px;border-radius:14px;border:1px solid var(--border-color,rgba(255,255,255,.14));background:var(--input-bg,rgba(255,255,255,.06));color:inherit;padding:0 12px}@media(max-width:720px){.marketplace-order-controls{align-items:stretch}.marketplace-order-controls .btn,.marketplace-change-field{width:100%}}`;
  document.head.appendChild(style);
}

function start() {
  if (state.started) return;
  state.started = true;
  installStyles();
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-marketplace-operation]');
    if (!button || state.busy) return;
    if (button.dataset.marketplaceOperation === 'reschedule') reschedule(button);
    if (button.dataset.marketplaceOperation === 'cancel') cancel(button);
  });
  refresh();
  state.timer = window.setInterval(refresh, 15000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());
  window.addEventListener('pagehide', () => state.timer && clearInterval(state.timer));
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  start();
});
