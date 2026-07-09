const AUTHORITY_VERSION = 'studio-journal-authority-v2';
const DB_NAME = 'evaraos-studio-journal';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';
const TRANSACTION_STORE = 'transactions';
const CHECKPOINT_STORE = 'checkpoints';
const SESSION_ID = 'local-studio-session';
const OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1';
const FINAL_STATES = new Set(['server-confirmed', 'rejected']);
const PENDING_STATES = new Set(['pending-local', 'saved-locally', 'syncing', 'offline', 'conflict', 'recovery-required']);
const ALL_STATES = new Set([...FINAL_STATES, ...PENDING_STATES]);
const MAX_TRANSACTIONS = 1000;
const MAX_CHECKPOINTS = 48;

const base = window.EvaraStudioJournal;
if (!base?.initialize || !base?.appendOperationTransaction || !base?.listOperationTransactions) {
  throw new Error('The canonical Studio Journal must load before its trusted-sync authority extension.');
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, max = 220) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function integer(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    if (value[key] !== undefined) output[key] = stable(value[key]);
    return output;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(stable(value));
}

function requestComparable(record = {}, fallback = {}) {
  return {
    envelopeVersion: OPERATION_ENVELOPE_VERSION,
    transactionId: text(record.transactionId || fallback.transactionId, 180),
    graphId: text(record.graphId || fallback.graphId, 220),
    graphSchemaVersion: text(record.graphSchemaVersion || fallback.graphSchemaVersion, 80),
    operationProtocolVersion: text(record.operationProtocolVersion || fallback.operationProtocolVersion, 80),
    expectedHeadRevision: integer(record.expectedHeadRevision ?? fallback.expectedHeadRevision),
    acceptedHeadRevision: integer(record.acceptedHeadRevision ?? fallback.acceptedHeadRevision),
    intent: text(record.intent || fallback.intent, 140),
    summary: text(record.summary || fallback.summary, 500),
    semanticCommand: clone(record.semanticCommand ?? fallback.semanticCommand ?? null),
    operations: clone(record.operations ?? fallback.operations ?? []),
    inverseOperations: clone(record.inverseOperations ?? fallback.inverseOperations ?? []),
    commitOperation: clone(record.commitOperation ?? fallback.commitOperation ?? null),
    actor: clone(record.actor ?? fallback.actor ?? null),
    correlationId: text(record.correlationId || fallback.correlationId, 180) || null,
    revertsTransactionId: text(record.revertsTransactionId || fallback.revertsTransactionId, 180) || null,
    redoesTransactionId: text(record.redoesTransactionId || fallback.redoesTransactionId, 180) || null,
    affectedNodeIds: clone(record.affectedNodeIds ?? fallback.affectedNodeIds ?? []),
    affectedEdgeIds: clone(record.affectedEdgeIds ?? fallback.affectedEdgeIds ?? []),
    sourceDocumentId: text(record.sourceDocumentId || fallback.sourceDocumentId, 220) || null,
    sourceFingerprint: text(record.sourceFingerprint || fallback.sourceFingerprint, 160) || null,
    createdAtClient: text(record.createdAtClient || fallback.createdAtClient, 64),
    metadata: clone(record.metadata ?? fallback.metadata ?? {})
  };
}

function sameRequest(existing, submitted) {
  return stableStringify(requestComparable(existing)) === stableStringify(requestComparable(submitted, existing));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Studio Journal database could not open.'));
    request.onblocked = () => reject(new Error('Studio Journal database is blocked by another tab.'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Studio Journal request failed.'));
  });
}

function complete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Studio Journal transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Studio Journal transaction was aborted.'));
  });
}

async function withStores(names, mode, callback) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(names, mode);
    const stores = Object.fromEntries(names.map((name) => [name, transaction.objectStore(name)]));
    const result = await callback(stores, transaction);
    await complete(transaction);
    return result;
  } finally {
    database.close();
  }
}

async function getRecord(storeName, id) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([storeName], 'readonly');
    return await requestValue(transaction.objectStore(storeName).get(id));
  } finally {
    database.close();
  }
}

async function allRecords(storeName) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([storeName], 'readonly');
    return await requestValue(transaction.objectStore(storeName).getAll());
  } finally {
    database.close();
  }
}

async function getSessionRecord() {
  const record = await getRecord(SESSION_STORE, SESSION_ID);
  if (!record) throw new Error('Studio Journal session is unavailable.');
  return record;
}

