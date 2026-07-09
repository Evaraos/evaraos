const STATUS_VERSION = 'canvas-sync-status-v1';

let state = {
  graphId: null,
  graphRevision: 0,
  headRevision: 0,
  headSequence: 0,
  lastTransactionId: null,
  pendingCount: 0,
  unsynchronizedChanges: false,
  syncState: 'saved-locally',
  integrityState: 'unverified',
  durabilityState: 'saved-locally',
  writerState: 'idle',
  reason: 'boot'
};

function integer(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function sessionSnapshot() {
  return window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.() || null;
}

function writerSnapshot() {
  return window.EvaraCanvasWriterGuard?.snapshot?.() || null;
}

function normalize(snapshot = {}, reason = state.reason) {
  const pendingCount = integer(snapshot.pendingTransactionCount ?? snapshot.pendingCount, state.pendingCount);
  return {
    ...state,
    graphId: snapshot.graphId ?? state.graphId,
    graphRevision: integer(snapshot.graphRevision, state.graphRevision),
    headRevision: integer(snapshot.headRevision, state.headRevision),
    headSequence: integer(snapshot.headSequence, state.headSequence),
    lastTransactionId: snapshot.lastTransactionId ?? state.lastTransactionId,
    pendingCount,
    unsynchronizedChanges: snapshot.unsynchronizedChanges ?? (pendingCount > 0),
    syncState: snapshot.syncState || state.syncState,
    integrityState: snapshot.integrityState || state.integrityState,
    durabilityState: snapshot.durabilityState || state.durabilityState,
    writerState: snapshot.writerState || writerSnapshot()?.state || state.writerState,
    reason
  };
}

function statusText() {
  if (state.integrityState !== 'verified') return 'Canvas recovery validation required';
  if (state.writerState === 'refresh-required') return 'Canvas is stale — reload before editing';
  if (state.writerState === 'read-only') return 'Read-only — another Studio tab is editing';
  if (state.pendingCount > 0) return `${state.pendingCount} local change${state.pendingCount === 1 ? '' : 's'} waiting for trusted sync`;
  if (state.syncState === 'server-confirmed') return 'All Canvas changes are server confirmed';
  return 'Canvas draft is saved locally';
}

function render() {
  const body = document.body;
  if (!body) return;
  body.dataset.canvasSyncVersion = STATUS_VERSION;
  body.dataset.canvasSyncState = state.syncState;
  body.dataset.canvasIntegrityState = state.integrityState;
  body.dataset.canvasUnsynchronized = state.unsynchronizedChanges ? 'true' : 'false';
  body.dataset.canvasPendingCount = String(state.pendingCount);

  const overlay = document.querySelector('[data-canvas-sandbox]');
  if (overlay) {
    overlay.dataset.syncState = state.syncState;
    overlay.dataset.integrityState = state.integrityState;
    overlay.dataset.unsynchronized = state.unsynchronizedChanges ? 'true' : 'false';
    overlay.dataset.pendingCount = String(state.pendingCount);
  }

  let status = document.querySelector('[data-canvas-sync-status]');
  if (!status) {
    status = document.createElement('div');
    status.className = 'studio-canvas-sync-status';
    status.dataset.canvasSyncStatus = 'true';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    document.body.append(status);
  }
  status.dataset.state = state.integrityState !== 'verified'
    ? 'recovery-required'
    : state.writerState === 'read-only' || state.writerState === 'refresh-required'
      ? state.writerState
      : state.unsynchronizedChanges
        ? 'unsynchronized'
        : state.syncState;
  status.textContent = statusText();
  status.hidden = !document.body.classList.contains('is-canvas-sandbox-open');
}

function publish(reason = 'refresh') {
  state = normalize(sessionSnapshot() || {}, reason);
  state.writerState = writerSnapshot()?.state || state.writerState;
  render();
  window.dispatchEvent(new CustomEvent('evara:canvas-sync-status', {
    detail: { ...state, version: STATUS_VERSION }
  }));
  return { ...state };
}

window.addEventListener('evara:canvas-session-change', (event) => {
  state = normalize(event.detail || sessionSnapshot() || {}, event.detail?.reason || 'canvas-session-change');
  state.writerState = writerSnapshot()?.state || state.writerState;
  render();
});

window.addEventListener('evara:canvas-writer-guard', (event) => {
  state = normalize(sessionSnapshot() || {}, event.detail?.reason || 'canvas-writer-guard');
  state.writerState = event.detail?.state || state.writerState;
  render();
});

window.addEventListener('evara:studio-journal-status', (event) => {
  const detail = event.detail || {};
  if (detail.graphId && state.graphId && detail.graphId !== state.graphId) return;
  state = normalize({
    graphId: detail.graphId,
    headRevision: detail.acceptedHeadRevision ?? detail.revision,
    headSequence: detail.sequence,
    durabilityState: detail.durabilityState || detail.state,
    integrityState: detail.state === 'recovery-required' ? 'recovery-required' : state.integrityState
  }, detail.reason || 'studio-journal-status');
  render();
});

const observer = new MutationObserver(() => render());
if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true }), { once: true });

window.EvaraCanvasSyncStatus = Object.freeze({
  version: STATUS_VERSION,
  refresh: publish,
  snapshot: () => ({ ...state })
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => publish('dom-ready'), { once: true });
else publish('module-ready');
