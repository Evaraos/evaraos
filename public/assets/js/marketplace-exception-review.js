import {
  auth,
  functions,
  httpsCallable,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

const REVIEW_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'dispatcher',
  'customer_support'
]);

const getQueueCall = httpsCallable(functions, 'getMarketplaceExceptionQueue');
const reviewCall = httpsCallable(functions, 'reviewMarketplaceException');

const statusNode = document.getElementById('marketplaceExceptionStatus');
const pendingNode = document.getElementById('marketplaceExceptionPendingCount');
const cancellationNode = document.getElementById('marketplaceExceptionCancellationCount');
const rescheduleNode = document.getElementById('marketplaceExceptionRescheduleCount');
const recentNode = document.getElementById('marketplaceExceptionRecentCount');
const pendingRoot = document.getElementById('marketplaceExceptionRoot');
const recentRoot = document.getElementById('marketplaceExceptionRecentRoot');
const typeFilter = document.getElementById('marketplaceExceptionTypeFilter');

const state = {
  started: false,
  busyId: '',
  timer: null,
  snapshot: { pending: [], recent: [], summary: {} }
};

function clean(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(value = 0) {
  return '$' + (Number(value || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function dateTime(value = 0) {
  const ms = Number(value || 0);
  if (!ms) return 'Not available';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function errorMessage(error, fallback = 'The policy exception could not be processed.') {
  return String(error?.message || error?.details || fallback)
    .replace(/^Firebase:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '');
}

function profileRole() {
  return String(getSavedUserProfile?.()?.role || '').trim().toLowerCase();
}

function canReview() {
  return REVIEW_ROLES.has(profileRole());
}

function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

function setBusy(id = '') {
  state.busyId = id;
  document.querySelectorAll('[data-exception-action]').forEach((button) => {
    const active = id && button.dataset.changeRequestId === id;
    button.disabled = Boolean(id);
    if (active) {
      button.dataset.originalText ||= button.textContent;
      button.textContent = 'Processing…';
    } else if (!id && button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  });
}

function renderStats(summary = {}) {
  if (pendingNode) pendingNode.textContent = String(summary.pendingCount || 0);
  if (cancellationNode) cancellationNode.textContent = String(summary.cancellationCount || 0);
  if (rescheduleNode) rescheduleNode.textContent = String(summary.rescheduleCount || 0);
  if (recentNode) recentNode.textContent = String(summary.recentDecisionCount || 0);
}

function refundControls(row = {}) {
  if (row.type !== 'cancel') return '';
  const suggested = Number(row.refundDecision?.refundPercent || 0);
  const paidCents = Number(row.refundDecision?.paidCents || row.order?.paidCents || 0);
  return `
    <div class="marketplace-exception-refund">
      <label>
        <span>Approved refund percentage</span>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value="${clean(String(suggested))}"
          data-refund-percent="${clean(row.id)}"
          ${paidCents > 0 ? '' : 'disabled'}
        />
      </label>
      <p class="muted">Captured payment: ${clean(money(paidCents))}. Policy suggestion: ${clean(String(suggested))}%.</p>
    </div>
  `;
}

function requestSummary(row = {}) {
  if (row.type === 'reschedule') {
    return `
      <div class="marketplace-exception-change-grid">
        <div><span>Current appointment</span><strong>${clean(dateTime(row.oldScheduledAtMs || row.order?.scheduledAtMs))}</strong></div>
        <div><span>Requested appointment</span><strong>${clean(dateTime(row.requestedScheduledAtMs))}</strong></div>
      </div>
    `;
  }

  const refund = row.refundDecision || {};
  return `
    <div class="marketplace-exception-change-grid">
      <div><span>Scheduled service</span><strong>${clean(dateTime(row.order?.scheduledAtMs))}</strong></div>
      <div><span>Policy outcome</span><strong>${clean(label(refund.disposition || 'manual review'))}</strong></div>
      <div><span>Policy refund</span><strong>${clean(money(refund.refundAmountCents || 0))}</strong></div>
      <div><span>Paid amount</span><strong>${clean(money(refund.paidCents || row.order?.paidCents || 0))}</strong></div>
    </div>
  `;
}

function pendingCard(row = {}) {
  const urgent = Number(row.noticeHours || row.refundDecision?.noticeHours || 0) <= 2;
  return `
    <article class="item marketplace-exception-card" data-exception-card="${clean(row.id)}">
      <div class="marketplace-exception-head">
        <div>
          <div class="row">
            <span class="pill">${clean(label(row.type))}</span>
            <span class="pill">${urgent ? 'Urgent' : 'Review Required'}</span>
            <span class="pill">${clean(row.companyName || 'Marketplace Company')}</span>
          </div>
          <h3>${clean(row.customerName || 'Customer')} · ${clean(row.order?.serviceName || 'Marketplace service')}</h3>
          <p class="muted">Order ${clean(row.orderId)} · Requested ${clean(dateTime(row.requestedAtMs))}</p>
        </div>
        <strong>${clean(money(row.order?.totalCents || 0))}</strong>
      </div>

      <p class="marketplace-exception-reason"><strong>Customer reason:</strong> ${clean(row.reason || 'No reason supplied.')}</p>
      <p class="muted">${clean(row.decisionReason || 'This request falls outside the automatic policy window.')}</p>
      ${requestSummary(row)}
      ${refundControls(row)}

      <label class="marketplace-exception-notes">
        <span>Required review note</span>
        <textarea rows="3" maxlength="1000" data-review-notes="${clean(row.id)}" placeholder="Explain the decision, customer impact, capacity impact, and any refund override."></textarea>
      </label>

      <div class="row marketplace-exception-actions">
        <button type="button" class="btn btn-theme-primary" data-exception-action="approve" data-change-request-id="${clean(row.id)}">Approve exception</button>
        <button type="button" class="btn btn-theme-secondary" data-exception-action="reject" data-change-request-id="${clean(row.id)}">Reject request</button>
      </div>
    </article>
  `;
}

function recentCard(row = {}) {
  return `
    <article class="item">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h3>${clean(label(row.type))} · ${clean(row.customerName || 'Customer')}</h3>
          <p class="muted">Order ${clean(row.orderId)} · ${clean(row.companyName || 'Marketplace Company')}</p>
        </div>
        <span class="pill">${clean(label(row.status))}</span>
      </div>
      <p class="muted">${clean(row.reviewNotes || 'No review note recorded.')}</p>
      <div class="row">
        <span class="pill">${clean(row.reviewedByName || 'Reviewer')}</span>
        <span class="pill">${clean(dateTime(row.reviewedAtMs))}</span>
        ${row.refundPercentOverride !== null ? `<span class="pill">Refund ${clean(String(row.refundPercentOverride))}%</span>` : ''}
      </div>
    </article>
  `;
}

function filteredPending() {
  const filter = String(typeFilter?.value || '').trim().toLowerCase();
  return (state.snapshot.pending || []).filter((row) => !filter || row.type === filter);
}

function renderPending() {
  if (!pendingRoot) return;
  const rows = filteredPending();
  pendingRoot.innerHTML = rows.length
    ? rows.map(pendingCard).join('')
    : '<div class="item muted">No Marketplace policy exceptions match this filter.</div>';
  setBusy(state.busyId);
}

function renderRecent() {
  if (!recentRoot) return;
  const rows = state.snapshot.recent || [];
  recentRoot.innerHTML = rows.length
    ? rows.map(recentCard).join('')
    : '<div class="item muted">No reviewed Marketplace exceptions yet.</div>';
}

function render(snapshot = {}) {
  state.snapshot = snapshot;
  renderStats(snapshot.summary || {});
  renderPending();
  renderRecent();
  setBusy('');
  setStatus(`Exception queue synced · ${new Date(snapshot.generatedAtMs || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
}

async function refresh() {
  if (!auth.currentUser || !canReview()) return;
  try {
    const response = await getQueueCall({});
    render(response.data || {});
  } catch (error) {
    console.error('Marketplace exception queue failed:', error);
    setStatus(errorMessage(error, 'Marketplace exception queue could not load.'));
  }
}

async function review(button) {
  if (state.busyId) return;
  const changeRequestId = button.dataset.changeRequestId;
  const decision = button.dataset.exceptionAction;
  const notes = document.querySelector(`[data-review-notes="${CSS.escape(changeRequestId)}"]`)?.value?.trim() || '';
  const refundInput = document.querySelector(`[data-refund-percent="${CSS.escape(changeRequestId)}"]`);
  const refundPercentOverride = refundInput && !refundInput.disabled ? Number(refundInput.value) : null;
  const row = (state.snapshot.pending || []).find((item) => item.id === changeRequestId);

  if (notes.length < 5) {
    setStatus('Enter a meaningful review note before completing the decision.');
    return;
  }
  if (refundPercentOverride !== null && (!Number.isFinite(refundPercentOverride) || refundPercentOverride < 0 || refundPercentOverride > 100)) {
    setStatus('Refund percentage must be between 0 and 100.');
    return;
  }

  const decisionLabel = decision === 'approve' ? 'approve' : 'reject';
  const refundDetail = row?.type === 'cancel' && decision === 'approve' && refundPercentOverride !== null
    ? `\nRefund override: ${refundPercentOverride}%`
    : '';
  if (!window.confirm(`${decisionLabel[0].toUpperCase() + decisionLabel.slice(1)} this ${row?.type || 'policy'} exception?${refundDetail}`)) return;

  setBusy(changeRequestId);
  setStatus('Validating policy, capacity, and linked records…');

  try {
    const response = await reviewCall({
      changeRequestId,
      decision,
      reviewNotes: notes,
      refundPercentOverride
    });
    const result = response.data || {};
    setStatus(result.reused
      ? 'This policy exception was already reviewed. The queue has been refreshed.'
      : `${label(row?.type || 'Policy')} exception ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    await refresh();
  } catch (error) {
    console.error('Marketplace exception review failed:', error);
    setStatus(errorMessage(error));
    setBusy('');
  }
}

function installStyles() {
  if (document.getElementById('marketplaceExceptionReviewStyles')) return;
  const style = document.createElement('style');
  style.id = 'marketplaceExceptionReviewStyles';
  style.textContent = `
    .marketplace-exception-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .marketplace-exception-toolbar select{min-height:40px;border-radius:14px;border:1px solid var(--border-color,rgba(255,255,255,.14));background:var(--input-bg,rgba(255,255,255,.06));color:inherit;padding:0 12px}
    .marketplace-exception-card{display:grid;gap:14px}
    .marketplace-exception-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .marketplace-exception-head h3{margin:10px 0 4px}
    .marketplace-exception-reason{margin:0}
    .marketplace-exception-change-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .marketplace-exception-change-grid>div,.marketplace-exception-refund{padding:12px;border-radius:16px;border:1px solid var(--border-color,rgba(255,255,255,.12));background:var(--input-bg,rgba(255,255,255,.04))}
    .marketplace-exception-change-grid span,.marketplace-exception-change-grid strong{display:block}
    .marketplace-exception-change-grid span,.marketplace-exception-notes>span,.marketplace-exception-refund label>span{font-size:12px;font-weight:800;color:var(--text-muted)}
    .marketplace-exception-change-grid strong{margin-top:5px}
    .marketplace-exception-refund{display:grid;gap:8px}
    .marketplace-exception-refund label{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:12px;align-items:center}
    .marketplace-exception-refund input,.marketplace-exception-notes textarea{width:100%;border-radius:14px;border:1px solid var(--border-color,rgba(255,255,255,.14));background:var(--input-bg,rgba(255,255,255,.06));color:inherit;padding:10px 12px}
    .marketplace-exception-notes{display:grid;gap:7px}
    .marketplace-exception-actions{justify-content:flex-end}
    @media(max-width:720px){.marketplace-exception-head{display:grid}.marketplace-exception-change-grid{grid-template-columns:1fr}.marketplace-exception-refund label{grid-template-columns:1fr}.marketplace-exception-actions{justify-content:stretch}.marketplace-exception-actions .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function stop() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  state.started = false;
}

function start() {
  if (state.started) return;
  state.started = true;
  installStyles();
  typeFilter?.addEventListener('change', renderPending);
  pendingRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-exception-action]');
    if (button) review(button);
  });
  refresh();
  state.timer = window.setInterval(refresh, 15000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('pagehide', stop);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    stop();
    return;
  }
  if (!canReview()) {
    setStatus('Marketplace exception review requires operations permissions.');
    if (pendingRoot) pendingRoot.innerHTML = '<div class="item muted">You do not have access to policy exception review.</div>';
    return;
  }
  start();
});
