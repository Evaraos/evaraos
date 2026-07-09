const GUARD_VERSION = 'studio-journal-idempotency-guard-v1';
const ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1';
const authority = window.EvaraStudioJournal;

if (!authority?.authorityVersion || !authority?.appendOperationTransaction || !authority?.listOperationTransactions) {
  throw new Error('The Studio Journal authority must load before the idempotency guard.');
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

function semanticOperation(operation = {}) {
  const output = clone(operation) || {};
  delete output.actor;
  return output;
}

function semanticCommand(command = null) {
  if (!command || typeof command !== 'object') return null;
  const output = clone(command);
  delete output.actor;
  return output;
}

function comparable(record = {}, fallback = {}) {
  const operations = record.operations ?? fallback.operations ?? [];
  const inverseOperations = record.inverseOperations ?? fallback.inverseOperations ?? [];
  const commitOperation = record.commitOperation ?? fallback.commitOperation ?? null;
  return {
    envelopeVersion: ENVELOPE_VERSION,
    transactionId: text(record.transactionId || fallback.transactionId, 180),
    graphId: text(record.graphId || fallback.graphId, 220),
    graphSchemaVersion: text(record.graphSchemaVersion || fallback.graphSchemaVersion, 80),
    operationProtocolVersion: text(record.operationProtocolVersion || fallback.operationProtocolVersion, 80),
    expectedHeadRevision: integer(record.expectedHeadRevision ?? fallback.expectedHeadRevision),
    acceptedHeadRevision: integer(record.acceptedHeadRevision ?? fallback.acceptedHeadRevision),
    intent: text(record.intent || fallback.intent, 140),
    summary: text(record.summary || fallback.summary, 500),
    semanticCommand: semanticCommand(record.semanticCommand ?? fallback.semanticCommand ?? null),
    operations: clone(operations).map(semanticOperation),
    inverseOperations: clone(inverseOperations).map(semanticOperation),
    commitOperation: commitOperation ? semanticOperation(commitOperation) : null,
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

function semanticallyEqual(existing, submitted) {
  return JSON.stringify(stable(comparable(existing))) === JSON.stringify(stable(comparable(submitted, existing)));
}

const append = authority.appendOperationTransaction.bind(authority);
async function guardedAppend(envelope, options = {}) {
  const transactionId = text(envelope?.transactionId, 180);
  if (!transactionId) throw new TypeError('Operation transaction requires transactionId.');
  const graphId = text(envelope?.graphId, 220);
  const records = await authority.listOperationTransactions(graphId);
  const existing = records.find((record) => record.transactionId === transactionId);
  if (!existing) return append(envelope, options);
  if (semanticallyEqual(existing, envelope)) return clone(existing);
  window.dispatchEvent(new CustomEvent('evara:studio-journal-status', {
    detail: {
      state: 'conflict',
      reason: 'local-idempotency-conflict',
      conflictCode: 'transaction-id-reused',
      transactionId,
      graphId,
      source: GUARD_VERSION
    }
  }));
  throw new Error(`Studio transaction ID ${transactionId} was reused with different content.`);
}

window.EvaraStudioJournal = Object.freeze({
  ...authority,
  appendOperationTransaction: guardedAppend,
  idempotencyGuardVersion: GUARD_VERSION
});