function emit(state, reason, extra = {}) {
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: { state, durabilityState: state, reason, source: AUTHORITY_VERSION, ...extra }
  }));
}

function chronological(records = []) {
  return [...records].sort((left, right) => {
    const revision = integer(left.expectedHeadRevision) - integer(right.expectedHeadRevision);
    return revision || Date.parse(left.createdAtClient || 0) - Date.parse(right.createdAtClient || 0);
  });
}

function sequenceWidth(record) {
  return Math.max(1, Array.isArray(record.operations) ? record.operations.length : 1);
}

async function resequenceGraph(graphId, serverOverrides = new Map()) {
  const id = text(graphId, 220);
  const all = (await allRecords(TRANSACTION_STORE))
    .filter((record) => record.envelopeVersion === OPERATION_ENVELOPE_VERSION && record.graphId === id && record.durabilityState !== 'rejected');
  const records = chronological(all);
  let sequence = 0;
  let lastTransactionId = null;
  let revision = 0;
  const updates = [];

  for (const source of records) {
    const override = serverOverrides.get(source.transactionId) || null;
    const record = { ...source, ...(override || {}) };
    if (record.durabilityState === 'server-confirmed') {
      const start = integer(record.startSequence, sequence + 1);
      const end = integer(record.endSequence, start + sequenceWidth(record) - 1);
      if (start <= sequence || end < start) throw new Error(`Confirmed Studio transaction ${record.transactionId} has an invalid canonical sequence range.`);
      record.startSequence = start;
      record.endSequence = end;
      sequence = end;
    } else {
      record.startSequence = sequence + 1;
      record.endSequence = record.startSequence + sequenceWidth(record) - 1;
      sequence = record.endSequence;
    }
    revision = integer(record.acceptedHeadRevision, revision);
    lastTransactionId = record.transactionId;
    updates.push(record);
  }

  await withStores([TRANSACTION_STORE, SESSION_STORE], 'readwrite', async ({ transactions, sessions }) => {
    updates.forEach((record) => transactions.put(record));
    const session = await requestValue(sessions.get(SESSION_ID));
    const graphHeads = { ...(session?.graphHeads || {}) };
    graphHeads[id] = {
      revision,
      sequence,
      lastTransactionId,
      updatedAt: new Date().toISOString()
    };
    const pending = updates.filter((record) => !FINAL_STATES.has(record.durabilityState)).map((record) => record.transactionId);
    sessions.put({
      ...session,
      graphHeads,
      activeGraphId: id,
      activeGraphRevision: revision,
      durabilityState: pending.length ? 'saved-locally' : (updates.length ? 'server-confirmed' : 'saved-locally'),
      pendingTransactionIds: [...new Set([
        ...(session?.pendingTransactionIds || []).filter((transactionId) => !all.some((record) => record.transactionId === transactionId)),
        ...pending
      ])].slice(-MAX_TRANSACTIONS),
      updatedAt: new Date().toISOString()
    });
  });
  return { graphId: id, revision, sequence, lastTransactionId, records: updates.map(clone) };
}

async function appendOperationTransaction(rawEnvelope, options = {}) {
  await base.initialize();
  const transactionId = text(rawEnvelope?.transactionId, 180);
  if (!transactionId) throw new TypeError('Operation transaction requires transactionId.');
  const duplicate = await getRecord(TRANSACTION_STORE, transactionId);
  if (duplicate) {
    if (sameRequest(duplicate, rawEnvelope)) return clone(duplicate);
    emit('conflict', 'local-idempotency-conflict', { transactionId, graphId: duplicate.graphId, conflictCode: 'transaction-id-reused' });
    throw new Error(`Studio transaction ID ${transactionId} was reused with different content.`);
  }
  const result = await base.appendOperationTransaction(rawEnvelope, options);
  await resequenceGraph(result.graphId);
  const normalized = await getRecord(TRANSACTION_STORE, result.transactionId);
  return clone(normalized || result);
}

async function listPendingOperationTransactions(graphId = '') {
  const records = await base.listOperationTransactions(graphId);
  return chronological(records.filter((record) => !FINAL_STATES.has(record.durabilityState))).map(clone);
}

async function setDurabilityState(state, reason = 'durability-state', extra = {}) {
  if (!ALL_STATES.has(state)) throw new TypeError(`Unsupported Studio durability state: ${state}`);
  const session = await getSessionRecord();
  await withStores([SESSION_STORE], 'readwrite', async ({ sessions }) => {
    sessions.put({ ...session, durabilityState: state, updatedAt: new Date().toISOString() });
  });
  emit(state, reason, extra);
  return { ...clone(session), durabilityState: state };
}

