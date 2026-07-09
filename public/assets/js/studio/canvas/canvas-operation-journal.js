import {
  assertValidEvaraGraph,
  cloneEvaraGraph
} from '../core/evara-graph.js';
import { replayOperations } from '../core/operation-protocol.js';

const OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1';
const CONFIRMED_STATES = new Set(['server-confirmed', 'rejected']);

function clone(value) {
  return cloneEvaraGraph(value);
}

function integer(value, fallback = -1) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : fallback;
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

function recoveryError(code, message, cause = null) {
  const error = new Error(message);
  error.name = 'CanvasJournalRecoveryError';
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function emitRecovery(error, graphId, extra = {}) {
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: {
      state: 'recovery-required',
      reason: 'canvas-operation-recovery',
      graphId,
      recoveryCode: error?.code || 'canvas-recovery-failed',
      error: String(error?.message || error).slice(0, 300),
      ...extra
    }
  }));
}

function validateOperationReference(operation, record, label) {
  const errors = [];
  if (!operation || typeof operation !== 'object') return [`${label} must be an object.`];
  if (!operation.operationId) errors.push(`${label} is missing operationId.`);
  if (operation.graphId !== record.graphId) errors.push(`${label} targets graph ${operation.graphId || 'none'} instead of ${record.graphId}.`);
  if (operation.transactionId !== record.transactionId) errors.push(`${label} has a mismatched transactionId.`);
  return errors;
}

function validateTransactionRecord(record, {
  graphId,
  expectedRevision,
  expectedSequence
} = {}) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['Transaction record must be an object.'] };
  }

  if (record.envelopeVersion !== OPERATION_ENVELOPE_VERSION) errors.push(`Unsupported envelopeVersion ${record.envelopeVersion || 'missing'}.`);
  if (!record.transactionId) errors.push('Missing transactionId.');
  if (record.graphId !== graphId) errors.push(`Transaction graphId ${record.graphId || 'missing'} does not match ${graphId}.`);
  if (integer(record.expectedHeadRevision) !== expectedRevision) {
    errors.push(`Expected revision chain ${expectedRevision}, transaction declares ${record.expectedHeadRevision}.`);
  }
  if (integer(record.acceptedHeadRevision) < expectedRevision) errors.push('acceptedHeadRevision is invalid.');
  if (integer(record.startSequence) !== expectedSequence + 1) {
    errors.push(`Expected sequence ${expectedSequence + 1}, transaction declares ${record.startSequence}.`);
  }
  if (integer(record.endSequence) !== integer(record.startSequence)) errors.push('Transaction sequence range must contain exactly one Journal sequence.');
  if (!record.createdAtClient || Number.isNaN(Date.parse(record.createdAtClient))) errors.push('createdAtClient is invalid.');
  if (!Array.isArray(record.operations) || !record.operations.length) errors.push('Accepted operations are required.');
  if (!Array.isArray(record.inverseOperations)) errors.push('inverseOperations must be an array.');

  (record.operations || []).forEach((operation, index) => {
    errors.push(...validateOperationReference(operation, record, `operations[${index}]`));
    if (operation?.type === 'transaction.commit') errors.push(`operations[${index}] must not contain transaction.commit.`);
  });
  (record.inverseOperations || []).forEach((operation, index) => {
    errors.push(...validateOperationReference(operation, record, `inverseOperations[${index}]`));
  });

  errors.push(...validateOperationReference(record.commitOperation, record, 'commitOperation'));
  if (record.commitOperation?.type !== 'transaction.commit') errors.push('commitOperation must use transaction.commit.');
  if (integer(record.commitOperation?.payload?.startRevision) !== expectedRevision) errors.push('commitOperation startRevision does not match the revision chain.');
  if (integer(record.commitOperation?.payload?.endRevision) !== integer(record.acceptedHeadRevision)) errors.push('commitOperation endRevision does not match acceptedHeadRevision.');

  return { valid: errors.length === 0, errors };
}

