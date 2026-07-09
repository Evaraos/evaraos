import {
  EVARA_GRAPH_SCHEMA_VERSION,
  assertValidEvaraGraph,
  cloneEvaraGraph,
  createGraphEdge,
  createGraphNode
} from './evara-graph.js';

export const EVARA_OPERATION_PROTOCOL_VERSION = '0.1.0';

export const EVARA_OPERATION_TYPES = Object.freeze([
  'node.create',
  'node.delete',
  'node.patch',
  'edge.create',
  'edge.delete',
  'graph.meta.patch',
  'selection.set',
  'transaction.commit'
]);

const OPERATION_TYPE_SET = new Set(EVARA_OPERATION_TYPES);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeActor(actor) {
  if (typeof actor === 'string') return { id: actor, type: 'user' };
  return { id: actor?.id || 'system', type: actor?.type || 'system', role: actor?.role || null };
}

export function createOperation({
  operationId = randomId('op'),
  graphId,
  type,
  payload = {},
  actor = 'system',
  baseRevision = null,
  transactionId = null,
  correlationId = null,
  metadata = {}
} = {}) {
  if (!graphId) throw new Error('Operations require graphId.');
  if (!OPERATION_TYPE_SET.has(type)) throw new Error(`Unsupported operation type: ${type}`);

  return {
    operationId,
    protocolVersion: EVARA_OPERATION_PROTOCOL_VERSION,
    graphSchemaVersion: EVARA_GRAPH_SCHEMA_VERSION,
    graphId,
    type,
    payload,
    actor: normalizeActor(actor),
    baseRevision,
    transactionId,
    correlationId,
    timestamp: nowIso(),
    metadata
  };
}

