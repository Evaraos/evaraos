import {
  functions,
  getSavedUserProfile,
  httpsCallable
} from '../firebase.js';

const ADAPTER_VERSION = 'trusted-studio-journal-adapter-v1';
const ADAPTER_NAME = 'trusted-studio-journal';
const GRAPH_SCHEMA_VERSION = '0.1.0';
const OPERATION_PROTOCOL_VERSION = '0.1.0';
const CONFIRMED_STATE = 'server-confirmed';

const confirmations = new Map();
const branchPromises = new Map();
const graphQueues = new Map();
let installed = false;
let syncing = false;
let adapterState = 'idle';
let lastError = null;

const callables = Object.freeze({
  openBranch: httpsCallable(functions, 'openStudioBranch'),
  commitTransaction: httpsCallable(functions, 'commitStudioTransaction'),
  operationRange: httpsCallable(functions, 'getStudioOperationRange'),
  checkpoint: httpsCallable(functions, 'createStudioCheckpoint'),
  restore: httpsCallable(functions, 'restoreStudioCheckpoint'),
  createBranch: httpsCallable(functions, 'createStudioBranch'),
  closeSession: httpsCallable(functions, 'closeStudioSession'),
  prepareRelease: httpsCallable(functions, 'prepareStudioRelease')
});

function clone(value) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function clean(value, max = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
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

function profile() {
  return getSavedUserProfile?.() || null;
}

function serverBranchId(localBranchId, graphId) {
  const base = clean(localBranchId || 'local-draft', 120) || 'local-draft';
  return clean(`${base}-${digest(graphId)}`, 160);
}

function currentJournal() {
  const journal = window.EvaraStudioJournal;
  if (!journal?.appendOperationTransaction || !journal?.listOperationTransactions || !journal?.getStatus) {
    throw new Error('The canonical Studio Journal is unavailable.');
  }
  return journal;
}

async function contextFor(graphId) {
  const journal = currentJournal();
  const status = await journal.getStatus();
  const session = status.session || {};
  const user = profile();
  const companyId = clean(user?.companyId, 128);
  if (!companyId) {
    const error = new Error('A verified company scope is required before Studio transactions can sync.');
    error.code = 'company-scope-required';
    throw error;
  }
  const projectId = clean(session.projectId || 'evara-studio-visual-builder', 160);
  const branchId = serverBranchId(session.branchId || 'local-draft', graphId);
  const clientSessionId = clean(session.clientInstanceId || session.sessionId || `studio-${digest(graphId)}`, 200);
  return {
    companyId,
    projectId,
    branchId,
    graphId,
    clientSessionId,
    graphSchemaVersion: session.graphSchemaVersion || GRAPH_SCHEMA_VERSION,
    operationProtocolVersion: session.operationProtocolVersion || OPERATION_PROTOCOL_VERSION
  };
}

function unwrap(result) {
  return result?.data || result || {};
}

function errorCode(error) {
  return String(error?.details?.code || error?.code || 'server-sync-failed')
    .replace(/^functions\//, '')
    .slice(0, 120);
}

function classifyError(error) {
  const code = errorCode(error);
  if (['aborted', 'branch-head-conflict', 'graph-id-conflict', 'already-exists', 'transaction-id-reused', 'operation-id-reused'].some((item) => code.includes(item))) {
    return 'conflict';
  }
  if (['permission-denied', 'unauthenticated', 'company-scope-required', 'failed-precondition'].some((item) => code.includes(item))) {
    return 'blocked';
  }
  return 'retry-required';
}

function overlayTransaction(record) {
  const confirmation = confirmations.get(record?.transactionId);
  if (!confirmation) return clone(record);
  return {
    ...clone(record),
    durabilityState: confirmation.state === 'confirmed' ? CONFIRMED_STATE : record.durabilityState,
    serverSyncState: confirmation.state,
    serverBranchId: confirmation.branchId || null,
    serverStartSequence: confirmation.transaction?.startSequence ?? null,
    serverEndSequence: confirmation.transaction?.endSequence ?? null,
    serverTransactionHash: confirmation.transaction?.transactionHash || null,
    acceptedAtServer: confirmation.transaction?.acceptedAtServer || null,
    serverHeadRevision: confirmation.branch?.headRevision ?? null,
    serverHeadSequence: confirmation.branch?.headSequence ?? null,
    serverSyncError: confirmation.error || null,
    serverSyncCode: confirmation.code || null
  };
}

function emit(state, detail = {}) {
  adapterState = state;
  lastError = detail.error || null;
  const payload = {
    adapterVersion: ADAPTER_VERSION,
    adapterName: ADAPTER_NAME,
    state,
    at: new Date().toISOString(),
    ...detail
  };
  window.dispatchEvent(new CustomEvent('evara:studio-server-sync', { detail: payload }));
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: {
      state: state === 'confirmed' ? CONFIRMED_STATE : state === 'conflict' ? 'conflict' : 'saved-locally',
      reason: `trusted-server-${state}`,
      graphId: detail.graphId || null,
      transactionId: detail.transactionId || null,
      serverSyncState: state,
      serverSyncCode: detail.code || null,
      error: detail.error || null
    }
  }));
}

