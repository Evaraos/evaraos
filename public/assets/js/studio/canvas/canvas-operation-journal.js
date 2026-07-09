import {
  assertValidEvaraGraph,
  cloneEvaraGraph
} from '../core/evara-graph.js';
import { replayOperations } from '../core/operation-protocol.js';

function clone(value) {
  return cloneEvaraGraph(value);
}

function chronological(records = []) {
  return [...records].sort((left, right) => {
    const sequence = Number(left.startSequence || 0) - Number(right.startSequence || 0);
    return sequence || Date.parse(left.createdAtClient || 0) - Date.parse(right.createdAtClient || 0);
  });
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

function journalApi() {
  const api = window.EvaraStudioJournal;
  if (!api?.appendOperationTransaction || !api?.listOperationTransactions || !api?.getGraphHead) {
    throw new Error('The operation-aware Studio Journal is unavailable.');
  }
  return api;
}

function emitRecovery(error, graphId) {
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: {
      state: 'recovery-required',
      reason: 'canvas-operation-recovery',
      graphId,
      error: String(error?.message || error).slice(0, 300)
    }
  }));
}

export class CanvasOperationJournal {
  #baseGraph;
  #graphId;

  constructor(baseGraph) {
    assertValidEvaraGraph(baseGraph);
    this.#baseGraph = clone(baseGraph);
    this.#graphId = baseGraph.graphId;
  }

  async initialize() {
    const api = journalApi();
    await api.initialize();
    const records = chronological(await api.listOperationTransactions(this.#graphId));
    let graph = clone(this.#baseGraph);
    graph.revision = 0;
    try {
      for (const record of records) {
        if (!Array.isArray(record.operations) || !record.operations.length) throw new Error(`Transaction ${record.transactionId} has no operations.`);
        graph = replayOperations(graph, record.operations, { validateGraph: true, allowPublishedMutation: false }).graph;
      }
      assertValidEvaraGraph(graph);
    } catch (error) {
      emitRecovery(error, this.#graphId);
      throw new Error(`Canvas operation recovery failed: ${error?.message || error}`);
    }
    const head = await api.getGraphHead(this.#graphId);
    if (Number(head.revision || 0) !== graph.revision) {
      const error = new Error(`Canvas graph head mismatch: journal ${head.revision || 0}, replay ${graph.revision}.`);
      emitRecovery(error, this.#graphId);
      throw error;
    }
    return {
      graph,
      transactions: records.map(clone),
      head: clone(head),
      durabilityState: records.some((record) => record.durabilityState !== 'server-confirmed') ? 'saved-locally' : 'server-confirmed'
    };
  }

  async append(prepared, options = {}) {
    const api = journalApi();
    const affected = affectedIds(prepared.acceptedOperations);
    const envelope = {
      transactionId: prepared.transactionId,
      graphId: this.#graphId,
      graphSchemaVersion: prepared.graph.schemaVersion,
      operationProtocolVersion: prepared.acceptedOperations[0]?.protocolVersion || '0.1.0',
      expectedHeadRevision: prepared.expectedHeadRevision,
      acceptedHeadRevision: prepared.graph.revision,
      intent: options.intent || prepared.intent || prepared.command?.type || 'system',
      summary: options.summary || `Canvas operation transaction ${prepared.transactionId}`,
      semanticCommand: {
        version: 'canvas-semantic-command-v1',
        type: options.intent || prepared.intent || prepared.command?.type || 'system',
        correlationId: prepared.command?.correlationId || null,
        actor: clone(prepared.command?.actor || {}),
        payload: {
          ...(clone(prepared.command?.payload || {})),
          channel: 'direct-canvas-session'
        }
      },
      operations: clone(prepared.acceptedOperations),
      inverseOperations: clone(prepared.inverseOperations),
      commitOperation: clone(prepared.commitOperation),
      actor: clone(prepared.command?.actor || {}),
      correlationId: prepared.command?.correlationId || null,
      revertsTransactionId: options.revertsTransactionId || null,
      redoesTransactionId: options.redoesTransactionId || null,
      affectedNodeIds: affected.nodeIds,
      affectedEdgeIds: affected.edgeIds,
      sourceDocumentId: options.sourceDocumentId || null,
      sourceFingerprint: options.sourceFingerprint || null,
      createdAtClient: options.createdAtClient || new Date().toISOString()
    };
    const durable = await api.appendOperationTransaction(envelope);
    return { transaction: clone(durable), duplicate: durable.transactionId === prepared.transactionId && durable.acceptedHeadRevision !== prepared.graph.revision };
  }

  async listTransactions({ newestFirst = false } = {}) {
    const records = chronological(await journalApi().listOperationTransactions(this.#graphId));
    return (newestFirst ? records.reverse() : records).map(clone);
  }

  async pendingTransactions() {
    const records = await this.listTransactions();
    return records.filter((record) => !['server-confirmed', 'rejected'].includes(record.durabilityState)).map(clone);
  }

  async getHead() {
    return clone(await journalApi().getGraphHead(this.#graphId));
  }
}

export const CanvasOperationJournalBridge = Object.freeze({
  create: (graph) => new CanvasOperationJournal(graph)
});