export function validateOperation(operation, graph = null) {
  const errors = [];

  if (!operation || typeof operation !== 'object') return { valid: false, errors: ['Operation must be an object.'] };
  if (!operation.operationId) errors.push('Operation is missing operationId.');
  if (!operation.graphId) errors.push('Operation is missing graphId.');
  if (!OPERATION_TYPE_SET.has(operation.type)) errors.push(`Unsupported operation type: ${operation.type}`);
  if (!operation.payload || typeof operation.payload !== 'object') errors.push('Operation payload must be an object.');

  if (graph) {
    if (operation.graphId !== graph.graphId) errors.push(`Operation graphId ${operation.graphId} does not match graph ${graph.graphId}.`);
    if (operation.baseRevision !== null && operation.baseRevision !== graph.revision) {
      errors.push(`Revision conflict: operation expects ${operation.baseRevision}, graph is ${graph.revision}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function assertOperation(operation, graph) {
  const result = validateOperation(operation, graph);
  if (!result.valid) throw new Error(`Invalid Evara operation: ${result.errors.join(' | ')}`);
}

function touchGraph(graph, operation) {
  graph.revision += 1;
  graph.metadata = {
    ...(graph.metadata || {}),
    updatedAt: operation.timestamp || nowIso(),
    updatedBy: operation.actor?.id || 'system',
    lastOperationId: operation.operationId
  };
}

function mergePatch(current, patch, replace = false) {
  if (replace) return cloneEvaraGraph(patch);
  const next = { ...(current || {}) };

  for (const [key, value] of Object.entries(patch || {})) {
    if (value === undefined) continue;
    if (value === null) {
      delete next[key];
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && current?.[key] && typeof current[key] === 'object' && !Array.isArray(current[key])) {
      next[key] = mergePatch(current[key], value, false);
    } else {
      next[key] = cloneEvaraGraph(value);
    }
  }

  return next;
}

function inverseForCreateNode(graphId, nodeId, actor, transactionId) {
  return createOperation({
    graphId,
    type: 'node.delete',
    actor,
    transactionId,
    payload: { nodeId, cascade: true }
  });
}

function inverseForDeleteNode(graphId, node, connectedEdges, actor, transactionId) {
  const inverse = [createOperation({
    graphId,
    type: 'node.create',
    actor,
    transactionId,
    payload: { node }
  })];

  for (const edge of connectedEdges) {
    inverse.push(createOperation({
      graphId,
      type: 'edge.create',
      actor,
      transactionId,
      payload: { edge }
    }));
  }

  return inverse;
}

function applyMutation(graph, operation) {
  const inverse = [];
  const payload = operation.payload || {};

  switch (operation.type) {
    case 'node.create': {
      const node = payload.node?.kind ? { ...payload.node } : createGraphNode(payload.node || payload);
      if (graph.nodes[node.id]) throw new Error(`Node already exists: ${node.id}`);
      graph.nodes[node.id] = cloneEvaraGraph(node);
      inverse.push(inverseForCreateNode(graph.graphId, node.id, operation.actor, operation.transactionId));
      break;
    }

    case 'node.delete': {
      const node = graph.nodes[payload.nodeId];
      if (!node) throw new Error(`Cannot delete missing node: ${payload.nodeId}`);
      const connectedEdges = Object.values(graph.edges).filter((edge) => edge.source === payload.nodeId || edge.target === payload.nodeId);
      if (connectedEdges.length && !payload.cascade) {
        throw new Error(`Node ${payload.nodeId} has ${connectedEdges.length} connected edge(s); cascade is required.`);
      }
      inverse.push(...inverseForDeleteNode(graph.graphId, cloneEvaraGraph(node), connectedEdges.map(cloneEvaraGraph), operation.actor, operation.transactionId));
      for (const edge of connectedEdges) delete graph.edges[edge.id];
      delete graph.nodes[payload.nodeId];
      break;
    }

    case 'node.patch': {
      const node = graph.nodes[payload.nodeId];
      if (!node) throw new Error(`Cannot patch missing node: ${payload.nodeId}`);
      const before = cloneEvaraGraph(node);
      const replacement = payload.replace === true
        ? cloneEvaraGraph(payload.patch)
        : mergePatch(node, payload.patch || {}, false);
      replacement.id = node.id;
      replacement.kind = replacement.kind || node.kind;
      replacement.revision = node.revision + 1;
      replacement.metadata = {
        ...(replacement.metadata || {}),
        updatedAt: operation.timestamp || nowIso(),
        updatedBy: operation.actor?.id || 'system'
      };
      graph.nodes[payload.nodeId] = replacement;
      inverse.push(createOperation({
        graphId: graph.graphId,
        type: 'node.patch',
        actor: operation.actor,
        transactionId: operation.transactionId,
        payload: { nodeId: payload.nodeId, patch: before, replace: true }
      }));
      break;
    }

    case 'edge.create': {
      const edge = payload.edge?.kind ? { ...payload.edge } : createGraphEdge(payload.edge || payload);
      if (graph.edges[edge.id]) throw new Error(`Edge already exists: ${edge.id}`);
      if (!graph.nodes[edge.source] || !graph.nodes[edge.target]) throw new Error(`Edge ${edge.id} references a missing node.`);
      graph.edges[edge.id] = cloneEvaraGraph(edge);
      inverse.push(createOperation({
        graphId: graph.graphId,
        type: 'edge.delete',
        actor: operation.actor,
        transactionId: operation.transactionId,
        payload: { edgeId: edge.id }
      }));
      break;
    }

    case 'edge.delete': {
      const edge = graph.edges[payload.edgeId];
      if (!edge) throw new Error(`Cannot delete missing edge: ${payload.edgeId}`);
      const before = cloneEvaraGraph(edge);
      delete graph.edges[payload.edgeId];
      inverse.push(createOperation({
        graphId: graph.graphId,
        type: 'edge.create',
        actor: operation.actor,
        transactionId: operation.transactionId,
        payload: { edge: before }
      }));
      break;
    }

    case 'graph.meta.patch': {
      const before = cloneEvaraGraph(graph.metadata || {});
      graph.metadata = mergePatch(graph.metadata || {}, payload.patch || {}, payload.replace === true);
      inverse.push(createOperation({
        graphId: graph.graphId,
        type: 'graph.meta.patch',
        actor: operation.actor,
        transactionId: operation.transactionId,
        payload: { patch: before, replace: true }
      }));
      break;
    }

    case 'selection.set': {
      // Selection is an ephemeral collaboration/canvas event. It is accepted by
      // the protocol but intentionally does not mutate the publishable graph.
      break;
    }

    case 'transaction.commit': {
      // The transaction envelope is journal metadata. Individual operations
      // already contain the actual graph mutations.
      break;
    }

    default:
      throw new Error(`Operation is not implemented: ${operation.type}`);
  }

  if (!['selection.set', 'transaction.commit'].includes(operation.type)) touchGraph(graph, operation);
  return inverse;
}

export function applyOperation(graph, operation, {
  validateGraph = true,
  allowPublishedMutation = false
} = {}) {
  assertOperation(operation, graph);
  if (graph.state === 'published' && !allowPublishedMutation) {
    throw new Error('Published Evara Graph releases are immutable. Create a draft branch before editing.');
  }

  const next = cloneEvaraGraph(graph);
  const inverse = applyMutation(next, operation);
  if (validateGraph) assertValidEvaraGraph(next);

  return {
    graph: next,
    acceptedOperation: cloneEvaraGraph(operation),
    inverseOperations: inverse
  };
}

export function applyTransaction(graph, operations, {
  transactionId = randomId('tx'),
  actor = 'system',
  validateGraph = true,
  allowPublishedMutation = false
} = {}) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error('Transactions require at least one operation.');
  if (graph.state === 'published' && !allowPublishedMutation) {
    throw new Error('Published Evara Graph releases are immutable. Create a draft branch before editing.');
  }

  let next = cloneEvaraGraph(graph);
  const acceptedOperations = [];
  const inverseGroups = [];

  for (const input of operations) {
    const operation = {
      ...input,
      transactionId: input.transactionId || transactionId,
      actor: input.actor || normalizeActor(actor),
      baseRevision: input.baseRevision ?? null
    };
    assertOperation(operation, next);
    const inverse = applyMutation(next, operation);
    acceptedOperations.push(cloneEvaraGraph(operation));
    inverseGroups.push(inverse);
  }

  if (validateGraph) assertValidEvaraGraph(next);

  const commitOperation = createOperation({
    graphId: graph.graphId,
    type: 'transaction.commit',
    actor,
    transactionId,
    payload: {
      operationIds: acceptedOperations.map((operation) => operation.operationId),
      startRevision: graph.revision,
      endRevision: next.revision
    }
  });

  return {
    graph: next,
    transactionId,
    acceptedOperations,
    commitOperation,
    inverseOperations: inverseGroups.reverse().flat()
  };
}

export function replayOperations(baseGraph, operations, options = {}) {
  let graph = cloneEvaraGraph(baseGraph);
  const accepted = [];

  for (const operation of operations || []) {
    if (operation.type === 'transaction.commit') continue;
    const result = applyOperation(graph, operation, options);
    graph = result.graph;
    accepted.push(result.acceptedOperation);
  }

  return { graph, acceptedOperations: accepted };
}

export function createUndoTransaction(graph, inverseOperations, actor = 'system') {
  const transactionId = randomId('undo');
  return (inverseOperations || []).map((operation) => ({
    ...operation,
    operationId: randomId('op'),
    transactionId,
    actor: normalizeActor(actor),
    baseRevision: null,
    timestamp: nowIso(),
    metadata: { ...(operation.metadata || {}), intent: 'undo' }
  }));
}

export const EvaraOperationProtocol = Object.freeze({
  version: EVARA_OPERATION_PROTOCOL_VERSION,
  types: EVARA_OPERATION_TYPES,
  create: createOperation,
  validate: validateOperation,
  apply: applyOperation,
  transaction: applyTransaction,
  replay: replayOperations,
  createUndoTransaction
});

if (typeof window !== 'undefined') window.EvaraOperationProtocol = EvaraOperationProtocol;