async function refreshCanvasDiagnostics() {
  const session = window.EvaraCanvasSandbox?.getSession?.();
  if (session?.refreshJournalDiagnostics) await session.refreshJournalDiagnostics().catch(() => undefined);
  window.EvaraCanvasSyncStatus?.refresh?.('trusted-server-sync');
}

async function openGraphBranch(graphId, { force = false } = {}) {
  if (!force && branchPromises.has(graphId)) return branchPromises.get(graphId);
  const pending = (async () => {
    const context = await contextFor(graphId);
    const response = unwrap(await callables.openBranch(context));
    if (!response.ok || !response.branch) throw new Error('Trusted Studio branch did not open.');
    return { context, branch: response.branch };
  })();
  branchPromises.set(graphId, pending);
  try {
    return await pending;
  } catch (error) {
    branchPromises.delete(graphId);
    throw error;
  }
}

async function syncTransaction(record) {
  if (!record?.transactionId || !record?.graphId) return null;
  const existing = confirmations.get(record.transactionId);
  if (existing?.state === 'confirmed') return overlayTransaction(record);

  emit('syncing', { graphId: record.graphId, transactionId: record.transactionId });
  try {
    const { context } = await openGraphBranch(record.graphId);
    const transaction = {
      ...clone(record),
      companyId: context.companyId,
      projectId: context.projectId,
      branchId: context.branchId,
      clientSessionId: context.clientSessionId
    };
    const response = unwrap(await callables.commitTransaction({
      companyId: context.companyId,
      projectId: context.projectId,
      branchId: context.branchId,
      transaction
    }));
    if (!response.ok || !response.transaction || !response.branch) throw new Error('Trusted Studio transaction was not confirmed.');
    confirmations.set(record.transactionId, {
      state: 'confirmed',
      branchId: context.branchId,
      transaction: clone(response.transaction),
      branch: clone(response.branch),
      idempotent: response.idempotent === true,
      confirmedAt: new Date().toISOString()
    });
    emit('confirmed', {
      graphId: record.graphId,
      transactionId: record.transactionId,
      branchId: context.branchId,
      serverStartSequence: response.transaction.startSequence,
      serverEndSequence: response.transaction.endSequence,
      serverHeadRevision: response.branch.headRevision,
      serverHeadSequence: response.branch.headSequence,
      idempotent: response.idempotent === true
    });
    await refreshCanvasDiagnostics();
    return overlayTransaction(record);
  } catch (error) {
    const state = classifyError(error);
    const code = errorCode(error);
    confirmations.set(record.transactionId, {
      state,
      code,
      error: String(error?.message || error).slice(0, 500),
      details: error?.details || null,
      failedAt: new Date().toISOString()
    });
    emit(state, {
      graphId: record.graphId,
      transactionId: record.transactionId,
      code,
      error: String(error?.message || error).slice(0, 500),
      details: error?.details || null
    });
    await refreshCanvasDiagnostics();
    return overlayTransaction(record);
  }
}

