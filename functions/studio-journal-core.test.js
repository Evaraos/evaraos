'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GRAPH_SCHEMA_VERSION,
  OPERATION_PROTOCOL_VERSION,
  OPERATION_ENVELOPE_VERSION,
  canEditStudio,
  canPublishStudio,
  normalizeTransactionEnvelope,
  evaluateCommit,
  assignCanonicalSequence,
  validateGraphSnapshot,
  validateReleaseRequest,
  sha256,
  stableStringify
} = require('./studio-journal-core');

const caller = {
  uid: 'owner-user-123',
  role: 'owner',
  companyId: 'company-1'
};

function operation({
  operationId = 'operation-0001',
  type = 'node.patch',
  transactionId = 'transaction-0001',
  graphId = 'graph:canvas:owner',
  payload = { nodeId: 'node-1', patch: { name: 'Updated' } }
} = {}) {
  return {
    operationId,
    protocolVersion: OPERATION_PROTOCOL_VERSION,
    graphSchemaVersion: GRAPH_SCHEMA_VERSION,
    graphId,
    type,
    payload,
    actor: { id: 'spoofed-client', type: 'user', role: 'owner' },
    baseRevision: null,
    transactionId,
    correlationId: 'correlation-0001',
    timestamp: '2026-07-09T12:00:00.000Z',
    metadata: { semanticIntent: 'canvas.property.set' }
  };
}

function envelope(overrides = {}) {
  const transactionId = overrides.transactionId || 'transaction-0001';
  const graphId = overrides.graphId || 'graph:canvas:owner';
  const operations = overrides.operations || [operation({ transactionId, graphId })];
  return {
    envelopeVersion: OPERATION_ENVELOPE_VERSION,
    transactionId,
    projectId: 'studio-project',
    branchId: 'main-draft',
    graphId,
    graphSchemaVersion: GRAPH_SCHEMA_VERSION,
    operationProtocolVersion: OPERATION_PROTOCOL_VERSION,
    expectedHeadRevision: 0,
    acceptedHeadRevision: 1,
    intent: 'canvas.property.set',
    summary: 'Update node title',
    semanticCommand: {
      version: 'canvas-semantic-command-v1',
      type: 'canvas.property.set',
      correlationId: 'correlation-0001',
      actor: { id: 'spoofed-client', type: 'user', role: 'owner' },
      payload: { nodeId: 'node-1', property: 'content.title', value: 'Updated' }
    },
    operations,
    inverseOperations: [operation({
      operationId: 'operation-inverse-0001',
      transactionId,
      graphId,
      payload: { nodeId: 'node-1', patch: { name: 'Before' } }
    })],
    commitOperation: operation({
      operationId: 'operation-commit-0001',
      type: 'transaction.commit',
      transactionId,
      graphId,
      payload: {
        operationIds: operations.map((item) => item.operationId),
        startRevision: 0,
        endRevision: 1
      }
    }),
    actor: { id: 'spoofed-client', type: 'user', role: 'owner' },
    clientSessionId: 'client-session-0001',
    correlationId: 'correlation-0001',
    revertsTransactionId: null,
    redoesTransactionId: null,
    affectedNodeIds: ['node-1'],
    affectedEdgeIds: [],
    sourceDocumentId: 'document-1',
    sourceFingerprint: 'fingerprint-1',
    createdAtClient: '2026-07-09T12:00:00.000Z',
    metadata: { test: true },
    ...overrides
  };
}

function normalized(overrides = {}) {
  return normalizeTransactionEnvelope(envelope(overrides), {
    companyId: caller.companyId,
    projectId: 'studio-project',
    branchId: 'main-draft',
    caller
  });
}

test('Studio editor and publisher authority are distinct', () => {
  assert.equal(canEditStudio({ role: 'admin', status: 'active', approvalStatus: 'approved' }), true);
  assert.equal(canPublishStudio({ role: 'admin', status: 'active', approvalStatus: 'approved' }), false);
  assert.equal(canPublishStudio({ role: 'admin', status: 'active', approvalStatus: 'approved', permissions: ['studio.publish'] }), true);
  assert.equal(canPublishStudio({ role: 'owner', status: 'active', approvalStatus: 'approved' }), true);
  assert.equal(canEditStudio({ role: 'manager', status: 'active', approvalStatus: 'approved' }), false);
});

test('transaction normalization overrides spoofed actors and produces a deterministic request hash', () => {
  const first = normalized();
  const second = normalized();
  assert.equal(first.actor.id, caller.uid);
  assert.equal(first.operations[0].actor.id, caller.uid);
  assert.equal(first.requestHash, second.requestHash);
  assert.equal(first.envelopeVersion, OPERATION_ENVELOPE_VERSION);
});

