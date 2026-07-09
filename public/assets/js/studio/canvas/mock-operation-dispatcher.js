import {
  assertValidEvaraGraph,
  cloneEvaraGraph,
  createGraphEdge,
  createGraphNode,
  getOutgoingEdges
} from '../core/evara-graph.js';
import {
  applyTransaction,
  createOperation
} from '../core/operation-protocol.js';

export const CANVAS_SEMANTIC_COMMANDS = Object.freeze([
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
  'canvas.data.bind'
]);

const COMMAND_SET = new Set(CANVAS_SEMANTIC_COMMANDS);

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function text(value, fallback = '', max = 300) {
  const normalized = String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return normalized.slice(0, max) || fallback;
}

function actor(actorInput) {
  if (typeof actorInput === 'string') return { id: actorInput, type: 'user', role: null };
  return {
    id: text(actorInput?.id, 'studio-sandbox', 160),
    type: ['user', 'system', 'ai', 'migration'].includes(actorInput?.type) ? actorInput.type : 'user',
    role: actorInput?.role ? text(actorInput.role, '', 100) : null
  };
}

function containsEdge(graph, nodeId) {
  return Object.values(graph.edges).find((edge) => edge.kind === 'contains' && edge.target === nodeId) || null;
}

function orderedChildren(graph, parentId) {
  return getOutgoingEdges(graph, parentId, 'contains')
    .map((edge) => graph.nodes[edge.target])
    .filter(Boolean)
    .sort((left, right) => {
      const leftOrder = Number(left.props?.layout?.order ?? 0);
      const rightOrder = Number(right.props?.layout?.order ?? 0);
      return leftOrder - rightOrder || left.id.localeCompare(right.id);
    });
}

function assertEditableNode(graph, nodeId) {
  const node = graph.nodes[nodeId];
  if (!node) throw new Error(`Canvas command references missing node: ${nodeId}`);
  if (['workspace', 'application'].includes(node.kind)) throw new Error(`Canvas command cannot mutate root node ${nodeId}.`);
  return node;
}

function assertComponentNode(graph, nodeId) {
  const node = assertEditableNode(graph, nodeId);
  if (node.kind !== 'component-instance') throw new Error(`Canvas component command requires a component-instance: ${nodeId}`);
  return node;
}

function assertParent(graph, parentId) {
  const parent = graph.nodes[parentId];
  if (!parent) throw new Error(`Canvas parent does not exist: ${parentId}`);
  if (!['page', 'frame', 'container', 'panel', 'component-instance'].includes(parent.kind)) {
    throw new Error(`Node ${parentId} cannot contain Canvas components.`);
  }
  return parent;
}

function isDescendant(graph, candidateId, ancestorId) {
  const queue = [ancestorId];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const children = getOutgoingEdges(graph, current, 'contains').map((edge) => edge.target);
    if (children.includes(candidateId)) return true;
    queue.push(...children);
  }
  return false;
}

function nestedPatch(path, value) {
  const segments = String(path || '').split('.').filter((segment) => /^[a-z][a-z0-9_-]{0,63}$/i.test(segment));
  if (!segments.length || segments.length > 5) throw new Error(`Unsupported Canvas property path: ${path}`);
  return segments.reduceRight((current, segment) => ({ [segment]: current }), cloneEvaraGraph(value));
}

function operation(graph, type, payload, command, transactionId) {
  return createOperation({
    graphId: graph.graphId,
    type,
    payload,
    actor: command.actor,
    baseRevision: null,
    transactionId,
    correlationId: command.correlationId || null,
    metadata: {
      semanticIntent: command.type,
      source: 'canvas-sandbox-mock-dispatcher'
    }
  });
}

function compileInsert(graph, command, transactionId) {
  const parentId = text(command.payload?.parentId, '', 160);
  assertParent(graph, parentId);
  const siblings = orderedChildren(graph, parentId);
  const componentType = text(command.payload?.componentType, 'glass-card', 100);
  const nodeId = text(command.payload?.nodeId, randomId('component'), 160);
  if (graph.nodes[nodeId]) throw new Error(`Canvas insert node already exists: ${nodeId}`);
  const order = number(command.payload?.order, siblings.length, 0, 1000);
  const span = number(command.payload?.span, componentType === 'hero-block' ? 12 : 4, 1, 12);
  const node = createGraphNode({
    id: nodeId,
    kind: 'component-instance',
    name: text(command.payload?.name, componentType.replaceAll('-', ' '), 160),
    props: {
      componentType,
      content: cloneEvaraGraph(command.payload?.content || { title: 'New component', body: 'Edit this component through semantic commands.' }),
      layout: {
        mode: 'grid',
        order,
        span,
        width: number(command.payload?.width, Math.round((span / 12) * 1040), 80, 4000),
        height: number(command.payload?.height, 160, 60, 4000),
        minWidth: 120,
        minHeight: 80
      },
      style: cloneEvaraGraph(command.payload?.style || { radius: 24, glass: 72, tone: 'neutral' }),
      visibility: cloneEvaraGraph(command.payload?.visibility || { roles: { owner: true, admin: true } }),
      tokenBindings: {},
      dataBindings: {}
    },
    metadata: { source: 'canvas-sandbox-command', editable: true }
  });
  const edge = createGraphEdge({
    id: randomId('edge_contains'),
    kind: 'contains',
    source: parentId,
    target: nodeId,
    props: { order }
  });
  return [
    operation(graph, 'node.create', { node }, command, transactionId),
    operation(graph, 'edge.create', { edge }, command, transactionId)
  ];
}