function enqueue(record) {
  const graphId = record?.graphId || 'unknown';
  const previous = graphQueues.get(graphId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => syncTransaction(record));
  graphQueues.set(graphId, next);
  next.finally(() => {
    if (graphQueues.get(graphId) === next) graphQueues.delete(graphId);
  });
  return next;
}

async function retryPending() {
  if (syncing) return [];
  syncing = true;
  try {
    const records = await window.EvaraStudioJournal.listOperationTransactions();
    const pending = records
      .filter((record) => overlayTransaction(record).durabilityState !== CONFIRMED_STATE)
      .sort((left, right) => Date.parse(left.createdAtClient || 0) - Date.parse(right.createdAtClient || 0));
    const results = [];
    for (const record of pending) results.push(await enqueue(record));
    return results;
  } finally {
    syncing = false;
  }
}

async function createCheckpoint(graphSnapshot, reason = 'trusted-checkpoint') {
  const graphId = graphSnapshot?.graphId;
  if (!graphId) throw new Error('Trusted checkpoints require a graph snapshot.');
  const { context, branch } = await openGraphBranch(graphId);
  const response = unwrap(await callables.checkpoint({
    companyId: context.companyId,
    projectId: context.projectId,
    branchId: context.branchId,
    expectedHeadRevision: branch.headRevision,
    graphSnapshot: clone(graphSnapshot),
    reason
  }));
  return response;
}

async function restoreCheckpoint(graphId, checkpointId = '') {
  const { context } = await openGraphBranch(graphId);
  return unwrap(await callables.restore({
    companyId: context.companyId,
    projectId: context.projectId,
    branchId: context.branchId,
    checkpointId: clean(checkpointId, 200) || undefined
  }));
}

async function prepareRelease(graphId, options = {}) {
  const { context } = await openGraphBranch(graphId);
  const diagnostics = await window.EvaraCanvasSandbox?.getSession?.()?.refreshJournalDiagnostics?.();
  if (diagnostics?.unsynchronizedChanges) throw new Error('Unsynchronized Studio transactions block publication.');
  return unwrap(await callables.prepareRelease({
    companyId: context.companyId,
    projectId: context.projectId,
    branchId: context.branchId,
    expectedHeadRevision: diagnostics?.headRevision,
    expectedHeadSequence: diagnostics?.headSequence,
    ...options
  }));
}

async function closeGraphSession(graphId) {
  const { context } = await openGraphBranch(graphId);
  return unwrap(await callables.closeSession({
    companyId: context.companyId,
    projectId: context.projectId,
    branchId: context.branchId,
    clientSessionId: context.clientSessionId
  }));
}

function install() {
  if (installed) return;
  const base = currentJournal();
  installed = true;

  const wrapped = Object.freeze({
    ...base,
    serverJournalAdapterVersion: ADAPTER_VERSION,
    appendOperationTransaction: async (...args) => {
      const durable = await base.appendOperationTransaction(...args);
      enqueue(durable);
      return overlayTransaction(durable);
    },
    listOperationTransactions: async (...args) => (await base.listOperationTransactions(...args)).map(overlayTransaction),
    listTransactions: async (...args) => (await base.listTransactions(...args)).map(overlayTransaction),
    getStatus: async (...args) => {
      const status = await base.getStatus(...args);
      return { ...status, transactions: status.transactions.map(overlayTransaction), serverAdapterState: adapterState };
    }
  });
  window.EvaraStudioJournal = wrapped;

  const adapter = Object.freeze({
    version: ADAPTER_VERSION,
    commit: syncTransaction,
    checkpoint: createCheckpoint,
    restore: restoreCheckpoint,
    prepareRelease,
    closeSession: closeGraphSession,
    retryPending,
    openBranch: openGraphBranch,
    serverBranchId,
    state: () => ({ state: adapterState, lastError, confirmationCount: confirmations.size })
  });
  base.registerServerAdapter?.(ADAPTER_NAME, adapter);
  window.EvaraStudioServerJournal = adapter;

  window.addEventListener('evara:session-ready', () => retryPending().catch(() => undefined));
  if (profile()?.companyId) setTimeout(() => retryPending().catch(() => undefined), 750);
}

install();
