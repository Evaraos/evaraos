import { getSavedUserProfile } from '../firebase.js';
import {
  compileBlueprintDocumentToGraph,
  migrateBlueprintDocument,
  serializeStudioPageToBlueprint
} from './blueprint-component-document.js';
import {
  applyTransaction,
  createOperation
} from './core/operation-protocol.js';

export const BLUEPRINT_OPERATION_ADAPTER_VERSION = 'blueprint-operation-adapter-v1';
export const CANVAS_COMMAND_VERSION = 'canvas-semantic-command-v1';

const CONTENT_KEY = 'evaraos-studio-visual-builder-v1';
const LAYOUT_KEY = 'evaraos-studio-auto-layout-v1';
const OBSERVED_KEYS = new Set([CONTENT_KEY, LAYOUT_KEY]);
const WRITE_SETTLE_DELAY = 72;
const MAX_AFFECTED_NODES = 5000;

const priorSetItem = Storage.prototype.setItem;
let installed = false;
let pending = null;
let settleTimer = 0;
let commitChain = Promise.resolve();

const clone = (value) => globalThis.structuredClone
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const clean = (value, max = 220) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, '')
  .slice(0, max);

function safeParse(value, fallback = null) {
  try { return JSON.parse(value); }
  catch { return fallback; }
}

