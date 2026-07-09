export const EVARA_GRAPH_SCHEMA_VERSION = '0.1.0';

export const EVARA_GRAPH_STATES = Object.freeze([
  'draft',
  'review',
  'release-candidate',
  'published',
  'archived'
]);

export const EVARA_NODE_KINDS = Object.freeze([
  // Experience
  'workspace', 'application', 'page', 'route', 'modal', 'panel', 'navigation', 'frame', 'container',
  // Interface
  'component-definition', 'component-instance', 'slot', 'text', 'icon', 'image', 'button', 'card',
  'chart', 'map', 'form', 'table', 'list', 'calendar',
  // Design
  'theme', 'token-collection', 'token', 'token-mode', 'variable', 'style-rule', 'effect', 'animation',
  'transition', 'responsive-condition',
  // Operations
  'module', 'data-entity', 'data-field', 'query', 'filter', 'action', 'workflow', 'notification',
  'automation', 'integration',
  // Security
  'role', 'capability', 'permission-policy', 'visibility-rule', 'data-scope', 'field-mask', 'approval-policy',
  // Lifecycle
  'blueprint', 'blueprint-instance', 'draft', 'branch', 'snapshot', 'release', 'environment', 'migration',
  'audit-event'
]);

export const EVARA_EDGE_KINDS = Object.freeze([
  'contains',
  'inherits',
  'instantiates',
  'bindsTo',
  'visibleTo',
  'triggers',
  'readsFrom',
  'writesTo',
  'styledBy',
  'overrides',
  'dependsOn',
  'publishesAs',
  'guards',
  'navigatesTo',
  'emits',
  'consumes'
]);

