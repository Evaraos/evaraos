import {
  assertValidEvaraGraph,
  cloneEvaraGraph,
  getOutgoingEdges
} from '../core/evara-graph.js';
import { LayoutResolver } from './layout-resolver.js';

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
      const leftOrder = Number(left.node.props?.layout?.order ?? left.node.props?.order ?? left.edge.props?.order ?? 0);
      const rightOrder = Number(right.node.props?.layout?.order ?? right.node.props?.order ?? right.edge.props?.order ?? 0);
      return leftOrder - rightOrder || left.node.id.localeCompare(right.node.id);
    });
}

function responsiveSpan(node, device, fallback) {
  const responsive = node.props?.responsive || {};
  const candidate = responsive?.[device]?.span;
  return number(candidate, fallback, 1, 12);
}

function effectiveSpan(node, device) {
  const sourceSpan = number(node.props?.layout?.span, 12, 1, 12);
  const responsive = responsiveSpan(node, device, sourceSpan);
  if (device === 'mobile' && node.props?.componentType !== 'action-button' && node.props?.definitionId !== 'action-button') return 12;
  if (device === 'tablet' && responsive < 6) return 6;
  return responsive;
}

function normalizeLayout(node, device) {
  const layout = cloneEvaraGraph(node.props?.layout || {});
  const style = layout.style && typeof layout.style === 'object' ? layout.style : {};
  return {
    mode: ['flow', 'grid', 'spatial'].includes(layout.mode) ? layout.mode : (node.kind === 'frame' ? 'grid' : 'flow'),
    order: number(layout.order ?? node.props?.order, 0, 0, 1000),
    span: effectiveSpan(node, device),
    sourceSpan: number(layout.span, 12, 1, 12),
    width: number(layout.width, 320, 40, 10000),
    height: number(layout.height, 160, 40, 10000),
    minWidth: number(layout.minWidth, 120, 40, 10000),
    minHeight: number(layout.minHeight, 80, 40, 10000),
    columns: number(layout.columns, 12, 1, 24),
    gap: number(layout.gap, 20, 0, 400),
    padding: cloneEvaraGraph(layout.padding ?? 24),
    direction: layout.direction === 'row' ? 'row' : 'column',
    align: ['start', 'center', 'end', 'stretch'].includes(layout.align) ? layout.align : 'stretch',
    justify: ['start', 'center', 'end', 'space-between'].includes(layout.justify) ? layout.justify : 'start',
    wrap: layout.wrap !== false,
    x: number(layout.x, 0, -100000, 100000),
    y: number(layout.y, 0, -100000, 100000),
    zIndex: number(layout.zIndex, 0, -10000, 10000),
    style
  };
}

function projectNode(graph, node, parentId, device, visited) {
  if (visited.has(node.id)) throw new Error(`Canvas projection contains a cycle at ${node.id}.`);
  visited.add(node.id);

  const componentType = node.props?.componentType || node.props?.definitionId || node.kind;
  const content = node.props?.content || node.props?.props || {};
  const layout = normalizeLayout(node, device);
  const projected = {
    id: node.id,
    graphRevision: node.revision,
    kind: node.kind,
    name: node.name || node.id,
    componentType,
    parentId,
    content: cloneEvaraGraph(content),
    icon: cloneEvaraGraph(node.props?.icon || null),
    action: cloneEvaraGraph(node.props?.action || null),
    style: cloneEvaraGraph(node.props?.style || layout.style || {}),
    responsive: cloneEvaraGraph(node.props?.responsive || {}),
    visibility: cloneEvaraGraph(node.props?.visibility || { roles: {} }),
    tokenBindings: cloneEvaraGraph(node.props?.tokenBindings || {}),
    dataBindings: cloneEvaraGraph(node.props?.dataBindings || {}),
    layout,
    resolvedLayout: null,
    children: []
  };

  projected.children = containsChildren(graph, node.id)
    .map(({ node: child }) => projectNode(graph, child, node.id, device, visited));

  visited.delete(node.id);
  return projected;
}

function resolveProjectionTree(node, viewportWidth, device) {
  node.children.forEach((child) => resolveProjectionTree(child, child.layout.width || viewportWidth, device));
  if (!node.children.length) return;
  const resolution = LayoutResolver.resolve(node, node.children, { viewportWidth, device });
  node.layoutResolution = resolution;
  const itemMap = new Map(resolution.items.map((item) => [item.nodeId, item]));
  node.children.forEach((child) => {
    child.resolvedLayout = cloneEvaraGraph(itemMap.get(child.id) || null);
  });
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
  resolveProjectionTree(projectedPage, DEVICE_WIDTHS[normalizedDevice], normalizedDevice);
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