test('stable hashing ignores object key order', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  assert.equal(sha256({ b: 2, a: 1 }), sha256({ a: 1, b: 2 }));
});

test('same transaction ID and same content is idempotent', () => {
  const transaction = normalized();
  const existing = {
    ...transaction,
    durabilityState: 'server-confirmed',
    startSequence: 7,
    endSequence: 7,
    acceptedAtServer: '2026-07-09T12:01:00.000Z'
  };
  const result = evaluateCommit({ headRevision: 1, headSequence: 7 }, transaction, existing);
  assert.equal(result.kind, 'idempotent');
  assert.equal(result.transaction.transactionId, transaction.transactionId);
});

test('same transaction ID with different content is rejected as an ID conflict', () => {
  const submitted = normalized({ summary: 'Different content' });
  const existing = normalized();
  const result = evaluateCommit({ headRevision: 1, headSequence: 1 }, submitted, existing);
  assert.equal(result.kind, 'id-conflict');
  assert.equal(result.conflict.code, 'transaction-id-reused');
  assert.notEqual(result.conflict.storedRequestHash, result.conflict.submittedRequestHash);
});

test('two transactions against the same expected revision cannot silently overwrite', () => {
  const transaction = normalized();
  const result = evaluateCommit({ headRevision: 4, headSequence: 10, lastTransactionId: 'prior' }, transaction, null);
  assert.equal(result.kind, 'revision-conflict');
  assert.equal(result.conflict.expectedHeadRevision, 0);
  assert.equal(result.conflict.actualHeadRevision, 4);
  assert.equal(result.conflict.lastTransactionId, 'prior');
});

test('canonical sequence assignment gives every accepted operation an immutable sequence', () => {
  const operations = [
    operation({ operationId: 'operation-0001' }),
    operation({ operationId: 'operation-0002', type: 'edge.create', payload: { edge: { id: 'edge-1', kind: 'contains', source: 'node-1', target: 'node-2' } } })
  ];
  const transaction = normalized({
    acceptedHeadRevision: 2,
    operations,
    commitOperation: operation({
      operationId: 'operation-commit-0001',
      type: 'transaction.commit',
      payload: { operationIds: ['operation-0001', 'operation-0002'], startRevision: 0, endRevision: 2 }
    })
  });
  const assigned = assignCanonicalSequence({ headRevision: 0, headSequence: 8 }, transaction, '2026-07-09T12:01:00.000Z');
  assert.equal(assigned.transaction.startSequence, 9);
  assert.equal(assigned.transaction.endSequence, 10);
  assert.deepEqual(assigned.operations.map((item) => item.sequence), [9, 10]);
  assert.equal(assigned.nextBranch.headRevision, 2);
  assert.equal(assigned.nextBranch.headSequence, 10);
});

test('normalization rejects mismatched commit operation IDs', () => {
  assert.throws(() => normalized({
    commitOperation: operation({
      operationId: 'operation-commit-0001',
      type: 'transaction.commit',
      payload: { operationIds: ['not-the-accepted-operation'], startRevision: 0, endRevision: 1 }
    })
  }), /operationIds do not match/);
});

test('normalization rejects unsupported graph and operation versions', () => {
  assert.throws(() => normalized({ graphSchemaVersion: '9.9.9' }), /Unsupported graph schema version/);
  assert.throws(() => normalized({ operationProtocolVersion: '9.9.9' }), /Unsupported operation protocol version/);
});

test('trusted checkpoint snapshots require matching graph identity and revision', () => {
  const graph = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    graphId: 'graph:canvas:owner',
    revision: 3,
    state: 'draft',
    metadata: {},
    nodes: {},
    edges: {},
    roots: []
  };
  const result = validateGraphSnapshot(graph, { graphId: graph.graphId, revision: 3 });
  assert.equal(result.graphHash.length, 64);
  assert.equal(result.graph.revision, 3);
  assert.throws(() => validateGraphSnapshot(graph, { graphId: graph.graphId, revision: 4 }), /revision does not match/);
});

test('release preparation blocks unsynchronized transactions', () => {
  const branch = {
    graphId: 'graph:canvas:owner',
    headRevision: 3,
    headSequence: 7
  };
  const checkpoint = {
    trusted: true,
    graphId: branch.graphId,
    revision: 3,
    sequence: 7,
    graphHash: 'abc',
    storagePath: 'studio/checkpoints/checkpoint.json'
  };
  const blocked = validateReleaseRequest({ expectedHeadRevision: 3, pendingTransactionIds: ['pending-1'] }, branch, checkpoint);
  assert.equal(blocked.valid, false);
  assert.equal(blocked.code, 'unsynchronized-transactions');
  const allowed = validateReleaseRequest({ expectedHeadRevision: 3, pendingTransactionIds: [] }, branch, checkpoint);
  assert.equal(allowed.valid, true);
});
