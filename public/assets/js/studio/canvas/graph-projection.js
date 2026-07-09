import {
  assertValidEvaraGraph,
  cloneEvaraGraph,
  getOutgoingEdges
} from '../core/evara-graph.js';

const DEVICE_WIDTHS = Object.freeze({
  desktop: 1180,
  tablet: 820,
  mobile: 390
});

function number(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function containsChildren(graph, parentId) {
  return getOutgoingEdges(graph, parentId, 'contains')
    .map((edge) => ({ edge, node: graph.nodes[edge.target] }))
    .filter((item) => item.node)
    .sort((left, right) => {
      const leftOrder = Number(left.node.props?.layout?.order ?? left.edge.props?.order ?? 0);
      const rightOrder = Number(right.node.props?.layout?.order ?? right.edge.props?.order ?? 0);
      return leftOrder - rightOrder || left.node.id.localeCompare(right.node.id);
    });
}

function effectiveSpan(node, device) {
  const span = number(node.props?.layout?.span, 12, 1, 12);
  if (device === 'mobile' && node.props?.componentType !== 'action-button') return 12;
  if (device === 'tablet' && span < 6) return 6;
  return span;
}

function projectNode(graph, node, parentId, device, visited) {
  if (visited.has(node.id)) throw new Error(`Canvas projection contains a cycle at ${node.id}.`);
  visited.add(node.id);

  const layout = cloneEvaraGraph(node.props?.layout || {});
  const projected = {
    id: node.id,
    graphRevision: node.revision,
    kind: node.kind,
    name: node.name || node.id,
    componentType: node.props?.componentType || node.kind,
    parentId,
    content: cloneEvaraGraph(node.props?.content || {}),
    style: cloneEvaraGraph(node.props?.style || {}),
    visibility: cloneEvaraGraph(node.props?.visibility || { roles: {} }),
    tokenBindings: cloneEvaraGraph(node.props?.tokenBindings || {}),
    dataBindings: cloneEvaraGraph(node.props?.dataBindings || {}),
    layout: {
      mode: layout.mode || 'flow',
      order: number(layout.order, 0, 0, 1000),
      span: effectiveSpan(node, device),
      sourceSpan: number(layout.span, 12, 1, 12),
      width: number(layout.width, 320, 80, 4000),
      height: number(layout.height, 160, 60, 4000),
      minWidth: number(layout.minWidth, 120, 40, 4000),
      minHeight: number(layout.minHeight, 80, 40, 4000)
    },
    children: []
  };

  projected.children = containsChildren(graph, node.id)
    .map(({ node: child }) => projectNode(graph, child, node.id, device, visited));

  visited.delete(node.id);
  return projected;
}

export function projectCanvasPage(graph, {
  pageId = null,
  device = 'desktop'
} = {}) {
  assertValidEvaraGraph(graph);
  const normalizedDevice = Object.hasOwn(DEVICE_WIDTHS, device) ? device : 'desktop';
  const page = pageId ? graph.nodes[pageId] : Object.values(graph.nodes).find((node) => node.kind === 'page');
  if (!page || page.kind !== 'page') throw new Error(`Canvas page not found: ${pageId || 'first page'}`);

  const visited = new Set();
  const projectedPage = projectNode(graph, page, null, normalizedDevice, visited);
  const result = {
    graphId: graph.graphId,
    graphSchemaVersion: graph.schemaVersion,
    graphState: graph.state,
    graphRevision: graph.revision,
    device: normalizedDevice,
    viewportWidth: DEVICE_WIDTHS[normalizedDevice],
    page: projectedPage
  };

  return deepFreeze(result);
}

export function flattenGraphProjection(projection) {
  const flattened = [];
  const visit = (node, depth = 0) => {
    flattened.push({ ...node, children: undefined, depth });
    node.children.forEach((child) => visit(child, depth + 1));
  };
  if (projection?.page) visit(projection.page);
  return flattened;
}

export function findProjectedNode(projection, nodeId) {
  if (!projection?.page || !nodeId) return null;
  const queue = [projection.page];
  while (queue.length) {
    const node = queue.shift();
    if (node.id === nodeId) return node;
    queue.push(...node.children);
  }
  return null;
}

export const GraphProjection = Object.freeze({
  projectPage: projectCanvasPage,
  flatten: flattenGraphProjection,
  find: findProjectedNode,
  deviceWidths: DEVICE_WIDTHS
});