async function markTransactionState(transactionId, state, server = {}) {
  if (!ALL_STATES.has(state)) throw new TypeError(`Unsupported Studio transaction state: ${state}`);
  const id = text(transactionId, 180);
  const existing = await getRecord(TRANSACTION_STORE, id);
  if (!existing) throw new Error(`Studio transaction not found: ${id}`);
  const updated = {
    ...existing,
    durabilityState: state,
    acceptedHeadRevision: server.acceptedHeadRevision ?? existing.acceptedHeadRevision,
    startSequence: server.startSequence ?? existing.startSequence,
    endSequence: server.endSequence ?? existing.endSequence,
    acceptedAtServer: server.acceptedAtServer ?? existing.acceptedAtServer ?? null,
    requestHash: server.requestHash ?? existing.requestHash ?? null,
    transactionHash: server.transactionHash ?? existing.transactionHash ?? null,
    syncErrorCode: server.syncErrorCode ?? null,
    syncErrorMessage: server.syncErrorMessage ? text(server.syncErrorMessage, 500) : null,
    updatedAt: new Date().toISOString()
  };
  const overrides = new Map([[id, updated]]);
  await resequenceGraph(existing.graphId, overrides);
  const result = await getRecord(TRANSACTION_STORE, id);
  const pending = await listPendingOperationTransactions(existing.graphId);
  const sessionState = state === 'conflict' || state === 'recovery-required'
    ? state
    : pending.length
      ? (state === 'offline' ? 'offline' : 'saved-locally')
      : 'server-confirmed';
  await setDurabilityState(sessionState, `transaction-${state}`, {
    transactionId: id,
    graphId: existing.graphId,
    acceptedHeadRevision: result?.acceptedHeadRevision,
    startSequence: result?.startSequence,
    endSequence: result?.endSequence,
    pendingCount: pending.length,
    conflictCode: server.syncErrorCode || null
  });
  return clone(result);
}

async function rejectTransaction(transactionId, reason = 'rejected-by-owner') {
  return markTransactionState(transactionId, 'rejected', {
    syncErrorCode: reason,
    syncErrorMessage: 'The transaction was explicitly rejected and retained in immutable local history.'
  });
}

async function recordTrustedCheckpoint({ checkpoint, graphSnapshot } = {}) {
  if (!checkpoint?.checkpointId || checkpoint.trusted !== true || !graphSnapshot) {
    throw new TypeError('Trusted checkpoint metadata and graphSnapshot are required.');
  }
  const record = {
    checkpointId: text(checkpoint.checkpointId, 200),
    checkpointType: 'canvas-graph',
    projectId: text(checkpoint.projectId, 160),
    branchId: text(checkpoint.branchId, 160),
    graphId: text(checkpoint.graphId, 220),
    graphSchemaVersion: text(checkpoint.graphSchemaVersion || graphSnapshot.schemaVersion, 80),
    revision: integer(checkpoint.revision),
    sequence: integer(checkpoint.sequence),
    reason: text(checkpoint.reason || 'trusted-checkpoint', 120),
    createdAt: checkpoint.createdAt || new Date().toISOString(),
    createdAtMs: checkpoint.createdAtMs || Date.now(),
    trusted: true,
    graphHash: text(checkpoint.graphHash, 128),
    graphSnapshot: clone(graphSnapshot),
    serverCheckpoint: clone(checkpoint)
  };
  await withStores([CHECKPOINT_STORE, SESSION_STORE], 'readwrite', async ({ checkpoints, sessions }) => {
    checkpoints.put(record);
    const session = await requestValue(sessions.get(SESSION_ID));
    sessions.put({ ...session, latestCheckpointId: record.checkpointId, updatedAt: new Date().toISOString() });
  });
  await pruneCheckpoints();
  emit('server-confirmed', 'trusted-checkpoint-recorded', {
    checkpointId: record.checkpointId,
    graphId: record.graphId,
    revision: record.revision,
    sequence: record.sequence
  });
  return clone(record);
}

