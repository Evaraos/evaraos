import {
  auth,
  functions,
  httpsCallable,
  onAuthStateChanged
} from '../firebase.js';

const ADAPTER_NAME = 'trusted-studio-journal';
const ADAPTER_VERSION = 'trusted-studio-journal-v2';
const GRAPH_SCHEMA_VERSION = '0.1.0';
const OPERATION_PROTOCOL_VERSION = '0.1.0';

const callables = Object.freeze({
  openBranch: httpsCallable(functions, 'openStudioBranch'),
  commit: httpsCallable(functions, 'commitStudioTransaction'),
  operationRange: httpsCallable(functions, 'getStudioOperationRange'),
  checkpoint: httpsCallable(functions, 'createStudioCheckpoint'),
  restore: httpsCallable(functions, 'restoreStudioCheckpoint'),
  createBranch: httpsCallable(functions, 'createStudioBranch'),
  closeSession: httpsCallable(functions, 'closeStudioSession'),
  release: httpsCallable(functions, 'prepareStudioRelease')
});

const graphQueues = new Map();
const openedBranches = new Map();
let syncTimer = 0;
let lastError = null;
let authenticatedUser = auth.currentUser || null;
let resolveInitialAuth;
const initialAuth = new Promise((resolve) => { resolveInitialAuth = resolve; });
let initialAuthResolved = false;