function readProjection() {
  return {
    content: safeParse(localStorage.getItem(CONTENT_KEY), null),
    layout: safeParse(localStorage.getItem(LAYOUT_KEY), { version: 1, pages: {} }),
    capturedAt: new Date().toISOString()
  };
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isObject(value)) return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function slug(value = 'item') {
  return clean(value, 180)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function actor() {
  const profile = getSavedUserProfile?.() || {};
  return {
    id: clean(profile.uid || profile.userId || profile.email || 'studio-user', 160),
    type: 'user',
    role: clean(profile.role || 'owner', 100)
  };
}

function pageMap(content) {
  return new Map((Array.isArray(content?.pages) ? content.pages : []).map((page) => [page.id, page]));
}

function pageLayout(layout, pageId) {
  return layout?.pages?.[pageId] || { groups: [] };
}

function pageChanged(beforeProjection, afterProjection, pageId) {
  const beforePage = pageMap(beforeProjection.content).get(pageId) || null;
  const afterPage = pageMap(afterProjection.content).get(pageId) || null;
  return !same(beforePage, afterPage) || !same(pageLayout(beforeProjection.layout, pageId), pageLayout(afterProjection.layout, pageId));
}

function changedPageIds(beforeProjection, afterProjection) {
  const ids = new Set([
    ...pageMap(beforeProjection.content).keys(),
    ...pageMap(afterProjection.content).keys(),
    ...Object.keys(beforeProjection.layout?.pages || {}),
    ...Object.keys(afterProjection.layout?.pages || {})
  ]);
  return [...ids].filter((pageId) => pageChanged(beforeProjection, afterProjection, pageId));
}

function pageDocument(projection, pageId) {
  const page = pageMap(projection.content).get(pageId);
  if (!page) throw new Error(`Studio page ${pageId} is unavailable for operation compilation.`);
  const document = serializeStudioPageToBlueprint({
    studioState: projection.content,
    autoLayoutState: projection.layout || { version: 1, pages: {} },
    pageId,
    blueprintId: page.role || 'customer',
    name: `${page.name || page.id} Blueprint`,
    actorId: 'blueprint-operation-adapter',
    generatedAt: '2000-01-01T00:00:00.000Z'
  });
  document.documentId = `blueprint-document:${slug(document.blueprintId)}:${slug(pageId)}`;
  document.metadata = {
    ...(document.metadata || {}),
    source: BLUEPRINT_OPERATION_ADAPTER_VERSION,
    migration: {
      ...(document.metadata?.migration || {}),
      sourcePageId: pageId
    }
  };
  return migrateBlueprintDocument(document);
}

function graphIdFor(document, pageId) {
  return `graph:studio:${slug(document.blueprintId)}:${slug(pageId)}`;
}

function graphNodeSemantic(node) {
  return node ? {
    id: node.id,
    kind: node.kind,
    name: node.name,
    props: clone(node.props || {})
  } : null;
}

function graphEdgeSemantic(edge) {
  return edge ? {
    id: edge.id,
    kind: edge.kind,
    source: edge.source,
    target: edge.target,
    props: clone(edge.props || {})
  } : null;
}

function graphMetadataSemantic(graph) {
  return {
    compilerVersion: graph.metadata?.compilerVersion || null,
    blueprintDocumentId: graph.metadata?.blueprintDocumentId || null,
    blueprintSchemaVersion: graph.metadata?.blueprintSchemaVersion || null,
    blueprintFingerprint: graph.metadata?.blueprintFingerprint || null
  };
}

function graphSignature(graph) {
  return JSON.stringify(stable({
    graphId: graph.graphId,
    state: graph.state,
    nodes: Object.fromEntries(Object.entries(graph.nodes || {}).map(([id, node]) => [id, graphNodeSemantic(node)])),
    edges: Object.fromEntries(Object.entries(graph.edges || {}).map(([id, edge]) => [id, graphEdgeSemantic(edge)])),
    metadata: graphMetadataSemantic(graph)
  }));
}

function operation(graph, transactionId, semanticCommand, type, payload, operationActor) {
  return createOperation({
    graphId: graph.graphId,
    type,
    payload,
    actor: operationActor,
    baseRevision: null,
    transactionId,
    correlationId: semanticCommand.correlationId,
    metadata: {
      semanticIntent: semanticCommand.type,
      semanticCommandVersion: CANVAS_COMMAND_VERSION,
      adapterVersion: BLUEPRINT_OPERATION_ADAPTER_VERSION,
      pageId: semanticCommand.payload.pageId,
      sourceFingerprint: semanticCommand.payload.sourceFingerprint,
      targetFingerprint: semanticCommand.payload.targetFingerprint
    }
  });
}

function deletionPriority(node) {
  return ({ action: 0, 'component-instance': 1, 'component-definition': 2, route: 3, role: 4, frame: 5, page: 6, blueprint: 7, workspace: 8 })[node?.kind] ?? 9;
}

function graphDiffOperations(beforeGraph, afterGraph, semanticCommand, transactionId, operationActor) {
  const operations = [];
  const beforeNodes = beforeGraph.nodes || {};
  const afterNodes = afterGraph.nodes || {};
  const beforeEdges = beforeGraph.edges || {};
  const afterEdges = afterGraph.edges || {};

  const changedEdgeIds = Object.keys(beforeEdges).filter((id) => afterEdges[id] && !same(graphEdgeSemantic(beforeEdges[id]), graphEdgeSemantic(afterEdges[id])));
  const removedEdgeIds = Object.keys(beforeEdges).filter((id) => !afterEdges[id]);
  [...new Set([...removedEdgeIds, ...changedEdgeIds])].sort().forEach((edgeId) => {
    operations.push(operation(beforeGraph, transactionId, semanticCommand, 'edge.delete', { edgeId }, operationActor));
  });

  const replacedNodeIds = Object.keys(beforeNodes).filter((id) => afterNodes[id] && beforeNodes[id].kind !== afterNodes[id].kind);
  const removedNodeIds = Object.keys(beforeNodes).filter((id) => !afterNodes[id]);
  [...new Set([...removedNodeIds, ...replacedNodeIds])]
    .sort((left, right) => deletionPriority(beforeNodes[left]) - deletionPriority(beforeNodes[right]) || left.localeCompare(right))
    .forEach((nodeId) => {
      operations.push(operation(beforeGraph, transactionId, semanticCommand, 'node.delete', { nodeId, cascade: true }, operationActor));
    });

  const addedNodeIds = Object.keys(afterNodes).filter((id) => !beforeNodes[id] || replacedNodeIds.includes(id));
  addedNodeIds.sort().forEach((nodeId) => {
    operations.push(operation(beforeGraph, transactionId, semanticCommand, 'node.create', { node: clone(afterNodes[nodeId]) }, operationActor));
  });

  Object.keys(afterNodes).filter((id) => beforeNodes[id] && !replacedNodeIds.includes(id)).sort().forEach((nodeId) => {
    if (same(graphNodeSemantic(beforeNodes[nodeId]), graphNodeSemantic(afterNodes[nodeId]))) return;
    operations.push(operation(beforeGraph, transactionId, semanticCommand, 'node.patch', {
      nodeId,
      patch: {
        name: afterNodes[nodeId].name,
        props: clone(afterNodes[nodeId].props || {})
      }
    }, operationActor));
  });

  const addedEdgeIds = Object.keys(afterEdges).filter((id) => !beforeEdges[id] || changedEdgeIds.includes(id));
  addedEdgeIds.sort().forEach((edgeId) => {
    operations.push(operation(beforeGraph, transactionId, semanticCommand, 'edge.create', { edge: clone(afterEdges[edgeId]) }, operationActor));
  });

  if (!same(graphMetadataSemantic(beforeGraph), graphMetadataSemantic(afterGraph))) {
    operations.push(operation(beforeGraph, transactionId, semanticCommand, 'graph.meta.patch', {
      patch: graphMetadataSemantic(afterGraph)
    }, operationActor));
  }

  return operations;
}

function instanceMaps(beforeDocument, afterDocument) {
  return {
    before: beforeDocument.instances || {},
    after: afterDocument.instances || {}
  };
}

function instanceOrder(document) {
  return document.pages.flatMap((page) => page.sections.flatMap((section) => section.instanceIds));
}

function inferSemanticIntents(beforeDocument, afterDocument) {
  const { before, after } = instanceMaps(beforeDocument, afterDocument);
  const beforeIds = new Set(Object.keys(before));
  const afterIds = new Set(Object.keys(after));
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  const shared = [...afterIds].filter((id) => beforeIds.has(id));
  const intents = [];

  if (added.length) intents.push('canvas.component.insert');
  if (removed.length) intents.push('canvas.component.delete');
  if (!same(instanceOrder(beforeDocument), instanceOrder(afterDocument))) intents.push('canvas.component.move');
  if (shared.some((id) => !same(before[id].layout, after[id].layout) || !same(before[id].responsive, after[id].responsive))) intents.push('canvas.layout.set');
  if (shared.some((id) => !same(before[id].visibility, after[id].visibility))) intents.push('canvas.visibility.set');
  if (shared.some((id) => !same(before[id].props, after[id].props) || !same(before[id].icon, after[id].icon) || !same(before[id].action, after[id].action))) intents.push('canvas.property.set');

  return {
    primary: intents[0] || 'canvas.property.set',
    all: [...new Set(intents)],
    added,
    removed,
    shared
  };
}

function changedGraphNodeIds(beforeGraph, afterGraph) {
  const ids = new Set([...Object.keys(beforeGraph.nodes || {}), ...Object.keys(afterGraph.nodes || {})]);
  return [...ids].filter((id) => !same(graphNodeSemantic(beforeGraph.nodes?.[id]), graphNodeSemantic(afterGraph.nodes?.[id]))).slice(0, MAX_AFFECTED_NODES);
}

async function compileProjectionChange(beforeProjection, afterProjection, pageId) {
  const journal = window.EvaraStudioJournal;
  if (!journal?.appendOperationTransaction || !journal?.getGraphHead) throw new Error('The operation-aware Studio Journal is unavailable.');

  const beforeDocument = pageDocument(beforeProjection, pageId);
  const afterDocument = pageDocument(afterProjection, pageId);
  if (beforeDocument.metadata.fingerprint === afterDocument.metadata.fingerprint) return null;

  const graphId = graphIdFor(afterDocument, pageId);
  const head = await journal.getGraphHead(graphId);
  const history = await journal.listOperationTransactions(graphId);
  const latest = history[0] || null;
  if (latest?.sourceFingerprint && latest.sourceFingerprint !== beforeDocument.metadata.fingerprint) {
    throw new Error(`Blueprint operation conflict for ${pageId}: the browser projection does not match the durable journal head.`);
  }

  const beforeCompilation = compileBlueprintDocumentToGraph(beforeDocument, { graphId, actorId: 'blueprint-operation-adapter' });
  const afterCompilation = compileBlueprintDocumentToGraph(afterDocument, { graphId, actorId: 'blueprint-operation-adapter' });
  const beforeGraph = beforeCompilation.graph;
  const afterGraph = afterCompilation.graph;
  beforeGraph.revision = Number(head.revision || 0);

  const inferred = inferSemanticIntents(beforeDocument, afterDocument);
  const operationActor = actor();
  const transactionId = randomId('blueprint_tx');
  const semanticCommand = {
    version: CANVAS_COMMAND_VERSION,
    type: inferred.primary,
    intents: inferred.all,
    correlationId: randomId('blueprint_correlation'),
    actor: operationActor,
    payload: {
      pageId,
      blueprintId: afterDocument.blueprintId,
      documentId: afterDocument.documentId,
      sourceFingerprint: beforeDocument.metadata.fingerprint,
      targetFingerprint: afterDocument.metadata.fingerprint,
      addedInstanceIds: inferred.added,
      removedInstanceIds: inferred.removed
    }
  };

  const operations = graphDiffOperations(beforeGraph, afterGraph, semanticCommand, transactionId, operationActor);
  if (!operations.length) return null;
  const result = applyTransaction(beforeGraph, operations, {
    transactionId,
    actor: operationActor,
    validateGraph: true,
    allowPublishedMutation: false
  });

  if (graphSignature(result.graph) !== graphSignature(afterGraph)) {
    throw new Error(`Blueprint operation adapter failed semantic graph parity for ${pageId}.`);
  }

  const envelope = {
    transactionId: result.transactionId,
    graphId,
    graphSchemaVersion: result.graph.schemaVersion,
    operationProtocolVersion: result.acceptedOperations[0]?.protocolVersion || '0.1.0',
    expectedHeadRevision: Number(head.revision || 0),
    acceptedHeadRevision: result.graph.revision,
    intent: semanticCommand.type,
    summary: `${semanticCommand.type} on ${pageId}`,
    semanticCommand,
    operations: result.acceptedOperations,
    inverseOperations: result.inverseOperations,
    commitOperation: result.commitOperation,
    actor: operationActor,
    correlationId: semanticCommand.correlationId,
    affectedNodeIds: changedGraphNodeIds(beforeGraph, afterGraph),
    sourceDocumentId: afterDocument.documentId,
    sourceFingerprint: afterDocument.metadata.fingerprint,
    createdAtClient: new Date().toISOString()
  };

  const durable = await journal.appendOperationTransaction(envelope, { projection: afterProjection });
  window.dispatchEvent(new CustomEvent('evara:blueprint-operation-committed', {
    detail: {
      adapterVersion: BLUEPRINT_OPERATION_ADAPTER_VERSION,
      pageId,
      graphId,
      transactionId: durable.transactionId,
      intent: durable.intent,
      intents: semanticCommand.intents,
      expectedHeadRevision: durable.expectedHeadRevision,
      acceptedHeadRevision: durable.acceptedHeadRevision,
      operationCount: durable.operations.length,
      inverseOperationCount: durable.inverseOperations.length,
      fingerprint: durable.sourceFingerprint
    }
  }));
  return durable;
}

async function processPending(change) {
  if (!change?.before?.content || !change?.after?.content) return [];
  const pages = changedPageIds(change.before, change.after);
  const committed = [];
  for (const pageId of pages) {
    const result = await compileProjectionChange(change.before, change.after, pageId);
    if (result) committed.push(result);
  }
  return committed;
}

function reportFailure(error, change) {
  const message = clean(error?.message || error, 500);
  const root = document.querySelector('[data-visual-studio]');
  if (root) {
    root.dataset.operationAdapter = BLUEPRINT_OPERATION_ADAPTER_VERSION;
    root.dataset.operationDurability = 'recovery-required';
    root.dataset.operationError = message;
  }
  window.dispatchEvent(new CustomEvent('evara:blueprint-operation-error', {
    detail: {
      adapterVersion: BLUEPRINT_OPERATION_ADAPTER_VERSION,
      keys: [...(change?.keys || [])],
      error: message
    }
  }));
}

function flushPending() {
  const change = pending;
  pending = null;
  clearTimeout(settleTimer);
  if (!change) return;
  commitChain = commitChain
    .then(() => processPending(change))
    .then((transactions) => {
      const root = document.querySelector('[data-visual-studio]');
      if (root) {
        root.dataset.operationAdapter = BLUEPRINT_OPERATION_ADAPTER_VERSION;
        root.dataset.operationDurability = transactions.length ? 'saved-locally' : 'no-semantic-change';
        root.dataset.operationCount = String(transactions.reduce((sum, transaction) => sum + transaction.operations.length, 0));
        root.removeAttribute('data-operation-error');
      }
    })
    .catch((error) => reportFailure(error, change));
}

function queueChange(key, before, after) {
  if (!pending) pending = { before, after, keys: new Set([key]) };
  else {
    pending.after = after;
    pending.keys.add(key);
  }
  clearTimeout(settleTimer);
  settleTimer = setTimeout(flushPending, WRITE_SETTLE_DELAY);
}

function installStorageObserver() {
  if (installed || Storage.prototype.setItem.__evaraBlueprintOperationAdapter) return;
  installed = true;
  const previous = Storage.prototype.setItem;
  function observedSetItem(key, value) {
    if (this !== localStorage || !OBSERVED_KEYS.has(key)) return previous.call(this, key, value);
    const before = readProjection();
    const result = previous.call(this, key, value);
    const after = readProjection();
    queueChange(key, before, after);
    return result;
  }
  Object.defineProperty(observedSetItem, '__evaraBlueprintOperationAdapter', { value: true });
  Storage.prototype.setItem = observedSetItem;
}

async function boot() {
  installStorageObserver();
  await window.EvaraStudioJournal?.initialize?.();
  const root = document.querySelector('[data-visual-studio]');
  if (root) {
    root.dataset.operationAdapter = BLUEPRINT_OPERATION_ADAPTER_VERSION;
    root.dataset.operationDurability = 'ready';
  }
}

window.EvaraBlueprintOperationAdapter = Object.freeze({
  version: BLUEPRINT_OPERATION_ADAPTER_VERSION,
  commandVersion: CANVAS_COMMAND_VERSION,
  flush: () => commitChain,
  compileProjectionChange,
  changedPageIds,
  authority: 'draft-journal-compatibility-adapter',
  trustedCommitRequired: true
});

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 1050), { once: true });
else setTimeout(boot, 1050);
