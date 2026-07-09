import {
  assertValidEvaraGraph,
  cloneEvaraGraph
} from '../core/evara-graph.js';
import { replayOperations } from '../core/operation-protocol.js';

const DB_NAME = 'evaraos-studio-journal';
const SESSION_STORE = 'sessions';
const TRANSACTION_STORE = 'transactions';
const CHECKPOINT_STORE = 'checkpoints';
const MAX_CANVAS_TRANSACTIONS = 500;
const MAX_CANVAS_CHECKPOINTS = 24;
const AUTO_CHECKPOINT_INTERVAL = 10;

const DURABILITY_STATES = new Set([
  'saved-locally',
  'syncing',
  'server-confirmed',
  'offline',
  'conflict',
  'recovery-required',
  'read-only'
]);

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return cloneEvaraGraph(value);
}

function clean(value, fallback = '', max = 200) {
  const normalized = String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return normalized.slice(0, max) || fallback;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableSort(value[key]);
    return result;
  }, {});
}

function hashValue(value) {
  const source = JSON.stringify(stableSort(value));
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${source.length}`;
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Canvas journal transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Canvas journal transaction was aborted.'));
  });
}

async function waitForBaseJournal() {
  if (window.EvaraStudioJournal?.initialize) await window.EvaraStudioJournal.initialize();
}

async function openDatabase() {
  await waitForBaseJournal();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      const required = [SESSION_STORE, TRANSACTION_STORE, CHECKPOINT_STORE];
      const missing = required.filter((name) => !db.objectStoreNames.contains(name));
      if (missing.length) {
        db.close();
        reject(new Error(`Canvas journal stores are unavailable: ${missing.join(', ')}`));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Canvas journal database could not open.'));
    request.onblocked = () => reject(new Error('Canvas journal database is blocked by another Studio tab.'));
  });
}

async function getRecord(storeName, key) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([storeName], 'readonly');
    return await requestValue(tx.objectStore(storeName).get(key));
  } finally {
    db.close();
  }
}

async function allRecords(storeName) {
  const db = await openDatabase();
  try {
    const tx = db.transaction([storeName], 'readonly');
    return await requestValue(tx.objectStore(storeName).getAll());
  } finally {
    db.close();
  }
}

async function putRecords(storeNames, writer) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(storeNames, 'readwrite');
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    writer(stores);
    await transactionComplete(tx);
  } finally {
    db.close();
  }
}

function defaultActor(actor = {}) {
  return {
    id: clean(actor.id, 'studio-canvas-owner', 160),
    type: ['user', 'system', 'ai', 'migration'].includes(actor.type) ? actor.type : 'user',
    role: actor.role ? clean(actor.role, '', 100) : 'owner'
  };
}

function sessionIdFor(graphId, branchId) {
  return `canvas-session:${clean(graphId, 'graph', 120)}:${clean(branchId, 'local-draft', 80)}`.slice(0, 200);
}

function defaultSession(graph, options = {}) {
  const timestamp = now();
  const branchId = clean(options.branchId, 'local-draft', 160);
  return {
    sessionId: sessionIdFor(graph.graphId, branchId),
    companyId: clean(options.companyId, 'local-prototype', 128),
    projectId: clean(options.projectId, 'evara-studio-canvas', 160),
    branchId,
    graphId: graph.graphId,
    graphSchemaVersion: graph.schemaVersion,
    operationProtocolVersion: '0.1.0',
    headRevision: graph.revision,
    headSequence: 0,
    latestCheckpointId: null,
    clientInstanceId: clean(options.clientInstanceId, `canvas-client-${Date.now().toString(36)}`, 200),
    collaborationMode: 'single_writer',
    durabilityState: 'saved-locally',
    pendingTransactionIds: [],
    openedAt: timestamp,
    lastRecoveredAt: null,
    actor: defaultActor(options.actor),
    viewport: {
      device: 'desktop',
      width: 1180,
      height: 900,
      zoom: 0.78,
      panX: 0,
      panY: 0
    },
    previewContext: { role: 'owner', themeMode: null, environment: 'draft' },
    updatedAt: timestamp
  };
}

function validateCanvasTransaction(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return { valid: false, errors: ['Transaction must be an object.'] };
  if (!record.transactionId) errors.push('Missing transactionId.');
  if (!record.clientSessionId) errors.push('Missing clientSessionId.');
  if (!record.graphId) errors.push('Missing graphId.');
  if (!Number.isInteger(record.expectedHeadRevision) || record.expectedHeadRevision < 0) errors.push('Invalid expectedHeadRevision.');
  if (!Array.isArray(record.operations) || !record.operations.length) errors.push('Operations are required.');
  if (!Array.isArray(record.inverseOperations)) errors.push('inverseOperations must be an array.');
  if (!record.intent) errors.push('Missing intent.');
  if (!record.createdAtClient || Number.isNaN(Date.parse(record.createdAtClient))) errors.push('Invalid createdAtClient.');
  return { valid: errors.length === 0, errors };
}

function affectedIds(operations = []) {
  const nodes = new Set();
  const edges = new Set();
  operations.forEach((operation) => {
    const payload = operation?.payload || {};
    if (payload.nodeId) nodes.add(payload.nodeId);
    if (payload.node?.id) nodes.add(payload.node.id);
    if (payload.edgeId) edges.add(payload.edgeId);
    if (payload.edge?.id) edges.add(payload.edge.id);
  });
  return { nodeIds: [...nodes], edgeIds: [...edges] };
}

function transactionHashInput(record) {
  return {
    transactionId: record.transactionId,
    graphId: record.graphId,
    expectedHeadRevision: record.expectedHeadRevision,
    intent: record.intent,
    operations: record.operations,
    inverseOperations: record.inverseOperations,
    revertsTransactionId: record.revertsTransactionId,
    redoesTransactionId: record.redoesTransactionId
  };
}

function dispatchStatus(session, state, reason, extra = {}) {
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: {
      state,
      reason,
      source: 'canvas-session',
      sessionId: session.sessionId,
      graphId: session.graphId,
      revision: session.headRevision,
      sequence: session.headSequence,
      durabilityState: state,
      ...extra
    }
  }));
}

export class CanvasJournalAdapter {
  #baseGraph;
  #options;
  #session = null;

  constructor(baseGraph, options = {}) {
    assertValidEvaraGraph(baseGraph);
    this.#baseGraph = clone(baseGraph);
    this.#options = { ...options };
  }

  async initialize() {
    await waitForBaseJournal();
    const expected = defaultSession(this.#baseGraph, this.#options);
    const saved = await getRecord(SESSION_STORE, expected.sessionId);
    this.#session = saved || expected;
    if (!saved) await putRecords([SESSION_STORE], ({ sessions }) => sessions.put(clone(this.#session)));
    return this.recover();
  }

  get sessionId() {
    return this.#session?.sessionId || defaultSession(this.#baseGraph, this.#options).sessionId;
  }

  async getSession() {
    if (!this.#session) await this.initialize();
    return clone(this.#session);
  }

  async listTransactions({ newestFirst = false } = {}) {
    const sessionId = this.sessionId;
    const records = (await allRecords(TRANSACTION_STORE))
      .filter((record) => record.clientSessionId === sessionId && record.metadata?.channel === 'canvas-graph')
      .sort((left, right) => {
        const sequence = Number(left.startSequence || 0) - Number(right.startSequence || 0);
        return sequence || Date.parse(left.createdAtClient || 0) - Date.parse(right.createdAtClient || 0);
      });
    return newestFirst ? records.reverse().map(clone) : records.map(clone);
  }

  async listCheckpoints({ newestFirst = true } = {}) {
    const sessionId = this.sessionId;
    const records = (await allRecords(CHECKPOINT_STORE))
      .filter((record) => record.sessionId === sessionId && record.checkpointType === 'canvas-graph')
      .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));
    return (newestFirst ? records.reverse() : records).map(clone);
  }

  async pendingTransactions() {
    const records = await this.listTransactions();
    return records.filter((record) => !['server-confirmed', 'rejected'].includes(record.durabilityState)).map(clone);
  }

  async recover() {
    if (!this.#session) {
      const expected = defaultSession(this.#baseGraph, this.#options);
      this.#session = (await getRecord(SESSION_STORE, expected.sessionId)) || expected;
    }
    const checkpoints = await this.listCheckpoints({ newestFirst: true });
    let checkpoint = checkpoints[0] || null;
    if (!checkpoint) checkpoint = await this.createCheckpoint(this.#baseGraph, 'canvas-base-checkpoint');
    let graph;
    try {
      graph = clone(checkpoint.graphSnapshot);
      assertValidEvaraGraph(graph);
    } catch (error) {
      await this.setDurabilityState('recovery-required', 'corrupt-canvas-checkpoint');
      throw new Error(`Canvas recovery checkpoint is corrupt: ${error?.message || error}`);
    }

    const transactions = await this.listTransactions();
    const replayable = transactions.filter((record) => Number(record.endSequence || 0) > Number(checkpoint.sequence || 0));
    for (const record of replayable) {
      const validation = validateCanvasTransaction(record);
      if (!validation.valid) {
        await this.setDurabilityState('recovery-required', 'corrupt-canvas-transaction');
        throw new Error(`Canvas journal transaction ${record.transactionId} is corrupt: ${validation.errors.join(' ')}`);
      }
      try {
        graph = replayOperations(graph, record.operations, { validateGraph: true, allowPublishedMutation: false }).graph;
      } catch (error) {
        await this.setDurabilityState('recovery-required', 'canvas-replay-failed');
        throw new Error(`Canvas journal replay failed at ${record.transactionId}: ${error?.message || error}`);
      }
    }

    assertValidEvaraGraph(graph);
    const pending = transactions.filter((record) => !['server-confirmed', 'rejected'].includes(record.durabilityState));
    const headSequence = transactions.reduce((maximum, record) => Math.max(maximum, Number(record.endSequence || 0)), Number(checkpoint.sequence || 0));
    this.#session = {
      ...this.#session,
      headRevision: graph.revision,
      headSequence,
      latestCheckpointId: checkpoint.checkpointId,
      pendingTransactionIds: pending.map((record) => record.transactionId),
      durabilityState: this.#session.durabilityState === 'recovery-required' ? 'recovery-required' : 'saved-locally',
      lastRecoveredAt: now(),
      updatedAt: now()
    };
    await putRecords([SESSION_STORE], ({ sessions }) => sessions.put(clone(this.#session)));
    dispatchStatus(this.#session, this.#session.durabilityState, 'canvas-recovered', { pendingCount: pending.length });
    return { graph: clone(graph), session: clone(this.#session), transactions: transactions.map(clone), checkpoint: clone(checkpoint) };
  }

  async append(prepared, graphAfter, options = {}) {
    assertValidEvaraGraph(graphAfter);
    if (!this.#session) await this.initialize();
    const acceptedOperations = clone(prepared?.acceptedOperations || []);
    const inverseOperations = clone(prepared?.inverseOperations || []);
    if (!prepared?.transactionId || !acceptedOperations.length) throw new Error('Canvas journal append requires a prepared semantic transaction.');
    const existing = await getRecord(TRANSACTION_STORE, prepared.transactionId);
    const affected = affectedIds(acceptedOperations);
    const startSequence = this.#session.headSequence + 1;
    const endSequence = startSequence + acceptedOperations.length - 1;
    const envelope = {
      transactionId: prepared.transactionId,
      companyId: this.#session.companyId,
      projectId: this.#session.projectId,
      branchId: this.#session.branchId,
      graphId: this.#session.graphId,
      expectedHeadRevision: prepared.expectedHeadRevision,
      acceptedHeadRevision: graphAfter.revision,
      startSequence,
      endSequence,
      intent: clean(options.intent || prepared.intent || prepared.command?.type, 'system', 120),
      summary: clean(options.summary || `Canvas transaction: ${options.intent || prepared.intent || prepared.command?.type}`, '', 500),
      operations: acceptedOperations,
      inverseOperations,
      actor: defaultActor(prepared.command?.actor || this.#session.actor),
      clientSessionId: this.#session.sessionId,
      correlationId: prepared.command?.correlationId || null,
      revertsTransactionId: options.revertsTransactionId || null,
      redoesTransactionId: options.redoesTransactionId || null,
      affectedNodeIds: affected.nodeIds,
      affectedEdgeIds: affected.edgeIds,
      durabilityState: 'saved-locally',
      previousHash: null,
      transactionHash: null,
      createdAtClient: options.createdAtClient || now(),
      acceptedAtServer: null,
      metadata: {
        channel: 'canvas-graph',
        graphSchemaVersion: graphAfter.schemaVersion,
        operationProtocolVersion: '0.1.0',
        source: 'canvas-session',
        commandPayload: clone(prepared.command?.payload || {}),
        ...clone(options.metadata || {})
      }
    };
    envelope.transactionHash = hashValue(transactionHashInput(envelope));

    if (existing) {
      if (existing.transactionHash === envelope.transactionHash) return { transaction: clone(existing), duplicate: true };
      await this.setDurabilityState('conflict', 'canvas-idempotency-conflict');
      throw new Error(`Canvas transaction ID ${envelope.transactionId} was reused with different content.`);
    }
    if (this.#session.headRevision !== prepared.expectedHeadRevision) {
      await this.setDurabilityState('conflict', 'canvas-head-revision-conflict');
      throw new Error(`Canvas journal expected revision ${this.#session.headRevision}, transaction expected ${prepared.expectedHeadRevision}.`);
    }

    const nextSession = {
      ...this.#session,
      headRevision: graphAfter.revision,
      headSequence: endSequence,
      durabilityState: 'saved-locally',
      pendingTransactionIds: [...new Set([...this.#session.pendingTransactionIds, envelope.transactionId])].slice(-MAX_CANVAS_TRANSACTIONS),
      updatedAt: now()
    };
    await putRecords([TRANSACTION_STORE, SESSION_STORE], ({ transactions, sessions }) => {
      transactions.put(clone(envelope));
      sessions.put(clone(nextSession));
    });
    this.#session = nextSession;

    const count = (await this.listTransactions()).length;
    if (count % AUTO_CHECKPOINT_INTERVAL === 0) await this.createCheckpoint(graphAfter, 'canvas-autosave-checkpoint');
    await this.prune();
    dispatchStatus(this.#session, 'saved-locally', 'canvas-transaction-saved', { transactionId: envelope.transactionId, intent: envelope.intent });
    return { transaction: clone(envelope), duplicate: false };
  }

  async createCheckpoint(graph, reason = 'canvas-checkpoint') {
    assertValidEvaraGraph(graph);
    if (!this.#session) {
      const expected = defaultSession(graph, this.#options);
      this.#session = (await getRecord(SESSION_STORE, expected.sessionId)) || expected;
    }
    const checkpoint = {
      checkpointId: `canvas-checkpoint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      checkpointType: 'canvas-graph',
      sessionId: this.#session.sessionId,
      projectId: this.#session.projectId,
      branchId: this.#session.branchId,
      graphId: graph.graphId,
      revision: graph.revision,
      sequence: this.#session.headSequence,
      reason: clean(reason, 'canvas-checkpoint', 120),
      createdAt: now(),
      trusted: false,
      graphHash: hashValue(graph),
      graphSnapshot: clone(graph)
    };
    const nextSession = { ...this.#session, latestCheckpointId: checkpoint.checkpointId, updatedAt: now() };
    await putRecords([CHECKPOINT_STORE, SESSION_STORE], ({ checkpoints, sessions }) => {
      checkpoints.put(clone(checkpoint));
      sessions.put(clone(nextSession));
    });
    this.#session = nextSession;
    dispatchStatus(this.#session, this.#session.durabilityState, reason, { checkpointId: checkpoint.checkpointId });
    return clone(checkpoint);
  }

  async setDurabilityState(state, reason = 'canvas-durability-state') {
    if (!DURABILITY_STATES.has(state)) throw new Error(`Unsupported Canvas durability state: ${state}`);
    if (!this.#session) await this.initialize();
    this.#session = { ...this.#session, durabilityState: state, updatedAt: now() };
    await putRecords([SESSION_STORE], ({ sessions }) => sessions.put(clone(this.#session)));
    dispatchStatus(this.#session, state, reason);
    return clone(this.#session);
  }

  async updateViewport(viewport) {
    if (!this.#session) await this.initialize();
    this.#session = { ...this.#session, viewport: clone(viewport), updatedAt: now() };
    await putRecords([SESSION_STORE], ({ sessions }) => sessions.put(clone(this.#session)));
    return clone(this.#session);
  }

  async markTransaction(transactionId, durabilityState, server = {}) {
    const record = await getRecord(TRANSACTION_STORE, transactionId);
    if (!record || record.clientSessionId !== this.sessionId) throw new Error(`Canvas transaction not found: ${transactionId}`);
    if (!['syncing', 'server-confirmed', 'conflict', 'rejected', 'saved-locally'].includes(durabilityState)) {
      throw new Error(`Unsupported transaction durability state: ${durabilityState}`);
    }
    const updated = {
      ...record,
      durabilityState,
      acceptedHeadRevision: server.acceptedHeadRevision ?? record.acceptedHeadRevision,
      startSequence: server.startSequence ?? record.startSequence,
      endSequence: server.endSequence ?? record.endSequence,
      acceptedAtServer: durabilityState === 'server-confirmed' ? (server.acceptedAtServer || now()) : record.acceptedAtServer
    };
    const pending = new Set(this.#session.pendingTransactionIds || []);
    if (['server-confirmed', 'rejected'].includes(durabilityState)) pending.delete(transactionId);
    else pending.add(transactionId);
    const nextSession = {
      ...this.#session,
      durabilityState: durabilityState === 'conflict' ? 'conflict' : (pending.size ? 'saved-locally' : 'server-confirmed'),
      pendingTransactionIds: [...pending],
      updatedAt: now()
    };
    await putRecords([TRANSACTION_STORE, SESSION_STORE], ({ transactions, sessions }) => {
      transactions.put(clone(updated));
      sessions.put(clone(nextSession));
    });
    this.#session = nextSession;
    dispatchStatus(this.#session, nextSession.durabilityState, 'canvas-transaction-updated', { transactionId, transactionState: durabilityState });
    return clone(updated);
  }

  async prune() {
    const transactions = await this.listTransactions({ newestFirst: true });
    const checkpoints = await this.listCheckpoints({ newestFirst: true });
    const removeTransactions = transactions.slice(MAX_CANVAS_TRANSACTIONS);
    const removeCheckpoints = checkpoints.slice(MAX_CANVAS_CHECKPOINTS);
    if (!removeTransactions.length && !removeCheckpoints.length) return;
    await putRecords([TRANSACTION_STORE, CHECKPOINT_STORE], ({ transactions: txStore, checkpoints: checkpointStore }) => {
      removeTransactions.forEach((record) => txStore.delete(record.transactionId));
      removeCheckpoints.forEach((record) => checkpointStore.delete(record.checkpointId));
    });
  }
}

export const CanvasJournal = Object.freeze({
  databaseName: DB_NAME,
  create: (graph, options) => new CanvasJournalAdapter(graph, options),
  validateTransaction: validateCanvasTransaction,
  hash: hashValue
});