function journal() {
  const api = window.EvaraStudioJournal;
  if (!api?.authorityVersion || !api?.listPendingOperationTransactions || !api?.markTransactionState) {
    throw new Error('The trusted-sync Studio Journal authority is unavailable.');
  }
  return api;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, max = 300) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function cleanId(value, max = 160) {
  return text(value, max)
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function digest(value) {
  const input = String(value || 'graph');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function branchIdForGraph(logicalBranchId, graphId) {
  const branch = cleanId(logicalBranchId || 'local-draft', 120) || 'local-draft';
  const graph = cleanId(graphId, 220);
  if (!graph) throw new TypeError('Trusted Studio branch scope requires graphId.');
  return cleanId(`${branch}--g-${digest(graph)}`, 160);
}

function errorCode(error) {
  return text(error?.details?.code || error?.code || error?.name || 'unknown', 120).replace(/^functions\//, '');
}

function errorDetails(error) {
  return error?.details && typeof error.details === 'object' ? clone(error.details) : {};
}

function isConflict(error) {
  const code = errorCode(error);
  return ['aborted', 'already-exists', 'branch-head-conflict', 'transaction-id-reused', 'operation-id-reused', 'graph-id-conflict'].includes(code)
    || ['branch-head-conflict', 'transaction-id-reused', 'operation-id-reused', 'graph-id-conflict'].includes(error?.details?.code);
}

function isServiceUnavailable(error) {
  const code = errorCode(error);
  return !navigator.onLine || [
    'unavailable',
    'deadline-exceeded',
    'network-request-failed',
    'not-found',
    'unimplemented'
  ].includes(code);
}

function emit(state, reason, extra = {}) {
  window.dispatchEvent(new CustomEvent('evara:trusted-studio-journal', {
    detail: { state, reason, adapterVersion: ADAPTER_VERSION, ...extra }
  }));
}

async function requireAuthenticatedUser() {
  if (auth.currentUser) return auth.currentUser;
  const user = await initialAuth;
  if (!user) throw Object.assign(new Error('An authenticated Studio session is required for trusted synchronization.'), { code: 'unauthenticated' });
  return user;
}

async function baseContext() {
  await requireAuthenticatedUser();
  const session = await journal().getLocalSession();
  return {
    companyId: session.companyId && session.companyId !== 'local-prototype' ? session.companyId : undefined,
    projectId: cleanId(session.projectId || 'evara-studio-visual-builder', 160),
    logicalBranchId: cleanId(session.branchId || 'local-draft', 120),
    clientSessionId: cleanId(session.clientInstanceId || session.sessionId, 200),
    graphSchemaVersion: session.graphSchemaVersion || GRAPH_SCHEMA_VERSION,
    operationProtocolVersion: session.operationProtocolVersion || OPERATION_PROTOCOL_VERSION
  };
}

async function context(graphId, logicalBranchId = '') {
  const graph = cleanId(graphId, 220);
  if (!graph) throw new TypeError('Trusted Studio synchronization requires graphId.');
  const base = await baseContext();
  return {
    ...base,
    graphId: graph,
    branchId: branchIdForGraph(logicalBranchId || base.logicalBranchId, graph)
  };
}

async function refreshCanvasDiagnostics() {
  const session = window.EvaraCanvasSandbox?.getSession?.();
  if (session?.refreshJournalDiagnostics) await session.refreshJournalDiagnostics().catch(() => undefined);
  window.EvaraCanvasSyncStatus?.refresh?.('trusted-journal-state');
}

async function openGraph(graphId, { force = false, logicalBranchId = '' } = {}) {
  const id = cleanId(graphId, 220);
  if (!id) throw new TypeError('Trusted Studio branches require graphId.');
  const ctx = await context(id, logicalBranchId);
  const cacheKey = `${ctx.branchId}:${id}`;
  if (!force && openedBranches.has(cacheKey)) return clone(openedBranches.get(cacheKey));
  const response = await callables.openBranch({
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    branchId: ctx.branchId,
    graphId: id,
    clientSessionId: ctx.clientSessionId,
    graphSchemaVersion: ctx.graphSchemaVersion,
    operationProtocolVersion: ctx.operationProtocolVersion
  });
  const result = response.data;
  openedBranches.set(cacheKey, result.branch);
  emit('server-confirmed', 'branch-opened', {
    graphId: id,
    logicalBranchId: ctx.logicalBranchId,
    serverBranchId: ctx.branchId,
    branch: result.branch
  });
  return clone(result.branch);
}

async function commitOne(record) {
  const api = journal();
  const ctx = await context(record.graphId);
  const cacheKey = `${ctx.branchId}:${ctx.graphId}`;
  await api.markTransactionState(record.transactionId, 'syncing');
  await refreshCanvasDiagnostics();
  emit('syncing', 'transaction-syncing', {
    graphId: record.graphId,
    transactionId: record.transactionId,
    serverBranchId: ctx.branchId
  });
  try {
    await openGraph(record.graphId);
    const response = await callables.commit({
      companyId: ctx.companyId,
      projectId: ctx.projectId,
      branchId: ctx.branchId,
      transaction: {
        ...clone(record),
        clientSessionId: ctx.clientSessionId,
        companyId: undefined,
        projectId: ctx.projectId,
        branchId: ctx.branchId
      }
    });
    const result = response.data;
    const confirmed = await api.markTransactionState(record.transactionId, 'server-confirmed', result.transaction || {});
    openedBranches.set(cacheKey, result.branch);
    await refreshCanvasDiagnostics();
    emit('server-confirmed', result.idempotent ? 'transaction-idempotent' : 'transaction-confirmed', {
      graphId: record.graphId,
      transactionId: record.transactionId,
      serverBranchId: ctx.branchId,
      transaction: confirmed,
      branch: result.branch,
      idempotent: Boolean(result.idempotent)
    });
    return { ok: true, idempotent: Boolean(result.idempotent), transaction: confirmed, branch: result.branch };
  } catch (error) {
    lastError = error;
    const details = errorDetails(error);
    if (isConflict(error)) {
      await api.markTransactionState(record.transactionId, 'conflict', {
        syncErrorCode: details.code || errorCode(error),
        syncErrorMessage: error.message
      });
      emit('conflict', 'transaction-conflict', {
        graphId: record.graphId,
        transactionId: record.transactionId,
        serverBranchId: ctx.branchId,
        conflict: details,
        error: text(error.message, 500)
      });
    } else if (isServiceUnavailable(error)) {
      await api.markTransactionState(record.transactionId, 'offline', {
        syncErrorCode: errorCode(error),
        syncErrorMessage: error.message
      });
      emit('offline', 'trusted-service-unavailable', {
        graphId: record.graphId,
        transactionId: record.transactionId,
        serverBranchId: ctx.branchId,
        error: text(error.message, 500),
        serviceCode: errorCode(error)
      });
    } else {
      await api.markTransactionState(record.transactionId, 'recovery-required', {
        syncErrorCode: errorCode(error),
        syncErrorMessage: error.message
      });
      emit('recovery-required', 'transaction-rejected-by-server', {
        graphId: record.graphId,
        transactionId: record.transactionId,
        serverBranchId: ctx.branchId,
        error: text(error.message, 500),
        details
      });
    }
    await refreshCanvasDiagnostics();
    throw error;
  }
}

async function synchronizeGraph(graphId) {
  const id = cleanId(graphId, 220);
  const previous = graphQueues.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    await requireAuthenticatedUser();
    if (!navigator.onLine) {
      await journal().setDurabilityState('offline', 'browser-offline', { graphId: id });
      await refreshCanvasDiagnostics();
      return { graphId: id, synced: 0, pending: (await journal().listPendingOperationTransactions(id)).length, state: 'offline' };
    }
    let synced = 0;
    let records = await journal().listPendingOperationTransactions(id);
    for (const record of records) {
      if (record.durabilityState === 'conflict' || record.durabilityState === 'recovery-required') break;
      await commitOne(record);
      synced += 1;
    }
    records = await journal().listPendingOperationTransactions(id);
    const state = records.some((record) => record.durabilityState === 'conflict')
      ? 'conflict'
      : records.some((record) => record.durabilityState === 'recovery-required')
        ? 'recovery-required'
        : records.some((record) => record.durabilityState === 'offline')
          ? 'offline'
          : records.length
            ? 'saved-locally'
            : 'server-confirmed';
    await journal().setDurabilityState(state, 'graph-sync-complete', { graphId: id, synced, pendingCount: records.length });
    await refreshCanvasDiagnostics();
    emit(state, 'graph-sync-complete', { graphId: id, synced, pendingCount: records.length });
    return { graphId: id, synced, pending: records.length, state };
  });
  graphQueues.set(id, next.finally(() => {
    if (graphQueues.get(id) === next) graphQueues.delete(id);
  }));
  return next;
}

async function synchronizePending(graphId = '') {
  await requireAuthenticatedUser();
  const pending = await journal().listPendingOperationTransactions(graphId);
  const graphIds = [...new Set(pending.map((record) => record.graphId).filter(Boolean))];
  const results = [];
  for (const id of graphIds) results.push(await synchronizeGraph(id));
  return results;
}

function scheduleSync(graphId = '') {
  if (!authenticatedUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const task = graphId ? synchronizeGraph(graphId) : synchronizePending();
    task.catch(() => undefined);
  }, 120);
}

