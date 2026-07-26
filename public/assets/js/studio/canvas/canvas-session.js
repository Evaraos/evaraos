import {
  assertValidEvaraGraph,
  cloneEvaraGraph
} from '../core/evara-graph.js';
import {
  applyTransaction,
  createOperation
} from '../core/operation-protocol.js';
import { createCanvasSandboxFixture } from './canvas-sandbox-fixture.js';
import {
  flattenGraphProjection,
  projectCanvasPage
} from './graph-projection.js';
import { MockOperationDispatcher } from './mock-operation-dispatcher.js';
import { CanvasOperationJournal } from './canvas-operation-journal.js';
import { HistoryController } from './canvas-history-controller.js';
import {
  InteractionController,
  SelectionController,
  ViewportController
} from './canvas-controllers.js';
import { LayoutResolver, SnapResolver } from './layout-resolver.js';

function clone(value) {
  return cloneEvaraGraph(value);
}

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function slug(value = 'item') {
  return String(value || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function actor(value = {}) {
  return {
    id: String(value.id || 'studio-canvas-owner').slice(0, 160),
    type: ['user', 'system', 'ai', 'migration'].includes(value.type) ? value.type : 'user',
    role: value.role ? String(value.role).slice(0, 100) : 'owner'
  };
}

function compiledBlueprintGraph() {
  try {
    const compiler = window.EvaraStudioBlueprintSerialization;
    if (!compiler?.compileCurrent || !compiler?.capture) return null;
    const document = compiler.capture();
    const pageId = document?.pages?.[0]?.id || 'page';
    const graphId = `graph:canvas:${slug(document.blueprintId)}:${slug(pageId)}`;
    const result = compiler.compileCurrent(pageId, {
      actorId: 'canvas-session',
      graphId,
      generatedAt: new Date().toISOString()
    });
    if (!result?.graph) return null;
    result.graph.revision = 0;
    assertValidEvaraGraph(result.graph);
    return {
      graph: clone(result.graph),
      source: 'authored-blueprint-graph',
      sourceDocumentId: result.sourceDocumentId || document.documentId || null,
      sourceFingerprint: result.sourceFingerprint || document.metadata?.fingerprint || null
    };
  } catch {
    return null;
  }
}

function initialGraph(options = {}) {
  const authored = compiledBlueprintGraph();
  if (authored) return authored;
  if (options.requireAuthoredGraph === true) {
    const error = new Error('The authenticated Studio draft is not ready for Graph Canvas compilation.');
    error.code = 'authored-graph-required';
    throw error;
  }
  const graph = createCanvasSandboxFixture();
  graph.graphId = 'graph:canvas:sandbox:owner-dashboard';
  graph.revision = 0;
  return {
    graph,
    source: 'canvas-sandbox-fixture',
    sourceDocumentId: null,
    sourceFingerprint: null
  };
}

function defaultJournalDiagnostics() {
  return {
    graphId: null,
    graphRevision: 0,
    headRevision: 0,
    headSequence: 0,
    lastTransactionId: null,
    transactionCount: 0,
    pendingCount: 0,
    unsynchronizedChanges: false,
    syncState: 'saved-locally',
    integrityState: 'unverified'
  };
}

export class CanvasSession {
  #graph = null;
  #projection = null;
  #journal = null;
  #history = null;
  #listeners = new Set();
  #ready = false;
  #source = null;
  #pageId = null;
  #durabilityState = 'saved-locally';
  #journalDiagnostics = defaultJournalDiagnostics();
  #actor;

  constructor(options = {}) {
    this.options = { ...options };
    this.#actor = actor(options.actor);
    this.selection = new SelectionController();
    this.interaction = new InteractionController();
    this.viewport = new ViewportController(options.viewport);
    this.layoutResolver = LayoutResolver;
    this.snapResolver = SnapResolver;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('CanvasSession subscribers must be functions.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #applyJournalDiagnostics(diagnostics = {}) {
    this.#journalDiagnostics = {
      ...defaultJournalDiagnostics(),
      ...this.#journalDiagnostics,
      ...(diagnostics || {})
    };
    if (diagnostics?.syncState && !['read-only', 'recovery-required', 'conflict'].includes(this.#durabilityState)) {
      this.#durabilityState = diagnostics.syncState;
    }
  }

  #emit(reason, extra = {}) {
    const snapshot = this.snapshot();
    this.#listeners.forEach((listener) => listener(snapshot, { reason, ...extra }));
    window.dispatchEvent(new CustomEvent('evara:canvas-session-change', {
      detail: {
        reason,
        graphId: snapshot.graphId,
        graphRevision: snapshot.graphRevision,
        durabilityState: snapshot.durabilityState,
        syncState: snapshot.syncState,
        pendingTransactionCount: snapshot.pendingTransactionCount,
        unsynchronizedChanges: snapshot.unsynchronizedChanges,
        source: snapshot.source,
        ...extra
      }
    }));
  }

  async initialize() {
    if (this.#ready) return this.snapshot();
    const source = this.options.graph
      ? { graph: clone(this.options.graph), source: 'provided-graph', sourceDocumentId: null, sourceFingerprint: null }
      : initialGraph({ requireAuthoredGraph: this.options.requireAuthoredGraph });
    assertValidEvaraGraph(source.graph);
    this.#source = source;
    this.#pageId = this.options.pageId || Object.values(source.graph.nodes).find((node) => node.kind === 'page')?.id || null;
    this.#journal = new CanvasOperationJournal(source.graph);
    const recovery = await this.#journal.initialize();
    this.#graph = recovery.graph;
    this.#durabilityState = recovery.durabilityState;
    this.#applyJournalDiagnostics(recovery.diagnostics);
    this.#reproject();
    this.selection.prune(flattenGraphProjection(this.#projection).map((node) => node.id));
    this.#history = new HistoryController({
      journal: this.#journal,
      dispatchOperations: (request) => this.dispatchOperations(request)
    });
    await this.#history.initialize();
    this.viewport.subscribe(() => {
      this.#reproject();
      this.#emit('viewport-change');
    });
    this.selection.subscribe(() => this.#emit('selection-change'));
    this.#ready = true;
    this.#emit('initialized', {
      recoveredTransactions: recovery.transactions.length,
      integrityState: this.#journalDiagnostics.integrityState
    });
    return this.snapshot();
  }

  #reproject() {
    if (!this.#graph) return;
    const viewport = this.viewport.snapshot();
    const pageExists = this.#pageId && this.#graph.nodes[this.#pageId]?.kind === 'page';
    if (!pageExists) this.#pageId = Object.values(this.#graph.nodes).find((node) => node.kind === 'page')?.id || null;
    this.#projection = projectCanvasPage(this.#graph, { pageId: this.#pageId, device: viewport.device });
  }

  async #commitPrepared(prepared, options = {}) {
    if (!prepared?.changed) return prepared;
    const durable = await this.#journal.append(prepared, {
      ...options,
      sourceDocumentId: this.#source.sourceDocumentId,
      sourceFingerprint: this.#source.sourceFingerprint
    });
    this.#applyJournalDiagnostics(durable.diagnostics);
    this.#graph = clone(prepared.graph);
    this.#durabilityState = durable.diagnostics?.syncState || 'saved-locally';
    this.#reproject();
    this.selection.prune(flattenGraphProjection(this.#projection).map((node) => node.id));
    if (this.#history) await this.#history.refresh();
    this.#emit(options.intent || prepared.intent || prepared.command?.type || 'transaction', {
      transactionId: prepared.transactionId,
      pendingTransactionCount: this.#journalDiagnostics.pendingCount
    });
    return {
      ...prepared,
      graph: clone(this.#graph),
      durable: true,
      journal: clone(this.#journalDiagnostics)
    };
  }

  async dispatch(command) {
    if (!this.#ready) await this.initialize();
    const candidate = new MockOperationDispatcher(this.#graph, { actor: command?.actor || this.#actor });
    const prepared = candidate.dispatch({ ...command, actor: command?.actor || this.#actor });
    return this.#commitPrepared(prepared, {
      intent: command.type,
      summary: command.summary || `Canvas command: ${command.type}`
    });
  }

  async dispatchOperations({
    intent,
    operations,
    revertsTransactionId = null,
    redoesTransactionId = null,
    summary = ''
  } = {}) {
    if (!this.#ready) await this.initialize();
    if (!Array.isArray(operations) || !operations.length) return { changed: false, reason: 'No operations supplied.' };
    const transactionId = randomId(intent === 'history.undo' ? 'undo' : intent === 'history.redo' ? 'redo' : 'canvas_tx');
    const correlationId = randomId('correlation');
    const normalized = operations.map((operation) => createOperation({
      graphId: this.#graph.graphId,
      type: operation.type,
      payload: clone(operation.payload || {}),
      actor: this.#actor,
      baseRevision: null,
      transactionId,
      correlationId,
      metadata: { ...(operation.metadata || {}), semanticIntent: intent, source: 'canvas-session' }
    }));
    const expectedHeadRevision = this.#graph.revision;
    const result = applyTransaction(this.#graph, normalized, {
      transactionId,
      actor: this.#actor,
      validateGraph: true,
      allowPublishedMutation: false
    });
    return this.#commitPrepared({
      changed: true,
      intent,
      command: { type: intent, payload: {}, actor: this.#actor, correlationId },
      transactionId: result.transactionId,
      expectedHeadRevision,
      graphRevision: result.graph.revision,
      acceptedOperations: result.acceptedOperations,
      inverseOperations: result.inverseOperations,
      commitOperation: result.commitOperation,
      graph: result.graph
    }, {
      intent,
      summary: summary || `Canvas transaction: ${intent}`,
      revertsTransactionId,
      redoesTransactionId
    });
  }

  async undo() {
    if (!this.#ready) await this.initialize();
    return this.#history.undo();
  }

  async redo() {
    if (!this.#ready) await this.initialize();
    return this.#history.redo();
  }

  async checkpoint() {
    return {
      deferred: true,
      reason: 'Trusted graph checkpoints are owned by the Backend journal service.'
    };
  }

  async pendingTransactions() {
    if (!this.#ready) await this.initialize();
    const pending = await this.#journal.pendingTransactions();
    this.#applyJournalDiagnostics({
      pendingCount: pending.length,
      unsynchronizedChanges: pending.length > 0,
      syncState: pending.length > 0 ? 'saved-locally' : 'server-confirmed'
    });
    return pending;
  }

  async refreshJournalDiagnostics() {
    if (!this.#ready) await this.initialize();
    const diagnostics = await this.#journal.getDiagnostics();
    this.#applyJournalDiagnostics(diagnostics);
    this.#emit('journal-diagnostics-refresh');
    return clone(this.#journalDiagnostics);
  }

  async setDurabilityState(state, reason = 'canvas-state-change') {
    this.#durabilityState = state;
    this.#emit(reason);
    return this.snapshot();
  }

  getGraph() {
    return this.#graph ? clone(this.#graph) : null;
  }

  getProjection() {
    return this.#projection;
  }

  getHistory() {
    return this.#history?.snapshot() || { transactions: [], canUndo: false, canRedo: false };
  }

  getJournal() {
    return this.#journal;
  }

  getJournalDiagnostics() {
    return clone(this.#journalDiagnostics);
  }

  snapshot() {
    const history = this.getHistory();
    return {
      ready: this.#ready,
      graphId: this.#graph?.graphId || null,
      graphRevision: this.#graph?.revision ?? null,
      graphState: this.#graph?.state || null,
      pageId: this.#pageId,
      projection: this.#projection,
      source: this.#source?.source || null,
      sourceDocumentId: this.#source?.sourceDocumentId || null,
      sourceFingerprint: this.#source?.sourceFingerprint || null,
      viewport: this.viewport.snapshot(),
      selection: this.selection.snapshot(),
      interaction: this.interaction.snapshot(),
      durabilityState: this.#durabilityState,
      syncState: this.#journalDiagnostics.syncState,
      integrityState: this.#journalDiagnostics.integrityState,
      headRevision: this.#journalDiagnostics.headRevision,
      headSequence: this.#journalDiagnostics.headSequence,
      lastTransactionId: this.#journalDiagnostics.lastTransactionId,
      pendingTransactionCount: this.#journalDiagnostics.pendingCount,
      unsynchronizedChanges: this.#journalDiagnostics.unsynchronizedChanges,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      transactionCount: history.transactions.length
    };
  }
}

export async function createCanvasSession(options = {}) {
  const session = new CanvasSession(options);
  await session.initialize();
  return session;
}

export const EvaraCanvasSession = Object.freeze({
  create: createCanvasSession,
  CanvasSession
});
