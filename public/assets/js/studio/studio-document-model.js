const DB_NAME = 'evaraos-studio-journal';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';
const TRANSACTION_STORE = 'transactions';
const CHECKPOINT_STORE = 'checkpoints';
const SESSION_ID = 'local-studio-session';
const LEGACY_CONTENT_KEY = 'evaraos-studio-visual-builder-v1';
const LEGACY_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1';
const LEGACY_LIVE_KEY = 'evaraos-studio-visual-builder-live-v1';
const OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1';
const AUTOSAVE_DELAY = 320;
const MAX_TRANSACTIONS = 120;
const MAX_CHECKPOINTS = 12;

const nativeGetItem = Storage.prototype.getItem;
const nativeSetItem = Storage.prototype.setItem;
const serverAdapters = new Map();
let databasePromise = null;
let readyPromise = null;
let saveTimer = 0;
let pendingReason = 'system';
let lastProjectionHash = '';
let sessionCache = null;

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const safeParse = (value, fallback = null) => {
  try { return JSON.parse(value); }
  catch { return fallback; }
};
const text = (value, max = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const integer = (value, fallback = 0) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

function readLegacyProjection() {
  return {
    content: safeParse(nativeGetItem.call(localStorage, LEGACY_CONTENT_KEY)),
    layout: safeParse(nativeGetItem.call(localStorage, LEGACY_LAYOUT_KEY)),
    capturedAt: now()
  };
}

function normalizeProjection(raw) {
  const content = raw?.content && typeof raw.content === 'object' ? clone(raw.content) : null;
  const layout = raw?.layout && typeof raw.layout === 'object' ? clone(raw.layout) : { version: 1, pages: {} };
  return { content, layout, capturedAt: text(raw?.capturedAt || now(), 64) };
}

function projectionHash(projection) {
  const value = JSON.stringify({ content: projection.content, layout: projection.layout });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${value.length}`;
}

function defaultSession() {
  const timestamp = now();
  return {
    sessionId: SESSION_ID,
    companyId: 'local-prototype',
    projectId: 'evara-studio-visual-builder',
    branchId: 'local-draft',
    graphId: 'legacy-compatibility-projection',
    graphSchemaVersion: '0.1.0',
    operationProtocolVersion: '0.1.0',
    operationEnvelopeVersion: OPERATION_ENVELOPE_VERSION,
    graphHeads: {},
    activeGraphId: null,
    activeGraphRevision: 0,
    headRevision: 0,
    headSequence: 0,
    latestCheckpointId: null,
    clientInstanceId: uid('client'),
    collaborationMode: 'single_writer',
    durabilityState: 'saved-locally',
    pendingTransactionIds: [],
    openedAt: timestamp,
    lastRecoveredAt: null,
    actor: { id: 'local-owner', type: 'migration', role: 'owner' },
    viewport: { device: 'desktop', width: 1440, height: 900, zoom: 1, panX: 0, panY: 0 },
    previewContext: { role: 'owner', themeMode: null, environment: 'draft' },
    updatedAt: timestamp
  };
}

function normalizeSession(raw) {
  const fallback = defaultSession();
  const graphHeads = {};
  if (raw?.graphHeads && typeof raw.graphHeads === 'object' && !Array.isArray(raw.graphHeads)) {
    Object.entries(raw.graphHeads).slice(0, 100).forEach(([graphId, head]) => {
      const id = text(graphId, 220);
      if (!id) return;
      graphHeads[id] = {
        revision: integer(head?.revision),
        sequence: integer(head?.sequence),
        lastTransactionId: text(head?.lastTransactionId, 180) || null,
        updatedAt: text(head?.updatedAt, 64) || null
      };
    });
  }
  return {
    ...fallback,
    ...(raw && typeof raw === 'object' ? clone(raw) : {}),
    sessionId: SESSION_ID,
    operationEnvelopeVersion: OPERATION_ENVELOPE_VERSION,
    graphHeads,
    activeGraphId: text(raw?.activeGraphId, 220) || null,
    activeGraphRevision: integer(raw?.activeGraphRevision),
    headRevision: integer(raw?.headRevision),
    headSequence: integer(raw?.headSequence),
    pendingTransactionIds: Array.isArray(raw?.pendingTransactionIds)
      ? raw.pendingTransactionIds.map((item) => text(item, 180)).filter(Boolean).slice(-MAX_TRANSACTIONS)
      : []
  };
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' });
      if (!db.objectStoreNames.contains(TRANSACTION_STORE)) {
        const store = db.createObjectStore(TRANSACTION_STORE, { keyPath: 'transactionId' });
        store.createIndex('createdAtClient', 'createdAtClient');
        store.createIndex('expectedHeadRevision', 'expectedHeadRevision');
      }
      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
        const store = db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'checkpointId' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('revision', 'revision');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Studio journal database could not open.'));
    request.onblocked = () => reject(new Error('Studio journal database upgrade is blocked by another tab.'));
  });
  return databasePromise;
}

async function transact(storeNames, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    let result;
    try { result = callback(stores, transaction); }
    catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('Studio journal transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Studio journal transaction was aborted.'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSession() {
  if (sessionCache) return clone(sessionCache);
  const db = await openDatabase();
  const transaction = db.transaction([SESSION_STORE], 'readonly');
  const session = await requestValue(transaction.objectStore(SESSION_STORE).get(SESSION_ID));
  sessionCache = normalizeSession(session || defaultSession());
  if (!session) await putSession(sessionCache);
  return clone(sessionCache);
}

async function putSession(session) {
  sessionCache = normalizeSession(session);
  await transact([SESSION_STORE], 'readwrite', ({ sessions }) => sessions.put(clone(sessionCache)));
  return clone(sessionCache);
}

async function getAll(storeName) {
  const db = await openDatabase();
  const transaction = db.transaction([storeName], 'readonly');
  return requestValue(transaction.objectStore(storeName).getAll());
}

async function getRecord(storeName, id) {
  const db = await openDatabase();
  const transaction = db.transaction([storeName], 'readonly');
  return requestValue(transaction.objectStore(storeName).get(id));
}

async function pruneStore(storeName, idField, maximum) {
  const records = await getAll(storeName);
  if (records.length <= maximum) return;
  const sorted = records.sort((a, b) => Date.parse(b.createdAtClient || b.createdAt || 0) - Date.parse(a.createdAtClient || a.createdAt || 0));
  const remove = sorted.slice(maximum);
  await transact([storeName], 'readwrite', (stores) => {
    remove.forEach((record) => stores[storeName].delete(record[idField]));
  });
}

function semanticIntent(reason) {
  if (reason.includes('layout')) return 'canvas.layout.set';
  if (reason.includes('content')) return 'canvas.property.set';
  if (reason.includes('restore')) return 'history.undo';
  if (reason.includes('checkpoint')) return 'checkpoint.create';
  if (reason.includes('migration')) return 'migration.apply';
  return 'system';
}

function transactionEnvelope(session, projection, previousProjection, reason) {
  const transactionId = uid('transaction');
  const operationId = uid('operation');
  const inverseId = uid('operation');
  return {
    envelopeVersion: 'compatibility-projection-v1',
    transactionId,
    companyId: session.companyId,
    projectId: session.projectId,
    branchId: session.branchId,
    graphId: session.graphId,
    expectedHeadRevision: session.headRevision,
    acceptedHeadRevision: null,
    startSequence: null,
    endSequence: null,
    intent: semanticIntent(reason),
    summary: text(`Compatibility projection: ${reason}`, 500),
    operations: [{
      operationId,
      type: 'compatibility.projection.replace',
      targetId: session.graphId,
      payload: normalizeProjection(projection)
    }],
    inverseOperations: previousProjection ? [{
      operationId: inverseId,
      type: 'compatibility.projection.replace',
      targetId: session.graphId,
      payload: normalizeProjection(previousProjection)
    }] : [],
    actor: clone(session.actor),
    clientSessionId: session.sessionId,
    correlationId: null,
    revertsTransactionId: null,
    redoesTransactionId: null,
    affectedNodeIds: [],
    createdAtClient: now(),
    durabilityState: 'saved-locally',
    projectionHash: projectionHash(projection)
  };
}

function normalizeProtocolOperation(operation, graphId, transactionId) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new TypeError('Journal operations must be objects.');
  const operationId = text(operation.operationId, 180);
  const type = text(operation.type, 120);
  if (!operationId || !type) throw new TypeError('Journal operations require operationId and type.');
  if (text(operation.graphId, 220) !== graphId) throw new Error(`Operation ${operationId} targets a different graph.`);
  if (text(operation.transactionId, 180) !== transactionId) throw new Error(`Operation ${operationId} has a mismatched transactionId.`);
  return clone(operation);
}

function normalizeOperationEnvelope(raw, session, projection = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Operation transaction envelope must be an object.');
  const transactionId = text(raw.transactionId, 180);
  const graphId = text(raw.graphId, 220);
  const expectedHeadRevision = integer(raw.expectedHeadRevision, -1);
  const acceptedHeadRevision = integer(raw.acceptedHeadRevision, -1);
  if (!transactionId || !graphId) throw new TypeError('Operation transaction requires transactionId and graphId.');
  if (expectedHeadRevision < 0 || acceptedHeadRevision < expectedHeadRevision) throw new Error('Operation transaction revisions are invalid.');
  const operations = Array.isArray(raw.operations)
    ? raw.operations.map((operation) => normalizeProtocolOperation(operation, graphId, transactionId))
    : [];
  if (!operations.length) throw new Error('Operation transaction requires at least one accepted operation.');
  const inverseOperations = Array.isArray(raw.inverseOperations)
    ? raw.inverseOperations.map((operation) => normalizeProtocolOperation(operation, graphId, transactionId))
    : [];
  const commitOperation = normalizeProtocolOperation(raw.commitOperation, graphId, transactionId);
  if (commitOperation.type !== 'transaction.commit') throw new Error('Operation transaction requires a transaction.commit operation.');
  const normalizedProjection = projection ? normalizeProjection(projection) : null;
  return {
    envelopeVersion: OPERATION_ENVELOPE_VERSION,
    transactionId,
    companyId: session.companyId,
    projectId: session.projectId,
    branchId: session.branchId,
    graphId,
    graphSchemaVersion: text(raw.graphSchemaVersion || operations[0]?.graphSchemaVersion || session.graphSchemaVersion, 80),
    operationProtocolVersion: text(raw.operationProtocolVersion || operations[0]?.protocolVersion || session.operationProtocolVersion, 80),
    expectedHeadRevision,
    acceptedHeadRevision,
    startSequence: integer(raw.startSequence, 0),
    endSequence: integer(raw.endSequence, 0),
    intent: text(raw.intent || raw.semanticCommand?.type || operations[0]?.metadata?.semanticIntent || 'system', 140),
    summary: text(raw.summary || `Studio operation transaction ${transactionId}`, 500),
    semanticCommand: raw.semanticCommand && typeof raw.semanticCommand === 'object' ? clone(raw.semanticCommand) : null,
    operations,
    inverseOperations,
    commitOperation,
    actor: raw.actor && typeof raw.actor === 'object' ? clone(raw.actor) : clone(session.actor),
    clientSessionId: session.sessionId,
    correlationId: text(raw.correlationId || operations[0]?.correlationId, 180) || null,
    revertsTransactionId: text(raw.revertsTransactionId, 180) || null,
    redoesTransactionId: text(raw.redoesTransactionId, 180) || null,
    affectedNodeIds: Array.isArray(raw.affectedNodeIds)
      ? [...new Set(raw.affectedNodeIds.map((item) => text(item, 180)).filter(Boolean))].slice(0, 5000)
      : [],
    sourceDocumentId: text(raw.sourceDocumentId, 220) || null,
    sourceFingerprint: text(raw.sourceFingerprint, 120) || null,
    createdAtClient: text(raw.createdAtClient || now(), 64),
    durabilityState: 'saved-locally',
    projectionHash: normalizedProjection ? projectionHash(normalizedProjection) : null
  };
}

async function latestCheckpoint() {
  const checkpoints = await listCheckpoints();
  return checkpoints[0] || null;
}

async function appendTransaction(reason = 'system', options = {}) {
  await initialize();
  const projection = normalizeProjection(options.projection || readLegacyProjection());
  const hash = projectionHash(projection);
  if (!options.force && hash === lastProjectionHash) return null;
  const session = await getSession();
  const previous = options.previousProjection || (await latestCheckpoint())?.projection || null;
  const envelope = transactionEnvelope(session, projection, previous, reason);
  const nextSession = {
    ...session,
    headRevision: session.headRevision + 1,
    headSequence: session.headSequence + 1,
    durabilityState: 'saved-locally',
    pendingTransactionIds: [...session.pendingTransactionIds, envelope.transactionId].slice(-MAX_TRANSACTIONS),
    updatedAt: now()
  };
  await transact([TRANSACTION_STORE, SESSION_STORE], 'readwrite', ({ transactions, sessions }) => {
    transactions.put(envelope);
    sessions.put(nextSession);
  });
  sessionCache = normalizeSession(nextSession);
  lastProjectionHash = hash;
  await pruneStore(TRANSACTION_STORE, 'transactionId', MAX_TRANSACTIONS);
  dispatchStatus('saved-locally', reason, { transactionId: envelope.transactionId, envelopeVersion: envelope.envelopeVersion });
  return clone(envelope);
}

async function appendOperationTransaction(rawEnvelope, options = {}) {
  await initialize();
  const duplicate = await getRecord(TRANSACTION_STORE, text(rawEnvelope?.transactionId, 180));
  if (duplicate) return clone(duplicate);
  const session = await getSession();
  const projection = options.projection ? normalizeProjection(options.projection) : null;
  const envelope = normalizeOperationEnvelope(rawEnvelope, session, projection);
  const currentHead = session.graphHeads?.[envelope.graphId] || { revision: 0, sequence: 0, lastTransactionId: null };
  if (envelope.expectedHeadRevision !== integer(currentHead.revision)) {
    dispatchStatus('conflict', envelope.intent, {
      graphId: envelope.graphId,
      transactionId: envelope.transactionId,
      expectedHeadRevision: envelope.expectedHeadRevision,
      actualHeadRevision: integer(currentHead.revision)
    });
    throw new Error(`Studio journal revision conflict for ${envelope.graphId}: expected ${envelope.expectedHeadRevision}, current ${integer(currentHead.revision)}.`);
  }
  const nextSequence = integer(currentHead.sequence) + 1;
  envelope.startSequence = nextSequence;
  envelope.endSequence = nextSequence;
  const graphHeads = {
    ...(session.graphHeads || {}),
    [envelope.graphId]: {
      revision: envelope.acceptedHeadRevision,
      sequence: nextSequence,
      lastTransactionId: envelope.transactionId,
      updatedAt: now()
    }
  };
  const nextSession = {
    ...session,
    graphHeads,
    activeGraphId: envelope.graphId,
    activeGraphRevision: envelope.acceptedHeadRevision,
    durabilityState: 'saved-locally',
    pendingTransactionIds: [...session.pendingTransactionIds, envelope.transactionId].slice(-MAX_TRANSACTIONS),
    updatedAt: now()
  };
  await transact([TRANSACTION_STORE, SESSION_STORE], 'readwrite', ({ transactions, sessions }) => {
    transactions.add(envelope);
    sessions.put(nextSession);
  });
  sessionCache = normalizeSession(nextSession);
  if (projection) lastProjectionHash = envelope.projectionHash;
  await pruneStore(TRANSACTION_STORE, 'transactionId', MAX_TRANSACTIONS);
  dispatchStatus('saved-locally', envelope.intent, {
    graphId: envelope.graphId,
    transactionId: envelope.transactionId,
    envelopeVersion: OPERATION_ENVELOPE_VERSION,
    expectedHeadRevision: envelope.expectedHeadRevision,
    acceptedHeadRevision: envelope.acceptedHeadRevision,
    operationCount: envelope.operations.length
  });
  window.dispatchEvent(new CustomEvent('evara:studio-operation-durable', { detail: clone(envelope) }));
  return clone(envelope);
}

async function getGraphHead(graphId) {
  await initialize();
  const session = await getSession();
  const id = text(graphId, 220);
  const head = session.graphHeads?.[id] || { revision: 0, sequence: 0, lastTransactionId: null, updatedAt: null };
  return { graphId: id, ...clone(head) };
}

async function createCheckpoint(reason = 'manual-checkpoint', options = {}) {
  await initialize();
  const projection = normalizeProjection(options.projection || readLegacyProjection());
  const session = await getSession();
  const checkpoint = {
    checkpointId: uid('checkpoint'),
    projectId: session.projectId,
    branchId: session.branchId,
    graphId: session.activeGraphId || session.graphId,
    revision: session.activeGraphId ? session.activeGraphRevision : session.headRevision,
    sequence: session.activeGraphId ? integer(session.graphHeads?.[session.activeGraphId]?.sequence) : session.headSequence,
    reason: text(reason, 120),
    createdAt: now(),
    trusted: false,
    projectionHash: projectionHash(projection),
    projection
  };
  const nextSession = { ...session, latestCheckpointId: checkpoint.checkpointId, updatedAt: now() };
  await transact([CHECKPOINT_STORE, SESSION_STORE], 'readwrite', ({ checkpoints, sessions }) => {
    checkpoints.put(checkpoint);
    sessions.put(nextSession);
  });
  sessionCache = normalizeSession(nextSession);
  await pruneStore(CHECKPOINT_STORE, 'checkpointId', MAX_CHECKPOINTS);
  dispatchStatus('saved-locally', reason, { checkpointId: checkpoint.checkpointId });
  return clone(checkpoint);
}

async function listTransactions() {
  const records = await getAll(TRANSACTION_STORE);
  return records.sort((a, b) => Date.parse(b.createdAtClient || 0) - Date.parse(a.createdAtClient || 0));
}

async function listOperationTransactions(graphId = '') {
  const id = text(graphId, 220);
  const records = await listTransactions();
  return records.filter((record) => record.envelopeVersion === OPERATION_ENVELOPE_VERSION && (!id || record.graphId === id));
}

async function listCheckpoints() {
  const records = await getAll(CHECKPOINT_STORE);
  return records.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

async function restoreCheckpoint(checkpointId) {
  await initialize();
  const db = await openDatabase();
  const transaction = db.transaction([CHECKPOINT_STORE], 'readonly');
  const checkpoint = await requestValue(transaction.objectStore(CHECKPOINT_STORE).get(checkpointId));
  if (!checkpoint) return { restored: false, reason: 'Checkpoint not found.' };
  const current = normalizeProjection(readLegacyProjection());
  await appendTransaction('history-restore-before', { projection: current, force: true });
  nativeSetItem.call(localStorage, LEGACY_CONTENT_KEY, JSON.stringify(checkpoint.projection.content));
  nativeSetItem.call(localStorage, LEGACY_LAYOUT_KEY, JSON.stringify(checkpoint.projection.layout));
  await appendTransaction('history-restore', { projection: checkpoint.projection, previousProjection: current, force: true });
  const session = await getSession();
  await putSession({ ...session, lastRecoveredAt: now(), updatedAt: now() });
  dispatchStatus('recovered', 'history-restore', { checkpointId });
  return { restored: true };
}

function dispatchStatus(state, reason, extra = {}) {
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: {
      state,
      reason,
      revision: sessionCache?.activeGraphId ? sessionCache.activeGraphRevision : sessionCache?.headRevision || 0,
      sequence: sessionCache?.activeGraphId ? integer(sessionCache.graphHeads?.[sessionCache.activeGraphId]?.sequence) : sessionCache?.headSequence || 0,
      durabilityState: sessionCache?.durabilityState || state,
      ...extra
    }
  }));
}

function scheduleCompatibilityJournal(reason = 'system') {
  pendingReason = text(reason, 120);
  clearTimeout(saveTimer);
  dispatchStatus('syncing', pendingReason);
  saveTimer = setTimeout(async () => {
    try {
      await appendTransaction(pendingReason);
    } catch (error) {
      dispatchStatus('recovery-required', pendingReason, { error: text(error?.message || error, 300) });
    }
  }, AUTOSAVE_DELAY);
}

function installCompatibilityBridge() {
  const original = Storage.prototype.setItem;
  if (original.__evaraStudioJournal) return;
  function bridgedSetItem(key, value) {
    nativeSetItem.call(this, key, value);
    if (this !== localStorage) return;
    if (key === LEGACY_CONTENT_KEY) scheduleCompatibilityJournal('content-compatibility-save');
    else if (key === LEGACY_LAYOUT_KEY) scheduleCompatibilityJournal('layout-compatibility-save');
    else if (key === LEGACY_LIVE_KEY) {
      nativeSetItem.call(localStorage, LEGACY_LIVE_KEY, JSON.stringify({ blocked: true, reason: 'trusted-release-required', attemptedAt: now() }));
      dispatchStatus('release-blocked', 'trusted-release-required');
    }
  }
  Object.defineProperty(bridgedSetItem, '__evaraStudioJournal', { value: true });
  Storage.prototype.setItem = bridgedSetItem;
}

async function recoverOnStartup() {
  const current = normalizeProjection(readLegacyProjection());
  const currentHash = projectionHash(current);
  const checkpoint = await latestCheckpoint();
  if (!current.content && checkpoint?.projection?.content) {
    nativeSetItem.call(localStorage, LEGACY_CONTENT_KEY, JSON.stringify(checkpoint.projection.content));
    nativeSetItem.call(localStorage, LEGACY_LAYOUT_KEY, JSON.stringify(checkpoint.projection.layout));
    const session = await getSession();
    await putSession({ ...session, lastRecoveredAt: now(), durabilityState: 'saved-locally', updatedAt: now() });
    lastProjectionHash = checkpoint.projectionHash;
    dispatchStatus('recovered', 'startup-recovery', { checkpointId: checkpoint.checkpointId });
    return { migrationProjection: null };
  }
  lastProjectionHash = currentHash;
  return { migrationProjection: !checkpoint && current.content ? current : null };
}

async function initialize() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    await openDatabase();
    await getSession();
    const recovery = await recoverOnStartup();
    dispatchStatus('saved-locally', 'journal-ready');
    return recovery;
  })();
  return readyPromise;
}

function registerServerAdapter(name, adapter) {
  if (!name || !adapter || typeof adapter.commit !== 'function' || typeof adapter.checkpoint !== 'function') {
    throw new TypeError('Trusted Studio server adapters require commit() and checkpoint().');
  }
  serverAdapters.set(text(name, 80), adapter);
}

async function getStatus() {
  await initialize();
  const session = await getSession();
  const transactions = await listTransactions();
  const checkpoints = await listCheckpoints();
  return { session, transactions, checkpoints, serverAdapters: [...serverAdapters.keys()] };
}

window.EvaraStudioJournal = Object.freeze({
  databaseName: DB_NAME,
  operationEnvelopeVersion: OPERATION_ENVELOPE_VERSION,
  initialize,
  getStatus,
  getGraphHead,
  appendCompatibilityTransaction: appendTransaction,
  appendOperationTransaction,
  createCheckpoint,
  listTransactions,
  listOperationTransactions,
  listCheckpoints,
  restoreCheckpoint,
  registerServerAdapter,
  listServerAdapters: () => [...serverAdapters.keys()]
});

installCompatibilityBridge();
initialize()
  .then(async ({ migrationProjection }) => {
    if (!migrationProjection) return;
    await appendTransaction('legacy-migration', { projection: migrationProjection, force: true });
    await createCheckpoint('legacy-migration', { projection: migrationProjection });
  })
  .catch((error) => dispatchStatus('recovery-required', 'journal-initialize', { error: text(error?.message || error, 300) }));
