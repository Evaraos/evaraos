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
import { CanvasJournalAdapter } from './canvas-journal-adapter.js';
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
    if (!compiler?.compileCurrent) return null;
    const result = compiler.compileCurrent('', {
      actorId: 'canvas-session',
      generatedAt: new Date().toISOString()
    });
    if (!result?.graph) return null;
    assertValidEvaraGraph(result.graph);
    return {
      graph: clone(result.graph),
      source: 'authored-blueprint-graph',
      sourceDocumentId: result.sourceDocumentId || null,
      sourceFingerprint: result.sourceFingerprint || null
    };
  } catch {
    return null;
  }
}

function initialGraph() {
  const authored = compiledBlueprintGraph();
  if (authored) return authored;
  return {
    graph: createCanvasSandboxFixture(),
    source: 'canvas-sandbox-fixture',
    sourceDocumentId: null,
    sourceFingerprint: null
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

  #emit(reason, extra = {}) {
    const snapshot = this.snapshot();
    this.#listeners.forEach((listener) => listener(snapshot, { reason, ...extra }));
    window.dispatchEvent(new CustomEvent('evara:canvas-session-change', {
      detail: {
        reason,
        graphId: snapshot.graphId,
        graphRevision: snapshot.graphRevision,
        durabilityState: snapshot.durabilityState,
        source: snapshot.source,
        ...extra
      }
    }));
  }

  async initialize() {
    if (this.#ready) return this.snapshot();
    const source = this.options.graph
      ? { graph: clone(this.options.graph), source: 'provided-graph', sourceDocumentId: null, sourceFingerprint: null }
      : initialGraph();
    assertValidEvaraGraph(source.graph);
    this.#source = source;
    this.#pageId = this.options.pageId || Object.values(source.graph.nodes).find((node) => node.kind === 'page')?.id || null;
    this.#journal = new CanvasJournalAdapter(source.graph, {
      companyId: this.options.companyId,
      projectId: this.options.projectId || 'evara-studio-canvas',
      branchId: this.options.branchId || 'local-draft',
      actor: this.#actor
    });
    const recovery = await this.#journal.initialize();
    this.#graph = recovery.graph;
    this.#durabilityState = recovery.session?.durabilityState || 'saved-locally';
    const viewport = recovery.session?.viewport || this.viewport.snapshot();
    this.viewport = new ViewportController(viewport);
    this.#reproject();
    this.selection.prune(flattenGraphProjection(this.#projection).map((node) => node.id));
    this.#history = new HistoryController({
      journal: this.#journal,
      dispatchOperations: (request) => this.dispatchOperations(request)
    });
    await this.#history.initialize();
    this.viewport.subscribe((next) => {
      this.#reproject();
      this.#journal.updateViewport(next).catch(() => undefined);
      this.#emit('viewport-change');
    });
    this.selection.subscribe(() => this.#emit('selection-change'));
    this.#ready = true;
    this.#emit('initialized', { recoveredTransactions: recovery.transactions.length });
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
    await this.#journal.append(prepared, prepared.graph, options);
    this.#graph = clone(prepared.graph);
    this.#durabilityState = 'saved-locally';
    this.#reproject();
    this.selection.prune(flattenGraphProjection(this.#projection).map((node) => node.id));
    if (this.#history) await this.#history.refresh();
    this.#emit(options.intent || prepared.intent || prepared.command?.type || 'transaction', { transactionId: prepared.transactionId });
    return { ...prepared, graph: clone(this.#graph), durable: true };
  }

  async dispatch(command) {
    if (!this.#ready) await this.initialize();
    const candidate = new MockOperationDispatcher(this.#graph, { actor: command?.actor || this.#actor });
    const prepared = candidate.dispatch({ ...command, actor: command?.actor || this.#actor });
    return this.#commitPrepared(prepared, {
      intent: command.type,
      summary: command.summary || `Canvas command: ${command.type}`,
      metadata: { sourceDocumentId: this.#source.sourceDocumentId, sourceFingerprint: this.#source.sourceFingerprint }
    });
  }

  async dispatchOperations({
    intent,
    operations,
    revertsTransactionId = null,
    redoesTransactionId = null,
    summary = '',
    metadata = {}
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
    const prepared = {
      changed: true,
      intent,
      command: {
        type: intent,
        payload: {},
        actor: this.#actor,
        correlationId
      },
      transactionId: result.transactionId,
      expectedHeadRevision,
      graphRevision: result.graph.revision,
      acceptedOperations: result.acceptedOperations,
      inverseOperations: result.inverseOperations,
      commitOperation: result.commitOperation,
      graph: result.graph
    };
    return this.#commitPrepared(prepared, {
      intent,
      summary: summary || `Canvas transaction: ${intent}`,
      revertsTransactionId,
      redoesTransactionId,
      metadata
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

  async checkpoint(reason = 'canvas-manual-checkpoint') {
    if (!this.#ready) await this.initialize();
    return this.#journal.createCheckpoint(this.#graph, reason);
  }

  async pendingTransactions() {
    if (!this.#ready) await this.initialize();
    return this.#journal.pendingTransactions();
  }

  async setDurabilityState(state, reason) {
    if (!this.#ready) await this.initialize();
    const session = await this.#journal.setDurabilityState(state, reason);
    this.#durabilityState = session.durabilityState;
    this.#emit('durability-change');
    return session;
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