async function createTrustedCheckpoint(graphSnapshot, reason = 'trusted-checkpoint') {
  if (!graphSnapshot?.graphId) throw new TypeError('Trusted checkpoints require an Evara Graph snapshot.');
  await synchronizeGraph(graphSnapshot.graphId);
  const pending = await journal().listPendingOperationTransactions(graphSnapshot.graphId);
  if (pending.length) throw new Error('Unsynchronized Canvas transactions must be resolved before creating a trusted checkpoint.');
  const ctx = await context(graphSnapshot.graphId);
  const response = await callables.checkpoint({
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    branchId: ctx.branchId,
    graphId: graphSnapshot.graphId,
    expectedHeadRevision: graphSnapshot.revision,
    graphSnapshot: clone(graphSnapshot),
    reason
  });
  const checkpoint = await journal().recordTrustedCheckpoint({
    checkpoint: { ...response.data.checkpoint, projectId: ctx.projectId, branchId: ctx.branchId },
    graphSnapshot
  });
  await refreshCanvasDiagnostics();
  emit('server-confirmed', 'trusted-checkpoint-created', {
    graphId: graphSnapshot.graphId,
    serverBranchId: ctx.branchId,
    checkpoint
  });
  return checkpoint;
}

async function restoreTrustedCheckpoint({ graphId, checkpointId = null } = {}) {
  const ctx = await context(graphId);
  const response = await callables.restore({
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    branchId: ctx.branchId,
    graphId,
    checkpointId
  });
  const plan = response.data;
  await journal().installRecoveryPlan({
    checkpoint: { ...plan.checkpoint, projectId: ctx.projectId, branchId: ctx.branchId },
    graphSnapshot: plan.graphSnapshot,
    transactions: plan.transactions || []
  });
  await refreshCanvasDiagnostics();
  emit('server-confirmed', 'trusted-recovery-ready', {
    graphId: plan.branch?.graphId || graphId,
    serverBranchId: ctx.branchId,
    checkpointId: plan.checkpoint?.checkpointId,
    operationCount: plan.operations?.length || 0,
    transactionCount: plan.transactions?.length || 0
  });
  return clone(plan);
}

async function rejectPendingAndRecover({ graphId, checkpointId = null } = {}) {
  const pending = await journal().listPendingOperationTransactions(graphId);
  for (const record of pending) await journal().rejectTransaction(record.transactionId, 'owner-trusted-recovery');
  return restoreTrustedCheckpoint({ graphId, checkpointId });
}