function compileMove(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  const node = assertComponentNode(graph, nodeId);
  const edge = containsEdge(graph, nodeId);
  if (!edge) throw new Error(`Canvas move requires a containment edge for ${nodeId}.`);
  const siblings = orderedChildren(graph, edge.source);
  const fromIndex = siblings.findIndex((item) => item.id === nodeId);
  if (fromIndex < 0) throw new Error(`Canvas move could not locate ${nodeId} in its parent.`);
  const requestedIndex = Number.isInteger(Number(command.payload?.toIndex))
    ? Number(command.payload.toIndex)
    : fromIndex + (command.payload?.direction === 'up' ? -1 : 1);
  const toIndex = Math.min(siblings.length - 1, Math.max(0, requestedIndex));
  if (toIndex === fromIndex) return [];
  const reordered = siblings.slice();
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered
    .filter((item, index) => Number(item.props?.layout?.order ?? 0) !== index)
    .map((item, index) => operation(graph, 'node.patch', {
      nodeId: item.id,
      patch: { props: { layout: { order: index } } }
    }, command, transactionId));
}

function compileResize(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  const node = assertComponentNode(graph, nodeId);
  const current = node.props?.layout || {};
  const patch = {
    width: number(command.payload?.width, current.width || 320, current.minWidth || 80, 4000),
    height: number(command.payload?.height, current.height || 160, current.minHeight || 60, 4000),
    span: number(command.payload?.span, current.span || 4, 1, 12)
  };
  return [operation(graph, 'node.patch', { nodeId, patch: { props: { layout: patch } } }, command, transactionId)];
}

function compileReparent(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  const parentId = text(command.payload?.parentId, '', 160);
  assertComponentNode(graph, nodeId);
  assertParent(graph, parentId);
  if (nodeId === parentId || isDescendant(graph, parentId, nodeId)) throw new Error('Canvas reparent would create a graph cycle.');
  const currentEdge = containsEdge(graph, nodeId);
  if (!currentEdge) throw new Error(`Canvas reparent requires a containment edge for ${nodeId}.`);
  const order = number(command.payload?.order, orderedChildren(graph, parentId).length, 0, 1000);
  if (currentEdge.source === parentId) {
    return compileMove(graph, { ...command, payload: { ...command.payload, toIndex: order } }, transactionId);
  }
  const nextOrder = order;
  const nextEdge = createGraphEdge({
    id: randomId('edge_contains'),
    kind: 'contains',
    source: parentId,
    target: nodeId,
    props: { order: nextOrder }
  });
  return [
    operation(graph, 'edge.delete', { edgeId: currentEdge.id }, command, transactionId),
    operation(graph, 'edge.create', { edge: nextEdge }, command, transactionId),
    operation(graph, 'node.patch', { nodeId, patch: { props: { layout: { order: nextOrder } } } }, command, transactionId)
  ];
}

function compileDuplicate(graph, command, transactionId) {
  const sourceId = text(command.payload?.nodeId, '', 160);
  const source = assertComponentNode(graph, sourceId);
  const edge = containsEdge(graph, sourceId);
  if (!edge) throw new Error(`Canvas duplicate requires a containment edge for ${sourceId}.`);
  const duplicateId = text(command.payload?.duplicateId, randomId('component'), 160);
  const siblings = orderedChildren(graph, edge.source);
  const sourceIndex = siblings.findIndex((node) => node.id === sourceId);
  const duplicateOrder = sourceIndex + 1;
  const duplicate = createGraphNode({
    id: duplicateId,
    kind: source.kind,
    name: text(command.payload?.name, `${source.name || source.id} Copy`, 160),
    props: cloneEvaraGraph(source.props),
    metadata: { ...(source.metadata || {}), duplicatedFrom: sourceId, source: 'canvas-sandbox-command' }
  });
  duplicate.props.layout = {
    ...(duplicate.props.layout || {}),
    order: duplicateOrder
  };
  const duplicateEdge = createGraphEdge({
    id: randomId('edge_contains'),
    kind: 'contains',
    source: edge.source,
    target: duplicateId,
    props: { order: duplicateOrder }
  });
  const shifts = siblings.slice(duplicateOrder).map((sibling, index) => operation(graph, 'node.patch', {
    nodeId: sibling.id,
    patch: { props: { layout: { order: duplicateOrder + index + 1 } } }
  }, command, transactionId));
  return [
    operation(graph, 'node.create', { node: duplicate }, command, transactionId),
    operation(graph, 'edge.create', { edge: duplicateEdge }, command, transactionId),
    ...shifts
  ];
}

