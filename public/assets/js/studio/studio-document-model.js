const DB_NAME = 'evaraos-studio-journal';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';
const TRANSACTION_STORE = 'transactions';
const CHECKPOINT_STORE = 'checkpoints';
const SESSION_ID = 'local-studio-session';
const LEGACY_CONTENT_KEY = 'evaraos-studio-visual-builder-v1';
const LEGACY_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1';
const LEGACY_LIVE_KEY = 'evaraos-studio-visual-builder-live-v1';
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
  sessionCache = session || defaultSession();
  if (!session) await putSession(sessionCache);
  return clone(sessionCache);
}

async function putSession(session) {
  sessionCache = clone(session);
  await transact([SESSION_STORE], 'readwrite', ({ sessions }) => sessions.put(clone(sessionCache)));
  return clone(sessionCache);
}

async function getAll(storeName) {
  const db = await openDatabase();
  const transaction = db.transaction([storeName], 'readonly');
  return requestValue(transaction.objectStore(storeName).getAll());
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
  sessionCache = clone(nextSession);
  lastProjectionHash = hash;
  await pruneStore(TRANSACTION_STORE, 'transactionId', MAX_TRANSACTIONS);
  dispatchStatus('saved-locally', reason, { transactionId: envelope.transactionId });
  return clone(envelope);
}

async function createCheckpoint(reason = 'manual-checkpoint', options = {}) {
  await initialize();
  const projection = normalizeProjection(options.projection || readLegacyProjection());
  const session = await getSession();
  const checkpoint = {
    checkpointId: uid('checkpoint'),
    projectId: session.projectId,
    branchId: session.branchId,
    graphId: session.graphId,
    revision: session.headRevision,
    sequence: session.headSequence,
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
  sessionCache = clone(nextSession);
  await pruneStore(CHECKPOINT_STORE, 'checkpointId', MAX_CHECKPOINTS);
  dispatchStatus('saved-locally', reason, { checkpointId: checkpoint.checkpointId });
  return clone(checkpoint);
}

async function listTransactions() {
  const records = await getAll(TRANSACTION_STORE);
  return records.sort((a, b) => Date.parse(b.createdAtClient || 0) - Date.parse(a.createdAtClient || 0));
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
      revision: sessionCache?.headRevision || 0,
      sequence: sessionCache?.headSequence || 0,
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
  initialize,
  getStatus,
  appendCompatibilityTransaction: appendTransaction,
  createCheckpoint,
  listTransactions,
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