async function latestTrustedCheckpoint(graphId = '') {
  const id = text(graphId, 220);
  const records = (await base.listCheckpoints())
    .filter((record) => record.trusted === true && record.checkpointType === 'canvas-graph' && (!id || record.graphId === id))
    .sort((left, right) => integer(right.sequence) - integer(left.sequence) || Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
  return records[0] ? clone(records[0]) : null;
}

async function importServerTransactions(records = []) {
  if (!Array.isArray(records)) throw new TypeError('Server transactions must be an array.');
  const byGraph = new Map();
  for (const raw of records) {
    if (!raw?.transactionId || raw.envelopeVersion !== OPERATION_ENVELOPE_VERSION) throw new TypeError('Server transaction envelope is invalid.');
    const existing = await getRecord(TRANSACTION_STORE, text(raw.transactionId, 180));
    if (existing && !sameRequest(existing, raw)) throw new Error(`Server transaction ${raw.transactionId} conflicts with local history.`);
    const record = { ...(existing || {}), ...clone(raw), durabilityState: 'server-confirmed' };
    await withStores([TRANSACTION_STORE], 'readwrite', async ({ transactions }) => transactions.put(record));
    if (!byGraph.has(record.graphId)) byGraph.set(record.graphId, new Map());
    byGraph.get(record.graphId).set(record.transactionId, record);
  }
  for (const [graphId, overrides] of byGraph) await resequenceGraph(graphId, overrides);
  return records.length;
}

async function installRecoveryPlan({ checkpoint, graphSnapshot, transactions = [] } = {}) {
  const trusted = await recordTrustedCheckpoint({ checkpoint, graphSnapshot });
  await importServerTransactions(transactions);
  await setDurabilityState('server-confirmed', 'trusted-recovery-installed', {
    checkpointId: trusted.checkpointId,
    graphId: trusted.graphId,
    revision: trusted.revision,
    sequence: trusted.sequence
  });
  return { checkpoint: trusted, transactionCount: transactions.length };
}

async function pruneTransactions() {
  const records = await allRecords(TRANSACTION_STORE);
  if (records.length <= MAX_TRANSACTIONS) return;
  const protectedIds = new Set(records.filter((record) => !FINAL_STATES.has(record.durabilityState)).map((record) => record.transactionId));
  const removable = records
    .filter((record) => !protectedIds.has(record.transactionId))
    .sort((left, right) => Date.parse(right.createdAtClient || 0) - Date.parse(left.createdAtClient || 0))
    .slice(Math.max(0, MAX_TRANSACTIONS - protectedIds.size));
  const remove = new Set(removable.map((record) => record.transactionId));
  if (!remove.size) return;
  await withStores([TRANSACTION_STORE], 'readwrite', async ({ transactions }) => remove.forEach((id) => transactions.delete(id)));
}

async function pruneCheckpoints() {
  const records = await allRecords(CHECKPOINT_STORE);
  if (records.length <= MAX_CHECKPOINTS) return;
  const trusted = records.filter((record) => record.trusted === true);
  const local = records.filter((record) => record.trusted !== true)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
  const keepLocal = Math.max(0, MAX_CHECKPOINTS - trusted.length);
  const remove = local.slice(keepLocal);
  if (!remove.length) return;
  await withStores([CHECKPOINT_STORE], 'readwrite', async ({ checkpoints }) => remove.forEach((record) => checkpoints.delete(record.checkpointId)));
}

async function getAuthorityStatus() {
  const [status, pending] = await Promise.all([base.getStatus(), listPendingOperationTransactions()]);
  return {
    ...status,
    pendingTransactions: pending,
    authorityVersion: AUTHORITY_VERSION
  };
}

const extended = Object.freeze({
  ...base,
  authorityVersion: AUTHORITY_VERSION,
  appendOperationTransaction,
  listPendingOperationTransactions,
  setDurabilityState,
  markTransactionState,
  rejectTransaction,
  recordTrustedCheckpoint,
  latestTrustedCheckpoint,
  importServerTransactions,
  installRecoveryPlan,
  resequenceGraphTransactions: resequenceGraph,
  getAuthorityStatus,
  getLocalSession: getSessionRecord,
  pruneConfirmedTransactions: pruneTransactions
});

window.EvaraStudioJournal = extended;
base.initialize()
  .then(async () => {
    const records = await base.listOperationTransactions();
    const graphIds = [...new Set(records.map((record) => record.graphId).filter(Boolean))];
    for (const graphId of graphIds) await resequenceGraph(graphId);
    await pruneTransactions();
    emit('saved-locally', 'journal-authority-ready', { authorityVersion: AUTHORITY_VERSION });
  })
  .catch((error) => emit('recovery-required', 'journal-authority-initialize', { error: text(error?.message || error, 500) }));