function diagnosticsFor(records, head, graph = null) {
  const pending = records.filter((record) => !CONFIRMED_STATES.has(record.durabilityState));
  const latest = records.at(-1) || null;
  const transactionCount = records.length;
  const pendingCount = pending.length;
  return {
    graphId: head?.graphId || graph?.graphId || null,
    graphRevision: graph?.revision ?? integer(latest?.acceptedHeadRevision, 0),
    headRevision: integer(head?.revision, 0),
    headSequence: integer(head?.sequence, 0),
    lastTransactionId: head?.lastTransactionId || latest?.transactionId || null,
    transactionCount,
    pendingCount,
    unsynchronizedChanges: pendingCount > 0,
    syncState: pendingCount > 0 || transactionCount === 0 ? 'saved-locally' : 'server-confirmed',
    integrityState: 'verified'
  };
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
    let expectedRevision = 0;
    let expectedSequence = 0;

    try {
      for (const record of records) {
        const validation = validateTransactionRecord(record, {
          graphId: this.#graphId,
          expectedRevision,
          expectedSequence
        });
        if (!validation.valid) {
          throw recoveryError(
            'canvas-transaction-integrity',
            `Canvas transaction ${record?.transactionId || 'unknown'} failed integrity validation: ${validation.errors.join(' ')}`
          );
        }

        graph = replayOperations(graph, record.operations, {
          validateGraph: true,
          allowPublishedMutation: false
        }).graph;

        if (graph.revision !== integer(record.acceptedHeadRevision)) {
          throw recoveryError(
            'canvas-transaction-revision',
            `Canvas transaction ${record.transactionId} replayed to revision ${graph.revision}, expected ${record.acceptedHeadRevision}.`
          );
        }
        expectedRevision = graph.revision;
        expectedSequence = integer(record.endSequence);
      }
      assertValidEvaraGraph(graph);
    } catch (error) {
      const recovery = error?.name === 'CanvasJournalRecoveryError'
        ? error
        : recoveryError('canvas-operation-replay', `Canvas operation recovery failed: ${error?.message || error}`, error);
      emitRecovery(recovery, this.#graphId, { expectedRevision, expectedSequence });
      throw recovery;
    }

    const head = await api.getGraphHead(this.#graphId);
    const latest = records.at(-1) || null;
    if (integer(head.revision, 0) !== graph.revision
      || integer(head.sequence, 0) !== expectedSequence
      || (latest && head.lastTransactionId !== latest.transactionId)) {
      const error = recoveryError(
        'canvas-graph-head-mismatch',
        `Canvas graph head mismatch: Journal r${head.revision || 0}/s${head.sequence || 0}, replay r${graph.revision}/s${expectedSequence}.`
      );
      emitRecovery(error, this.#graphId, {
        journalRevision: integer(head.revision, 0),
        replayRevision: graph.revision,
        journalSequence: integer(head.sequence, 0),
        replaySequence: expectedSequence
      });
      throw error;
    }

    const diagnostics = diagnosticsFor(records, head, graph);
    return {
      graph,
      transactions: records.map(clone),
      head: clone(head),
      diagnostics,
      durabilityState: diagnostics.syncState
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
    const diagnostics = await this.getDiagnostics();
    return {
      transaction: clone(durable),
      duplicate: durable.createdAtClient !== envelope.createdAtClient,
      head: await this.getHead(),
      diagnostics
    };
  }

  async listTransactions({ newestFirst = false } = {}) {
    const records = chronological(await journalApi().listOperationTransactions(this.#graphId));
    return (newestFirst ? records.reverse() : records).map(clone);
  }

  async pendingTransactions() {
    const records = await this.listTransactions();
    return records.filter((record) => !CONFIRMED_STATES.has(record.durabilityState)).map(clone);
  }

  async getHead() {
    return clone(await journalApi().getGraphHead(this.#graphId));
  }

  async getDiagnostics() {
    const [records, head] = await Promise.all([
      this.listTransactions(),
      this.getHead()
    ]);
    return diagnosticsFor(records, head);
  }
}

export const CanvasOperationJournalBridge = Object.freeze({
  create: (graph) => new CanvasOperationJournal(graph),
  validateTransaction: validateTransactionRecord
});
