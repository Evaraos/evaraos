const AUTHORITY_VERSION = 'studio-production-authority-v1';
const CANVAS_GRAPH_PREFIX = 'graph:canvas:';
let conflictState = null;
let panel = null;
let observer = null;

function text(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function node(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = text(options.text, options.maxText || 2000);
  if (options.type) element.type = options.type;
  if (options.title) element.title = text(options.title, 300);
  if (options.disabled !== undefined) element.disabled = Boolean(options.disabled);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { element.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => element.append(child));
  return element;
}

function canvasSession() {
  return window.EvaraCanvasSandbox?.getSession?.() || null;
}

function canvasGraph() {
  return canvasSession()?.getGraph?.() || null;
}

function trustedAdapter() {
  return window.EvaraTrustedStudioJournal || null;
}

function assertCanvasGraph(graph, action) {
  const graphId = text(graph?.graphId, 220);
  if (!graphId.startsWith(CANVAS_GRAPH_PREFIX)) {
    throw new Error(`${action} requires the authoritative CanvasSession graph. Compatibility projections are migration-only.`);
  }
  return graphId;
}

function installTrustedReleaseGuard() {
  const adapter = trustedAdapter();
  if (!adapter || adapter.productionAuthorityVersion) return;
  const release = adapter.release?.bind(adapter);
  const checkpoint = adapter.checkpoint?.bind(adapter);
  if (!release || !checkpoint) return;
  window.EvaraTrustedStudioJournal = Object.freeze({
    ...adapter,
    release: async (graph, options = {}) => {
      assertCanvasGraph(graph, 'Immutable release preparation');
      return release(graph, options);
    },
    checkpoint: async (graph, reason) => {
      assertCanvasGraph(graph, 'Trusted checkpoint creation');
      return checkpoint(graph, reason);
    },
    productionAuthorityVersion: AUTHORITY_VERSION
  });
}

function showToast(message, tone = 'info') {
  let toast = document.querySelector('[data-production-authority-toast]');
  if (!toast) {
    toast = node('div', {
      className: 'studio-production-authority-toast',
      dataset: { productionAuthorityToast: 'true' },
      attrs: { role: 'status' }
    });
    document.body.append(toast);
  }
  toast.textContent = text(message, 700);
  toast.dataset.tone = tone;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function openCanvas() {
  return window.EvaraCanvasSandbox?.open?.();
}

function injectAuthorityBadge() {
  document.body.dataset.studioAuthoringAuthority = 'canvas-session';
  document.body.dataset.studioCompatibilityMode = 'migration-only';
  const actions = document.querySelector('.studio-top-actions');
  if (!actions || actions.querySelector('[data-production-authority]')) return;
  const badge = node('div', {
    className: 'studio-production-authority-badge',
    dataset: { productionAuthority: 'canvas-session' },
    attrs: { role: 'status' }
  }, [
    node('span', { text: 'Production authority' }),
    node('strong', { text: 'Graph Canvas' }),
    node('button', {
      type: 'button',
      text: 'Open',
      title: 'Open the authoritative CanvasSession editor',
      dataset: { productionAuthorityAction: 'open-canvas' }
    })
  ]);
  actions.prepend(badge);
}

function injectMigrationNotice() {
  const workspace = document.querySelector('.studio-workspace');
  if (!workspace || workspace.querySelector('[data-compatibility-migration-notice]')) return;
  workspace.prepend(node('section', {
    className: 'studio-compatibility-migration-notice',
    dataset: { compatibilityMigrationNotice: 'true' },
    attrs: { role: 'note' }
  }, [
    node('div', {}, [
      node('strong', { text: 'Compatibility projection — migration only' }),
      node('p', { text: 'This legacy visual surface remains available for Blueprint migration, comparison, export, and rollback. Only Graph Canvas can create trusted checkpoints or immutable releases.' })
    ]),
    node('button', {
      type: 'button',
      text: 'Open production Canvas',
      dataset: { productionAuthorityAction: 'open-canvas' }
    })
  ]));
}

function closeConflictPanel() {
  panel?.remove();
  panel = null;
}

function renderConflictPanel() {
  closeConflictPanel();
  if (!conflictState) return;
  const graph = canvasGraph();
  const graphId = text(conflictState.graphId || graph?.graphId, 220);
  panel = node('aside', {
    className: 'studio-production-conflict-panel',
    dataset: { productionConflictPanel: 'true', state: conflictState.state || 'conflict' },
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Resolve Studio synchronization conflict' }
  }, [
    node('div', { className: 'studio-production-conflict-card' }, [
      node('span', { className: 'studio-production-conflict-kicker', text: conflictState.state === 'recovery-required' ? 'Recovery required' : 'Synchronization conflict' }),
      node('h2', { text: 'The local draft was preserved. Choose a safe resolution.' }),
      node('p', { text: conflictState.error || 'The trusted branch head differs from this local Canvas draft. No last-write-wins overwrite was attempted.' }),
      node('dl', {}, [
        node('div', {}, [node('dt', { text: 'Graph' }), node('dd', { text: graphId || 'Unknown' })]),
        node('div', {}, [node('dt', { text: 'Conflict' }), node('dd', { text: conflictState.conflict?.code || conflictState.reason || 'branch-head-conflict' })])
      ]),
      node('div', { className: 'studio-production-conflict-actions' }, [
        node('button', { type: 'button', text: 'Retry synchronization', dataset: { productionAuthorityAction: 'retry-sync', graphId } }),
        node('button', { type: 'button', text: 'Create recovery branch', dataset: { productionAuthorityAction: 'create-branch', graphId } }),
        node('button', { type: 'button', text: 'Reject local & recover trusted', dataset: { productionAuthorityAction: 'recover-trusted', graphId } }),
        node('button', { type: 'button', text: 'Keep local draft', dataset: { productionAuthorityAction: 'dismiss-conflict' } })
      ]),
      node('small', { text: 'Rejected local transactions remain in immutable local history. Creating a recovery branch never rewrites the current trusted branch.' })
    ])
  ]);
  document.body.append(panel);
}

async function retrySync(graphId) {
  const adapter = trustedAdapter();
  if (!adapter?.syncGraph) throw new Error('Trusted synchronization is unavailable.');
  const result = await adapter.syncGraph(graphId);
  if (result.state === 'server-confirmed') {
    conflictState = null;
    closeConflictPanel();
    showToast('Canvas transactions are server confirmed.');
  } else {
    showToast(`Synchronization remains ${result.state}.`, 'error');
  }
}

async function recoverTrusted(graphId) {
  const adapter = trustedAdapter();
  if (!adapter?.rejectPendingAndRecover) throw new Error('Trusted recovery is unavailable.');
  if (!window.confirm('Reject unsynchronized local transactions, preserve them in immutable history, and recover the latest trusted checkpoint?')) return;
  const checkpoint = await window.EvaraStudioJournal?.latestTrustedCheckpoint?.(graphId);
  const result = await adapter.rejectPendingAndRecover({ graphId, checkpointId: checkpoint?.checkpointId || null });
  if (result) location.reload();
}

async function createRecoveryBranch(graphId) {
  const adapter = trustedAdapter();
  if (!adapter?.createBranch) throw new Error('Trusted branch creation is unavailable.');
  const checkpoint = await window.EvaraStudioJournal?.latestTrustedCheckpoint?.(graphId);
  if (!checkpoint?.checkpointId || !checkpoint?.branchId) {
    throw new Error('Create a trusted checkpoint before creating a recovery branch.');
  }
  const logicalBranchId = `recovery-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  const result = await adapter.createBranch({
    graphId,
    branchId: logicalBranchId,
    sourceBranchId: checkpoint.branchId,
    sourceCheckpointId: checkpoint.checkpointId
  });
  showToast(`Recovery branch ${result.branch?.branchId || logicalBranchId} created from trusted checkpoint ${checkpoint.checkpointId}.`);
}

async function handleAction(button) {
  const action = button.dataset.productionAuthorityAction;
  const graphId = text(button.dataset.graphId || canvasGraph()?.graphId, 220);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    if (action === 'open-canvas') await openCanvas();
    else if (action === 'retry-sync') await retrySync(graphId);
    else if (action === 'recover-trusted') await recoverTrusted(graphId);
    else if (action === 'create-branch') await createRecoveryBranch(graphId);
    else if (action === 'dismiss-conflict') closeConflictPanel();
  } catch (error) {
    showToast(error?.message || 'Studio authority action failed.', 'error');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function enhance() {
  installTrustedReleaseGuard();
  injectAuthorityBadge();
  injectMigrationNotice();
}

function boot() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-production-authority-action]');
    if (!button) return;
    event.preventDefault();
    handleAction(button);
  });
  window.addEventListener('evara:app-check-status', (event) => {
    if (event.detail?.state === 'ready') enhance();
  });
  window.addEventListener('evara:trusted-studio-journal', (event) => {
    enhance();
    if (!['conflict', 'recovery-required'].includes(event.detail?.state)) return;
    conflictState = JSON.parse(JSON.stringify(event.detail || {}));
    renderConflictPanel();
  });
  window.addEventListener('evara:canvas-session-change', enhance);
  observer = new MutationObserver(enhance);
  const root = document.querySelector('#appRoot');
  if (root) observer.observe(root, { childList: true, subtree: true });
  enhance();
}

window.EvaraStudioProductionAuthority = Object.freeze({
  version: AUTHORITY_VERSION,
  authority: 'canvas-session',
  compatibilityMode: 'migration-only',
  releaseGraphPrefix: CANVAS_GRAPH_PREFIX,
  openCanvas,
  refresh: enhance,
  snapshot: () => ({
    version: AUTHORITY_VERSION,
    authority: 'canvas-session',
    compatibilityMode: 'migration-only',
    releaseGraphPrefix: CANVAS_GRAPH_PREFIX,
    trustedAdapterGuarded: Boolean(window.EvaraTrustedStudioJournal?.productionAuthorityVersion),
    appCheck: window.EvaraAppCheckReadiness?.snapshot?.() || null,
    conflict: conflictState ? JSON.parse(JSON.stringify(conflictState)) : null
  })
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