async function prepareImmutableRelease(graphSnapshot, { releaseId = null } = {}) {
  if (!graphSnapshot?.graphId) throw new TypeError('Immutable releases require an Evara Graph snapshot.');
  await synchronizeGraph(graphSnapshot.graphId);
  const pending = await journal().listPendingOperationTransactions(graphSnapshot.graphId);
  if (pending.length) throw new Error('Unsynchronized Canvas transactions block publication.');
  const checkpoint = await createTrustedCheckpoint(graphSnapshot, 'pre-release-checkpoint');
  const ctx = await context(graphSnapshot.graphId);
  const response = await callables.release({
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    branchId: ctx.branchId,
    releaseId,
    graphId: graphSnapshot.graphId,
    checkpointId: checkpoint.checkpointId,
    expectedHeadRevision: graphSnapshot.revision,
    pendingTransactionIds: []
  });
  emit('server-confirmed', 'immutable-release-prepared', {
    graphId: graphSnapshot.graphId,
    serverBranchId: ctx.branchId,
    checkpointId: checkpoint.checkpointId,
    release: response.data.release,
    idempotent: Boolean(response.data.idempotent)
  });
  return clone(response.data);
}

async function getOperationRange(options = {}) {
  const graphId = cleanId(options.graphId || window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().graphId, 220);
  if (!graphId) throw new TypeError('Operation range queries require graphId.');
  const ctx = await context(graphId);
  const response = await callables.operationRange({
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    branchId: ctx.branchId,
    ...clone(options),
    graphId
  });
  return clone(response.data);
}

async function createBranch(options = {}) {
  const graphId = cleanId(options.graphId, 220);
  if (!graphId) throw new TypeError('Creating a Studio branch requires graphId.');
  const base = await baseContext();
  const logicalBranchId = cleanId(options.branchId || `branch-${Date.now().toString(36)}`, 120);
  const sourceLogicalBranchId = cleanId(options.sourceBranchId, 120);
  const response = await callables.createBranch({
    companyId: base.companyId,
    projectId: base.projectId,
    ...clone(options),
    graphId,
    branchId: branchIdForGraph(logicalBranchId, graphId),
    sourceBranchId: sourceLogicalBranchId ? branchIdForGraph(sourceLogicalBranchId, graphId) : undefined
  });
  return clone(response.data);
}

async function closeCurrentSession(graphId = '') {
  if (!auth.currentUser) return { ok: false, reason: 'not-authenticated' };
  const id = cleanId(graphId || window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().graphId, 220);
  if (!id) return { ok: false, reason: 'graph-id-required' };
  const ctx = await context(id);
  const response = await callables.closeSession({
    companyId: ctx.companyId,
    projectId: ctx.projectId,
    branchId: ctx.branchId,
    graphId: id,
    clientSessionId: ctx.clientSessionId
  });
  return clone(response.data);
}

const adapter = Object.freeze({
  version: ADAPTER_VERSION,
  commit: commitOne,
  checkpoint: createTrustedCheckpoint,
  open: openGraph,
  sync: synchronizePending,
  syncGraph: synchronizeGraph,
  restore: restoreTrustedCheckpoint,
  rejectPendingAndRecover,
  release: prepareImmutableRelease,
  getOperationRange,
  createBranch,
  closeSession: closeCurrentSession,
  branchIdForGraph,
  snapshot: () => ({
    name: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    authenticated: Boolean(authenticatedUser),
    online: navigator.onLine,
    openBranches: [...openedBranches.entries()].map(([key, branch]) => ({ key, branchId: branch?.branchId || null, graphId: branch?.graphId || null })),
    syncingGraphIds: [...graphQueues.keys()],
    lastError: lastError ? { code: errorCode(lastError), message: text(lastError.message, 500), details: errorDetails(lastError) } : null
  })
});

journal().registerServerAdapter(ADAPTER_NAME, adapter);
window.EvaraTrustedStudioJournal = adapter;

onAuthStateChanged(auth, (user) => {
  authenticatedUser = user || null;
  if (!initialAuthResolved) {
    initialAuthResolved = true;
    resolveInitialAuth(authenticatedUser);
  }
  if (authenticatedUser) scheduleSync();
});

window.addEventListener('evara:studio-operation-durable', (event) => {
  const graphId = event.detail?.graphId;
  if (graphId) scheduleSync(graphId);
});
window.addEventListener('online', () => scheduleSync());
window.addEventListener('offline', () => journal().setDurabilityState('offline', 'browser-offline').catch(() => undefined));
window.addEventListener('evara:session-ready', () => scheduleSync());
window.addEventListener('pagehide', () => {
  const graphId = window.EvaraCanvasSandbox?.getSession?.()?.snapshot?.().graphId || '';
  closeCurrentSession(graphId).catch(() => undefined);
}, { once: true });

journal().initialize()
  .then(() => {
    if (auth.currentUser) scheduleSync();
  })
  .catch((error) => emit('recovery-required', 'trusted-adapter-initialize', { error: text(error?.message || error, 500) }));