const NODE_KIND_SET = new Set(EVARA_NODE_KINDS);
const EDGE_KIND_SET = new Set(EVARA_EDGE_KINDS);
const GRAPH_STATE_SET = new Set(EVARA_GRAPH_STATES);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  const entropy = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${entropy}`;
}

export function cloneEvaraGraph(graph) {
  if (globalThis.structuredClone) return globalThis.structuredClone(graph);
  return JSON.parse(JSON.stringify(graph));
}

export function createEvaraGraph({
  graphId = randomId('graph'),
  name = 'Untitled EvaraOS Draft',
  state = 'draft',
  createdBy = 'system',
  metadata = {}
} = {}) {
  if (!GRAPH_STATE_SET.has(state)) throw new Error(`Unsupported graph state: ${state}`);
  const timestamp = nowIso();

  return {
    graphId,
    schemaVersion: EVARA_GRAPH_SCHEMA_VERSION,
    name,
    state,
    revision: 0,
    nodes: {},
    edges: {},
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy,
      updatedBy: createdBy,
      ...metadata
    }
  };
}

export function createGraphNode({
  id = randomId('node'),
  kind,
  name = '',
  props = {},
  metadata = {}
} = {}) {
  if (!NODE_KIND_SET.has(kind)) throw new Error(`Unsupported node kind: ${kind}`);
  const timestamp = nowIso();

  return {
    id,
    kind,
    name,
    revision: 0,
    props: { ...props },
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      ...metadata
    }
  };
}

export function createGraphEdge({
  id = randomId('edge'),
  kind,
  source,
  target,
  props = {},
  metadata = {}
} = {}) {
  if (!EDGE_KIND_SET.has(kind)) throw new Error(`Unsupported edge kind: ${kind}`);
  if (!source || !target) throw new Error('Graph edges require source and target node IDs.');
  const timestamp = nowIso();

  return {
    id,
    kind,
    source,
    target,
    revision: 0,
    props: { ...props },
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      ...metadata
    }
  };
}

export function validateEvaraGraph(graph, { allowPublishedMutability = false } = {}) {
  const errors = [];
  const warnings = [];

  if (!graph || typeof graph !== 'object') {
    return { valid: false, errors: ['Graph must be an object.'], warnings };
  }

  if (!graph.graphId) errors.push('Graph is missing graphId.');
  if (!graph.schemaVersion) errors.push('Graph is missing schemaVersion.');
  if (!GRAPH_STATE_SET.has(graph.state)) errors.push(`Unsupported graph state: ${graph.state}`);
  if (!Number.isInteger(graph.revision) || graph.revision < 0) errors.push('Graph revision must be a non-negative integer.');
  if (!graph.nodes || typeof graph.nodes !== 'object' || Array.isArray(graph.nodes)) errors.push('Graph nodes must be an object map.');
  if (!graph.edges || typeof graph.edges !== 'object' || Array.isArray(graph.edges)) errors.push('Graph edges must be an object map.');

  const nodes = graph.nodes || {};
  const edges = graph.edges || {};

  for (const [key, node] of Object.entries(nodes)) {
    if (!node || typeof node !== 'object') {
      errors.push(`Node ${key} must be an object.`);
      continue;
    }
    if (node.id !== key) errors.push(`Node map key ${key} does not match node.id ${node.id}.`);
    if (!NODE_KIND_SET.has(node.kind)) errors.push(`Node ${key} has unsupported kind ${node.kind}.`);
    if (!Number.isInteger(node.revision) || node.revision < 0) errors.push(`Node ${key} revision must be a non-negative integer.`);
    if (!node.props || typeof node.props !== 'object' || Array.isArray(node.props)) errors.push(`Node ${key} props must be an object.`);
  }

  for (const [key, edge] of Object.entries(edges)) {
    if (!edge || typeof edge !== 'object') {
      errors.push(`Edge ${key} must be an object.`);
      continue;
    }
    if (edge.id !== key) errors.push(`Edge map key ${key} does not match edge.id ${edge.id}.`);
    if (!EDGE_KIND_SET.has(edge.kind)) errors.push(`Edge ${key} has unsupported kind ${edge.kind}.`);
    if (!nodes[edge.source]) errors.push(`Edge ${key} references missing source node ${edge.source}.`);
    if (!nodes[edge.target]) errors.push(`Edge ${key} references missing target node ${edge.target}.`);
    if (!Number.isInteger(edge.revision) || edge.revision < 0) errors.push(`Edge ${key} revision must be a non-negative integer.`);
  }

  if (graph.state === 'published' && !allowPublishedMutability && graph.metadata?.mutable === true) {
    errors.push('Published graphs cannot be marked mutable.');
  }

  const rootCandidates = Object.values(nodes).filter((node) => ['workspace', 'application'].includes(node.kind));
  if (nodes && Object.keys(nodes).length > 0 && rootCandidates.length === 0) {
    warnings.push('Graph has nodes but no workspace or application root.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidEvaraGraph(graph, options) {
  const result = validateEvaraGraph(graph, options);
  if (!result.valid) throw new Error(`Invalid Evara Graph: ${result.errors.join(' | ')}`);
  return graph;
}

export function getGraphNode(graph, nodeId) {
  return graph?.nodes?.[nodeId] || null;
}

export function getGraphEdge(graph, edgeId) {
  return graph?.edges?.[edgeId] || null;
}

export function getOutgoingEdges(graph, nodeId, kind = null) {
  return Object.values(graph?.edges || {}).filter((edge) => edge.source === nodeId && (!kind || edge.kind === kind));
}

export function getIncomingEdges(graph, nodeId, kind = null) {
  return Object.values(graph?.edges || {}).filter((edge) => edge.target === nodeId && (!kind || edge.kind === kind));
}

export function getConnectedNodes(graph, nodeId, { direction = 'both', kind = null } = {}) {
  const edges = [];
  if (direction === 'outgoing' || direction === 'both') edges.push(...getOutgoingEdges(graph, nodeId, kind));
  if (direction === 'incoming' || direction === 'both') edges.push(...getIncomingEdges(graph, nodeId, kind));

  const ids = new Set();
  for (const edge of edges) ids.add(edge.source === nodeId ? edge.target : edge.source);
  return [...ids].map((id) => getGraphNode(graph, id)).filter(Boolean);
}

export function calculateImpact(graph, nodeId) {
  const visited = new Set([nodeId]);
  const queue = [nodeId];
  const impactedEdges = new Set();

  while (queue.length) {
    const current = queue.shift();
    const dependentEdges = Object.values(graph?.edges || {}).filter((edge) =>
      edge.target === current && ['dependsOn', 'instantiates', 'styledBy', 'bindsTo', 'visibleTo', 'guards'].includes(edge.kind)
    );

    for (const edge of dependentEdges) {
      impactedEdges.add(edge.id);
      if (!visited.has(edge.source)) {
        visited.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return {
    rootNodeId: nodeId,
    nodeIds: [...visited],
    edgeIds: [...impactedEdges]
  };
}

export function graphSummary(graph) {
  const nodeKinds = {};
  const edgeKinds = {};

  for (const node of Object.values(graph?.nodes || {})) nodeKinds[node.kind] = (nodeKinds[node.kind] || 0) + 1;
  for (const edge of Object.values(graph?.edges || {})) edgeKinds[edge.kind] = (edgeKinds[edge.kind] || 0) + 1;

  return {
    graphId: graph?.graphId || null,
    schemaVersion: graph?.schemaVersion || null,
    state: graph?.state || null,
    revision: graph?.revision ?? null,
    nodeCount: Object.keys(graph?.nodes || {}).length,
    edgeCount: Object.keys(graph?.edges || {}).length,
    nodeKinds,
    edgeKinds
  };
}

export const EvaraGraph = Object.freeze({
  schemaVersion: EVARA_GRAPH_SCHEMA_VERSION,
  nodeKinds: EVARA_NODE_KINDS,
  edgeKinds: EVARA_EDGE_KINDS,
  states: EVARA_GRAPH_STATES,
  create: createEvaraGraph,
  createNode: createGraphNode,
  createEdge: createGraphEdge,
  clone: cloneEvaraGraph,
  validate: validateEvaraGraph,
  assertValid: assertValidEvaraGraph,
  getNode: getGraphNode,
  getEdge: getGraphEdge,
  outgoing: getOutgoingEdges,
  incoming: getIncomingEdges,
  connected: getConnectedNodes,
  impact: calculateImpact,
  summary: graphSummary
});

if (typeof window !== 'undefined') window.EvaraGraph = EvaraGraph;
