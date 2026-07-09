'use strict';

const crypto = require('crypto');

const GRAPH_SCHEMA_VERSION = '0.1.0';
const OPERATION_PROTOCOL_VERSION = '0.1.0';
const OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1';
const SEMANTIC_COMMAND_VERSION = 'canvas-semantic-command-v1';
const MAX_TRANSACTION_BYTES = 900 * 1024;
const MAX_GRAPH_BYTES = 8 * 1024 * 1024;
const MAX_OPERATIONS = 250;
const MAX_RANGE = 1000;

const EDITOR_ROLES = new Set(['platform_admin', 'owner', 'admin']);
const DEFAULT_PUBLISHER_ROLES = new Set(['platform_admin', 'owner']);
const OPERATION_TYPES = new Set([
  'node.create',
  'node.delete',
  'node.patch',
  'edge.create',
  'edge.delete',
  'graph.meta.patch',
  'selection.set',
  'transaction.commit'
]);
const TRANSACTION_INTENTS = new Set([
  'canvas.component.insert',
  'canvas.component.move',
  'canvas.component.resize',
  'canvas.component.reparent',
  'canvas.component.duplicate',
  'canvas.component.delete',
  'canvas.property.set',
  'canvas.layout.set',
  'canvas.visibility.set',
  'canvas.token.bind',
  'canvas.data.bind',
  'history.undo',
  'history.redo',
  'checkpoint.create',
  'migration.apply',
  'system'
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanString(value, maxLength = 200) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanId(value, maxLength = 200) {
  return cleanString(value, maxLength)
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function integer(value, fallback = -1) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((output, key) => {
      if (value[key] !== undefined) output[key] = stableValue(value[key]);
      return output;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const input = typeof value === 'string' ? value : stableStringify(value);
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function normalizeRole(value = '') {
  const role = cleanString(value, 100).toLowerCase().replace(/\s+/g, '_');
  if (role === 'super_admin') return 'platform_admin';
  if (role === 'organization_owner' || role === 'office_owner' || role === 'branch_owner') return 'owner';
  return role;
}

function isActiveProfile(profile = {}) {
  const status = cleanString(profile.status || 'active', 40).toLowerCase();
  const approval = cleanString(profile.approvalStatus || 'approved', 40).toLowerCase();
  return !['inactive', 'suspended', 'disabled', 'rejected'].includes(status)
    && !['rejected', 'denied', 'suspended'].includes(approval);
}

function permissionSet(profile = {}) {
  const result = new Set();
  const values = [profile.permissions, profile.capabilities, profile.studioPermissions];
  values.forEach((value) => {
    if (Array.isArray(value)) value.forEach((item) => result.add(cleanString(item, 120).toLowerCase()));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, enabled]) => {
        if (enabled === true) result.add(cleanString(key, 120).toLowerCase());
      });
    }
  });
  return result;
}

function canEditStudio(profile = {}) {
  return isActiveProfile(profile) && EDITOR_ROLES.has(normalizeRole(profile.role));
}

function canPublishStudio(profile = {}) {
  if (!isActiveProfile(profile)) return false;
  const role = normalizeRole(profile.role);
  if (DEFAULT_PUBLISHER_ROLES.has(role)) return true;
  const permissions = permissionSet(profile);
  return role === 'admin' && (
    profile.studioPublisher === true
    || profile.publisherAuthority === true
    || permissions.has('studio.publish')
    || permissions.has('studio.publisher')
  );
}

function normalizeActor(caller = {}) {
  return {
    id: cleanString(caller.uid || caller.id || 'system', 160) || 'system',
    type: 'user',
    role: cleanString(caller.role || 'owner', 100) || null
  };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function normalizeDate(value, label) {
  const text = cleanString(value, 64);
  if (!text || Number.isNaN(Date.parse(text))) throw new TypeError(`${label} must be an ISO date-time.`);
  return new Date(text).toISOString();
}

function normalizeOperation(raw, context, { commit = false } = {}) {
  const operation = assertPlainObject(raw, commit ? 'commitOperation' : 'operation');
  const operationId = cleanId(operation.operationId, 200);
  const type = cleanString(operation.type, 120);
  if (!operationId) throw new TypeError('Operations require operationId.');
  if (!OPERATION_TYPES.has(type)) throw new TypeError(`Unsupported operation type: ${type || 'missing'}.`);
  if (commit && type !== 'transaction.commit') throw new TypeError('commitOperation must use transaction.commit.');
  if (!commit && type === 'transaction.commit') throw new TypeError('Accepted operations must not contain transaction.commit.');
  if (cleanString(operation.protocolVersion, 80) !== OPERATION_PROTOCOL_VERSION) {
    throw new TypeError(`Unsupported operation protocol version: ${operation.protocolVersion || 'missing'}.`);
  }
  if (cleanString(operation.graphSchemaVersion, 80) !== GRAPH_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported graph schema version: ${operation.graphSchemaVersion || 'missing'}.`);
  }
  if (cleanId(operation.graphId, 220) !== context.graphId) throw new TypeError(`Operation ${operationId} targets a different graph.`);
  if (cleanId(operation.transactionId, 200) !== context.transactionId) throw new TypeError(`Operation ${operationId} has a mismatched transactionId.`);
  const baseRevision = operation.baseRevision === null || operation.baseRevision === undefined
    ? null
    : integer(operation.baseRevision);
  if (baseRevision === -1) throw new TypeError(`Operation ${operationId} has an invalid baseRevision.`);
  return {
    operationId,
    protocolVersion: OPERATION_PROTOCOL_VERSION,
    graphSchemaVersion: GRAPH_SCHEMA_VERSION,
    graphId: context.graphId,
    type,
    payload: clone(assertPlainObject(operation.payload || {}, `Operation ${operationId} payload`)),
    actor: normalizeActor(context.caller),
    baseRevision,
    transactionId: context.transactionId,
    correlationId: cleanId(operation.correlationId || context.correlationId, 200) || null,
    timestamp: normalizeDate(operation.timestamp, `Operation ${operationId} timestamp`),
    metadata: operation.metadata && typeof operation.metadata === 'object' && !Array.isArray(operation.metadata)
      ? clone(operation.metadata)
      : {}
  };
}

function requestHashInput(envelope) {
  return {
    envelopeVersion: OPERATION_ENVELOPE_VERSION,
    transactionId: envelope.transactionId,
    projectId: envelope.projectId,
    branchId: envelope.branchId,
    graphId: envelope.graphId,
    graphSchemaVersion: envelope.graphSchemaVersion,
    operationProtocolVersion: envelope.operationProtocolVersion,
    expectedHeadRevision: envelope.expectedHeadRevision,
    acceptedHeadRevision: envelope.acceptedHeadRevision,
    intent: envelope.intent,
    semanticCommand: envelope.semanticCommand,
    operations: envelope.operations,
    inverseOperations: envelope.inverseOperations,
    commitOperation: envelope.commitOperation,
    correlationId: envelope.correlationId,
    revertsTransactionId: envelope.revertsTransactionId,
    redoesTransactionId: envelope.redoesTransactionId,
    sourceDocumentId: envelope.sourceDocumentId,
    sourceFingerprint: envelope.sourceFingerprint
  };
}

function normalizeTransactionEnvelope(raw, context = {}) {
  const input = assertPlainObject(raw, 'Studio transaction');
  const size = Buffer.byteLength(JSON.stringify(input), 'utf8');
  if (size > MAX_TRANSACTION_BYTES) throw new RangeError('Studio transaction exceeds the maximum allowed size.');

  const transactionId = cleanId(input.transactionId, 200);
  const projectId = cleanId(context.projectId || input.projectId, 160);
  const branchId = cleanId(context.branchId || input.branchId, 160);
  const graphId = cleanId(input.graphId, 220);
  const clientSessionId = cleanId(input.clientSessionId, 200);
  const expectedHeadRevision = integer(input.expectedHeadRevision);
  const acceptedHeadRevision = integer(input.acceptedHeadRevision);
  const correlationId = cleanId(input.correlationId, 200) || null;
  if (!transactionId || !projectId || !branchId || !graphId) throw new TypeError('Studio transactions require transactionId, projectId, branchId, and graphId.');
  if (!clientSessionId || clientSessionId.length < 8) throw new TypeError('Studio transactions require a valid clientSessionId.');
  if (expectedHeadRevision < 0 || acceptedHeadRevision < expectedHeadRevision) throw new TypeError('Studio transaction revisions are invalid.');
  if (cleanString(input.graphSchemaVersion, 80) !== GRAPH_SCHEMA_VERSION) throw new TypeError('Unsupported graph schema version.');
  if (cleanString(input.operationProtocolVersion, 80) !== OPERATION_PROTOCOL_VERSION) throw new TypeError('Unsupported operation protocol version.');

  const intent = cleanString(input.intent || input.semanticCommand?.type || 'system', 140);
  if (!TRANSACTION_INTENTS.has(intent)) throw new TypeError(`Unsupported Studio transaction intent: ${intent}.`);
  const semanticCommand = input.semanticCommand && typeof input.semanticCommand === 'object' && !Array.isArray(input.semanticCommand)
    ? clone(input.semanticCommand)
    : null;
  if (semanticCommand && cleanString(semanticCommand.version, 80) !== SEMANTIC_COMMAND_VERSION) {
    throw new TypeError('Unsupported semantic command version.');
  }

  const operationInputs = Array.isArray(input.operations) ? input.operations : [];
  const inverseInputs = Array.isArray(input.inverseOperations) ? input.inverseOperations : [];
  if (!operationInputs.length || operationInputs.length > MAX_OPERATIONS) throw new RangeError(`Studio transactions require 1-${MAX_OPERATIONS} accepted operations.`);
  if (inverseInputs.length > MAX_OPERATIONS) throw new RangeError(`Studio transactions allow at most ${MAX_OPERATIONS} inverse operations.`);

  const operationContext = { transactionId, graphId, correlationId, caller: context.caller || {} };
  const operations = operationInputs.map((operation) => normalizeOperation(operation, operationContext));
  const inverseOperations = inverseInputs.map((operation) => normalizeOperation(operation, operationContext));
  const commitOperation = normalizeOperation(input.commitOperation, operationContext, { commit: true });
  const uniqueOperationIds = new Set(operations.map((operation) => operation.operationId));
  if (uniqueOperationIds.size !== operations.length) throw new TypeError('Accepted operation IDs must be unique within a transaction.');
  if (uniqueOperationIds.has(commitOperation.operationId)) throw new TypeError('commitOperation must use a unique operationId.');
  if (integer(commitOperation.payload?.startRevision) !== expectedHeadRevision) throw new TypeError('commitOperation startRevision does not match expectedHeadRevision.');
  if (integer(commitOperation.payload?.endRevision) !== acceptedHeadRevision) throw new TypeError('commitOperation endRevision does not match acceptedHeadRevision.');
  const committedIds = Array.isArray(commitOperation.payload?.operationIds)
    ? commitOperation.payload.operationIds.map((item) => cleanId(item, 200))
    : [];
  if (stableStringify(committedIds) !== stableStringify(operations.map((operation) => operation.operationId))) {
    throw new TypeError('commitOperation operationIds do not match the accepted operation order.');
  }

  const envelope = {
    envelopeVersion: OPERATION_ENVELOPE_VERSION,
    transactionId,
    companyId: cleanId(context.companyId, 128),
    projectId,
    branchId,
    graphId,
    graphSchemaVersion: GRAPH_SCHEMA_VERSION,
    operationProtocolVersion: OPERATION_PROTOCOL_VERSION,
    expectedHeadRevision,
    acceptedHeadRevision,
    intent,
    summary: cleanString(input.summary || `Studio transaction ${transactionId}`, 500),
    semanticCommand,
    operations,
    inverseOperations,
    commitOperation,
    actor: normalizeActor(context.caller),
    clientSessionId,
    correlationId,
    revertsTransactionId: cleanId(input.revertsTransactionId, 200) || null,
    redoesTransactionId: cleanId(input.redoesTransactionId, 200) || null,
    affectedNodeIds: Array.isArray(input.affectedNodeIds)
      ? [...new Set(input.affectedNodeIds.map((item) => cleanId(item, 200)).filter(Boolean))].slice(0, 5000)
      : [],
    affectedEdgeIds: Array.isArray(input.affectedEdgeIds)
      ? [...new Set(input.affectedEdgeIds.map((item) => cleanId(item, 200)).filter(Boolean))].slice(0, 5000)
      : [],
    sourceDocumentId: cleanId(input.sourceDocumentId, 220) || null,
    sourceFingerprint: cleanString(input.sourceFingerprint, 160) || null,
    createdAtClient: normalizeDate(input.createdAtClient, 'createdAtClient'),
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? clone(input.metadata) : {}
  };
  envelope.requestHash = sha256(requestHashInput(envelope));
  return envelope;
}

function evaluateCommit(branch = {}, envelope, existingTransaction = null) {
  if (existingTransaction) {
    if (cleanString(existingTransaction.requestHash, 128) === envelope.requestHash) {
      return { kind: 'idempotent', transaction: clone(existingTransaction) };
    }
    return {
      kind: 'id-conflict',
      conflict: {
        code: 'transaction-id-reused',
        transactionId: envelope.transactionId,
        storedRequestHash: existingTransaction.requestHash || null,
        submittedRequestHash: envelope.requestHash
      }
    };
  }
  const headRevision = integer(branch.headRevision, 0);
  const headSequence = integer(branch.headSequence, 0);
  if (envelope.expectedHeadRevision !== headRevision) {
    return {
      kind: 'revision-conflict',
      conflict: {
        code: 'branch-head-conflict',
        expectedHeadRevision: envelope.expectedHeadRevision,
        actualHeadRevision: headRevision,
        actualHeadSequence: headSequence,
        lastTransactionId: branch.lastTransactionId || null
      }
    };
  }
  return { kind: 'accept', headRevision, headSequence };
}

function assignCanonicalSequence(branch, envelope, acceptedAtServer) {
  const startSequence = integer(branch.headSequence, 0) + 1;
  const endSequence = startSequence + envelope.operations.length - 1;
  const operations = envelope.operations.map((operation, index) => ({
    ...clone(operation),
    sequence: startSequence + index,
    acceptedAtServer
  }));
  return {
    transaction: {
      ...clone(envelope),
      startSequence,
      endSequence,
      durabilityState: 'server-confirmed',
      acceptedAtServer,
      transactionHash: sha256({
        requestHash: envelope.requestHash,
        startSequence,
        endSequence,
        acceptedHeadRevision: envelope.acceptedHeadRevision
      })
    },
    operations,
    nextBranch: {
      ...clone(branch),
      headRevision: envelope.acceptedHeadRevision,
      headSequence: endSequence,
      lastTransactionId: envelope.transactionId,
      graphId: envelope.graphId,
      graphSchemaVersion: GRAPH_SCHEMA_VERSION,
      operationProtocolVersion: OPERATION_PROTOCOL_VERSION
    }
  };
}

function validateGraphSnapshot(raw, { graphId, revision } = {}) {
  const graph = clone(assertPlainObject(raw, 'Evara Graph snapshot'));
  const size = Buffer.byteLength(JSON.stringify(graph), 'utf8');
  if (size > MAX_GRAPH_BYTES) throw new RangeError('Evara Graph snapshot exceeds the maximum allowed size.');
  if (cleanString(graph.schemaVersion, 80) !== GRAPH_SCHEMA_VERSION) throw new TypeError('Checkpoint graph schema version is unsupported.');
  if (!cleanId(graph.graphId, 220)) throw new TypeError('Checkpoint graphId is required.');
  if (graphId && cleanId(graph.graphId, 220) !== cleanId(graphId, 220)) throw new TypeError('Checkpoint graphId does not match the branch graph.');
  if (integer(graph.revision) < 0) throw new TypeError('Checkpoint graph revision is invalid.');
  if (revision !== undefined && integer(graph.revision) !== integer(revision)) throw new TypeError('Checkpoint graph revision does not match the branch head.');
  if (!graph.nodes || typeof graph.nodes !== 'object' || Array.isArray(graph.nodes)) throw new TypeError('Checkpoint graph nodes must be an object.');
  if (!graph.edges || typeof graph.edges !== 'object' || Array.isArray(graph.edges)) throw new TypeError('Checkpoint graph edges must be an object.');
  if (!Array.isArray(graph.roots)) throw new TypeError('Checkpoint graph roots must be an array.');
  const graphHash = sha256(graph);
  return { graph, graphHash, bytes: size };
}

function validateCheckpointManifest(manifest = {}, branch = {}) {
  if (!manifest.trusted) throw new TypeError('A trusted checkpoint is required.');
  if (cleanId(manifest.graphId, 220) !== cleanId(branch.graphId, 220)) throw new TypeError('Checkpoint graphId does not match the branch.');
  if (integer(manifest.revision) !== integer(branch.headRevision, 0)) throw new TypeError('Checkpoint revision is not at the branch head.');
  if (integer(manifest.sequence) !== integer(branch.headSequence, 0)) throw new TypeError('Checkpoint sequence is not at the branch head.');
  if (!cleanString(manifest.graphHash, 128)) throw new TypeError('Checkpoint graphHash is required.');
  if (!cleanString(manifest.storagePath, 1000)) throw new TypeError('Checkpoint storagePath is required.');
  return true;
}

function validateReleaseRequest(data = {}, branch = {}, checkpoint = {}) {
  const pending = Array.isArray(data.pendingTransactionIds)
    ? data.pendingTransactionIds.map((item) => cleanId(item, 200)).filter(Boolean)
    : [];
  if (pending.length) {
    return {
      valid: false,
      code: 'unsynchronized-transactions',
      pendingTransactionIds: [...new Set(pending)]
    };
  }
  if (integer(data.expectedHeadRevision) !== integer(branch.headRevision, 0)) {
    return {
      valid: false,
      code: 'release-head-conflict',
      expectedHeadRevision: integer(data.expectedHeadRevision),
      actualHeadRevision: integer(branch.headRevision, 0)
    };
  }
  try {
    validateCheckpointManifest(checkpoint, branch);
  } catch (error) {
    return { valid: false, code: 'trusted-checkpoint-required', message: error.message };
  }
  return { valid: true, pendingTransactionIds: [] };
}

function normalizeRange(data = {}) {
  const afterSequence = integer(data.afterSequence, 0);
  const fromSequence = integer(data.fromSequence, afterSequence + 1);
  const toSequence = integer(data.toSequence, Number.MAX_SAFE_INTEGER);
  const limit = Math.min(MAX_RANGE, Math.max(1, integer(data.limit, 250)));
  if (toSequence < fromSequence) throw new TypeError('Operation range toSequence must be greater than or equal to fromSequence.');
  return { fromSequence, toSequence, limit };
}

function publicBranch(branch = {}) {
  return {
    companyId: cleanId(branch.companyId, 128),
    projectId: cleanId(branch.projectId, 160),
    branchId: cleanId(branch.branchId, 160),
    graphId: cleanId(branch.graphId, 220),
    graphSchemaVersion: cleanString(branch.graphSchemaVersion || GRAPH_SCHEMA_VERSION, 80),
    operationProtocolVersion: cleanString(branch.operationProtocolVersion || OPERATION_PROTOCOL_VERSION, 80),
    headRevision: integer(branch.headRevision, 0),
    headSequence: integer(branch.headSequence, 0),
    lastTransactionId: cleanId(branch.lastTransactionId, 200) || null,
    latestCheckpointId: cleanId(branch.latestCheckpointId, 200) || null,
    status: cleanString(branch.status || 'open', 40),
    createdAtMs: branch.createdAt?.toMillis?.() || branch.createdAtMs || null,
    updatedAtMs: branch.updatedAt?.toMillis?.() || branch.updatedAtMs || null
  };
}

module.exports = {
  GRAPH_SCHEMA_VERSION,
  OPERATION_PROTOCOL_VERSION,
  OPERATION_ENVELOPE_VERSION,
  SEMANTIC_COMMAND_VERSION,
  MAX_OPERATIONS,
  MAX_RANGE,
  EDITOR_ROLES,
  DEFAULT_PUBLISHER_ROLES,
  TRANSACTION_INTENTS,
  clone,
  cleanString,
  cleanId,
  integer,
  stableValue,
  stableStringify,
  sha256,
  normalizeRole,
  isActiveProfile,
  permissionSet,
  canEditStudio,
  canPublishStudio,
  normalizeActor,
  normalizeTransactionEnvelope,
  evaluateCommit,
  assignCanonicalSequence,
  validateGraphSnapshot,
  validateCheckpointManifest,
  validateReleaseRequest,
  normalizeRange,
  publicBranch
};