function compileDelete(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  assertComponentNode(graph, nodeId);
  return [operation(graph, 'node.delete', { nodeId, cascade: true }, command, transactionId)];
}

function compileProperty(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  assertComponentNode(graph, nodeId);
  const property = text(command.payload?.property, '', 200).replace(/^props\./, '');
  if (!property) throw new Error('Canvas property command requires a property path.');
  return [operation(graph, 'node.patch', {
    nodeId,
    patch: { props: nestedPatch(property, command.payload?.value) }
  }, command, transactionId)];
}

function compileLayout(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  assertComponentNode(graph, nodeId);
  const layout = cloneEvaraGraph(command.payload?.layout || {});
  return [operation(graph, 'node.patch', { nodeId, patch: { props: { layout } } }, command, transactionId)];
}

function compileVisibility(graph, command, transactionId) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  assertComponentNode(graph, nodeId);
  const role = text(command.payload?.role, 'owner', 100);
  return [operation(graph, 'node.patch', {
    nodeId,
    patch: { props: { visibility: { roles: { [role]: command.payload?.visible !== false } } } }
  }, command, transactionId)];
}

function compileBinding(graph, command, transactionId, bindingKey) {
  const nodeId = text(command.payload?.nodeId, '', 160);
  assertComponentNode(graph, nodeId);
  const name = text(command.payload?.name, 'value', 100);
  const value = text(command.payload?.value, '', 300);
  return [operation(graph, 'node.patch', {
    nodeId,
    patch: { props: { [bindingKey]: { [name]: value } } }
  }, command, transactionId)];
}

function compileCommand(graph, command, transactionId) {
  switch (command.type) {
    case 'canvas.component.insert': return compileInsert(graph, command, transactionId);
    case 'canvas.component.move': return compileMove(graph, command, transactionId);
    case 'canvas.component.resize': return compileResize(graph, command, transactionId);
    case 'canvas.component.reparent': return compileReparent(graph, command, transactionId);
    case 'canvas.component.duplicate': return compileDuplicate(graph, command, transactionId);
    case 'canvas.component.delete': return compileDelete(graph, command, transactionId);
    case 'canvas.property.set': return compileProperty(graph, command, transactionId);
    case 'canvas.layout.set': return compileLayout(graph, command, transactionId);
    case 'canvas.visibility.set': return compileVisibility(graph, command, transactionId);
    case 'canvas.token.bind': return compileBinding(graph, command, transactionId, 'tokenBindings');
    case 'canvas.data.bind': return compileBinding(graph, command, transactionId, 'dataBindings');
    default: throw new Error(`Unsupported Canvas semantic command: ${command.type}`);
  }
}

export class MockOperationDispatcher {
  #graph;
  #listeners = new Set();
  #actor;

  constructor(graph, { actor: actorInput = { id: 'studio-sandbox', type: 'user', role: 'owner' } } = {}) {
    assertValidEvaraGraph(graph);
    this.#graph = cloneEvaraGraph(graph);
    this.#actor = actor(actorInput);
  }

  getGraph() {
    return cloneEvaraGraph(this.#graph);
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Canvas dispatcher subscribers must be functions.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispatch(input) {
    const command = {
      type: text(input?.type, '', 120),
      payload: cloneEvaraGraph(input?.payload || {}),
      actor: actor(input?.actor || this.#actor),
      correlationId: input?.correlationId || randomId('correlation')
    };
    if (!COMMAND_SET.has(command.type)) throw new Error(`Unsupported Canvas semantic command: ${command.type}`);
    const transactionId = randomId('canvas_tx');
    const expectedHeadRevision = this.#graph.revision;
    const operations = compileCommand(this.#graph, command, transactionId);
    if (!operations.length) return { changed: false, command, graph: this.getGraph() };
    const result = applyTransaction(this.#graph, operations, {
      transactionId,
      actor: command.actor,
      validateGraph: true,
      allowPublishedMutation: false
    });
    this.#graph = result.graph;
    const event = {
      changed: true,
      intent: command.type,
      command,
      transactionId: result.transactionId,
      expectedHeadRevision,
      graphRevision: result.graph.revision,
      acceptedOperations: cloneEvaraGraph(result.acceptedOperations),
      inverseOperations: cloneEvaraGraph(result.inverseOperations),
      commitOperation: cloneEvaraGraph(result.commitOperation)
    };
    this.#listeners.forEach((listener) => listener(event, this.getGraph()));
    return { ...event, graph: this.getGraph() };
  }
}

export const MockCanvasDispatcher = Object.freeze({
  commands: CANVAS_SEMANTIC_COMMANDS,
  create: (graph, options) => new MockOperationDispatcher(graph, options)
});
