#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  fixture: 'public/assets/js/studio/canvas/canvas-sandbox-fixture.js',
  projection: 'public/assets/js/studio/canvas/graph-projection.js',
  dispatcher: 'public/assets/js/studio/canvas/mock-operation-dispatcher.js',
  layout: 'public/assets/js/studio/canvas/layout-resolver.js',
  controllers: 'public/assets/js/studio/canvas/canvas-controllers.js',
  operationJournal: 'public/assets/js/studio/canvas/canvas-operation-journal.js',
  history: 'public/assets/js/studio/canvas/canvas-history-controller.js',
  session: 'public/assets/js/studio/canvas/canvas-session.js',
  writerLease: 'public/assets/js/studio/canvas/canvas-writer-lease.js',
  writerGuard: 'public/assets/js/studio/canvas/canvas-writer-guard.js',
  syncStatus: 'public/assets/js/studio/canvas/canvas-sync-status.js',
  sandbox: 'public/assets/js/studio/canvas/canvas-session-sandbox.js',
  css: 'public/assets/css/pages/studio-canvas-sandbox.css',
  sessionCss: 'public/assets/css/pages/studio-canvas-session.css',
  page: 'public/website-builder.html',
  modules: 'public/assets/js/studio/module-registry.js',
  journal: 'public/assets/js/studio/studio-document-model.js',
  blueprintAdapter: 'public/assets/js/studio/blueprint-operation-adapter.js',
  canvasTest: 'tests/visual/specs/studio-canvas-session.spec.mjs'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required Canvas asset is missing`);
}

function requireMarkers(source, label, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) errors.push(`${label}: missing ${marker}`);
  }
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
  for (const file of [
    files.fixture,
    files.projection,
    files.dispatcher,
    files.layout,
    files.controllers,
    files.operationJournal,
    files.history,
    files.session,
    files.writerLease,
    files.writerGuard,
    files.syncStatus,
    files.sandbox,
    files.canvasTest
  ]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  requireMarkers(source.fixture, 'canvas-sandbox-fixture.js', [
    'createEvaraGraph',
    'createGraphNode',
    'createGraphEdge',
    'assertValidEvaraGraph',
    "kind: 'workspace'",
    "kind: 'page'",
    "kind: 'frame'",
    "kind: 'component-instance'",
    "kind: 'contains'"
  ]);

  requireMarkers(source.projection, 'graph-projection.js', [
    'assertValidEvaraGraph',
    'cloneEvaraGraph',
    'projectCanvasPage',
    'flattenGraphProjection',
    'findProjectedNode',
    'Canvas projection contains a cycle',
    'LayoutResolver.resolve'
  ]);

  const commands = [
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
  ];
  commands.forEach((command) => {
    if (!source.dispatcher.includes(`'${command}'`)) errors.push(`mock-operation-dispatcher.js: missing ${command}`);
  });
  requireMarkers(source.dispatcher, 'mock-operation-dispatcher.js', [
    'createOperation',
    'applyTransaction',
    'inverseOperations',
    'expectedHeadRevision',
    'MockOperationDispatcher',
    'isDescendant',
    'Canvas reparent would create a graph cycle'
  ]);

  requireMarkers(source.layout, 'layout-resolver.js', [
    "CANVAS_LAYOUT_MODES = Object.freeze(['flow', 'grid', 'spatial'])",
    'resolveFlowLayout',
    'resolveGridLayout',
    'resolveSpatialLayout',
    'resolveCanvasSnap',
    "kind: 'grid'",
    "kind: 'edge'",
    "kind: 'baseline'",
    "kind: 'breakpoint'"
  ]);

  requireMarkers(source.controllers, 'canvas-controllers.js', [
    'SelectionController',
    'InteractionController',
    'ViewportController',
    '#selected = new Set()',
    '#gesture = null',
    'setMarquee',
    'setDevice',
    'setZoom',
    'setPan'
  ]);

  requireMarkers(source.operationJournal, 'canvas-operation-journal.js', [
    'appendOperationTransaction',
    'listOperationTransactions',
    'getGraphHead',
    'replayOperations',
    'expectedHeadRevision',
    'inverseOperations',
    'commitOperation',
    'pendingTransactions',
    'recovery-required',
    'validateTransactionRecord',
    'canvas-transaction-integrity',
    'canvas-transaction-revision',
    'canvas-graph-head-mismatch',
    'getDiagnostics',
    'unsynchronizedChanges',
    "integrityState: 'verified'"
  ]);
  if (/indexedDB\.open|localStorage/.test(source.operationJournal)) errors.push('canvas-operation-journal.js: Canvas must use the shared Studio Journal');

  requireMarkers(source.history, 'canvas-history-controller.js', [
    'HistoryController',
    "intent === 'history.undo'",
    "intent === 'history.redo'",
    'revertsTransactionId',
    'redoesTransactionId',
    'inverseOperations'
  ]);

  requireMarkers(source.session, 'canvas-session.js', [
    'CanvasSession',
    'CanvasOperationJournal',
    'HistoryController',
    'SelectionController',
    'InteractionController',
    'ViewportController',
    'LayoutResolver',
    'SnapResolver',
    'authored-blueprint-graph',
    'graph:canvas:',
    '#commitPrepared',
    'await this.#journal.append',
    'this.#graph = clone(prepared.graph)',
    'pendingTransactions',
    'undo()',
    'redo()',
    'refreshJournalDiagnostics',
    'pendingTransactionCount',
    'unsynchronizedChanges',
    'integrityState',
    'headSequence'
  ]);
  if (source.session.indexOf('await this.#journal.append') > source.session.indexOf('this.#graph = clone(prepared.graph)')) errors.push('canvas-session.js: graph promotion must occur only after Journal durability');
  if (source.session.includes('CanvasJournalAdapter')) errors.push('canvas-session.js: deprecated parallel Canvas journal adapter is active');

  requireMarkers(source.writerLease, 'canvas-writer-lease.js', [
    'CanvasWriterLease',
    'navigator.locks?.request',
    "mode: 'exclusive'",
    'ifAvailable: true',
    'BroadcastChannel',
    "this.#setState('read-only'",
    "this.#setState('writer'",
    "addEventListener('pagehide'",
    'release()'
  ]);

  requireMarkers(source.writerGuard, 'canvas-writer-guard.js', [
    'CanvasWriterLease',
    "CANVAS_GRAPH_PREFIX = 'graph:canvas:'",
    'writerLeaseGuardVersion',
    'acquireForGraph',
    'verifyCurrentHead',
    'refresh-required',
    'appendOperationTransaction: guarded',
    'EvaraCanvasWriterGuard',
    'throw new Error(reason)'
  ]);

  requireMarkers(source.syncStatus, 'canvas-sync-status.js', [
    "STATUS_VERSION = 'canvas-sync-status-v1'",
    'EvaraCanvasSyncStatus',
    'data-canvas-sync-status',
    'aria-live',
    'canvasIntegrityState',
    'canvasUnsynchronized',
    'canvasPendingCount',
    'pendingTransactionCount',
    'unsynchronizedChanges',
    'server confirmed'
  ]);
  if (/indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest|firebase|firestore/i.test(source.syncStatus)) errors.push('canvas-sync-status.js: diagnostics must remain a read-only event projection');

  requireMarkers(source.sandbox, 'canvas-session-sandbox.js', [
    'createCanvasSession',
    'startMarquee',
    'updateMarquee',
    'startPan',
    'updatePan',
    'startResize',
    'finishResize',
    "event.dataTransfer.setData('text/x-evara-canvas-node'",
    "type: 'canvas.component.move'",
    "type: 'canvas.component.resize'",
    'await command(gesture.type, gesture.payload)',
    "command('canvas.property.set'",
    "command('canvas.visibility.set'",
    "command('canvas.token.bind'",
    "command('canvas.data.bind'",
    'session.undo()',
    'session.redo()',
    'window.EvaraCanvasSandbox'
  ]);

  for (const runtime of [source.fixture, source.projection, source.dispatcher, source.layout, source.controllers, source.operationJournal, source.history, source.session, source.writerLease, source.writerGuard, source.syncStatus, source.sandbox]) {
    for (const unsafe of ['innerHTML', 'outerHTML', 'eval(', 'new Function']) {
      if (runtime.includes(unsafe)) errors.push(`Canvas runtime: unsafe sink detected: ${unsafe}`);
    }
  }
  for (const runtime of [source.dispatcher, source.layout, source.controllers, source.operationJournal, source.history, source.session, source.writerLease, source.writerGuard, source.syncStatus, source.sandbox]) {
    for (const prohibited of ['localStorage', 'sessionStorage', 'firebase', 'firestore', 'fetch(']) {
      if (runtime.toLowerCase().includes(prohibited.toLowerCase())) errors.push(`Canvas runtime: prohibited dependency ${prohibited}`);
    }
  }

  requireMarkers(source.journal, 'studio-document-model.js', [
    'appendOperationTransaction',
    'getGraphHead',
    'graphHeads',
    'OPERATION_ENVELOPE_VERSION'
  ]);
  requireMarkers(source.blueprintAdapter, 'blueprint-operation-adapter.js', [
    'appendOperationTransaction',
    'graph:studio:'
  ]);

  requireMarkers(source.css, 'studio-canvas-sandbox.css', [
    '.studio-canvas-sandbox',
    '.studio-canvas-sandbox-viewport[data-device="mobile"]',
    '.studio-canvas-graph-node.is-selected',
    '.studio-canvas-graph-resize-handle',
    '.studio-canvas-sandbox-marquee',
    '.studio-canvas-graph-snap-guide.is-active',
    '@media (max-width:900px)',
    '@media (prefers-reduced-motion:reduce)'
  ]);
  requireMarkers(source.sessionCss, 'studio-canvas-session.css', [
    'data-canvas-writer-state="read-only"',
    'data-canvas-writer-state="refresh-required"',
    'another Studio tab owns this Canvas draft',
    '.studio-canvas-sync-status',
    'data-state="unsynchronized"',
    'data-state="server-confirmed"',
    'data-state="recovery-required"',
    'data-canvas-unsynchronized="true"'
  ]);

  const routeOrder = [
    '/assets/js/studio/blueprint-operation-adapter.js?v=1',
    '/assets/js/studio/canvas/canvas-writer-guard.js?v=1',
    '/assets/js/studio/canvas/canvas-session-sandbox.js?v=3',
    '/assets/js/studio/canvas/canvas-sync-status.js?v=1'
  ];
  routeOrder.forEach((entry) => {
    if (!source.page.includes(entry)) errors.push(`website-builder.html: missing ${entry}`);
  });
  for (let index = 1; index < routeOrder.length; index += 1) {
    if (source.page.indexOf(routeOrder[index - 1]) >= source.page.indexOf(routeOrder[index])) errors.push('website-builder.html: Blueprint, writer guard, CanvasSession, and sync-status load order is invalid');
  }
  if (source.page.includes('/assets/js/studio/canvas/canvas-sandbox.js?v=1')) errors.push('website-builder.html: rollback Canvas sandbox must not be active');

  requireMarkers(source.canvasTest, 'studio-canvas-session.spec.mjs', [
    'corruption and graph-head recovery validation',
    'second tab is read-only and takes over after release',
    'local transaction IDs are idempotent and conflicting reuse fails closed',
    'trusted synchronization checkpoint and immutable release are server confirmed',
    'corrupted Canvas transaction fails closed with recovery-required',
    'graph-head mismatch fails closed and requires refresh',
    'canvas-writer-lease.json',
    'canvas-local-idempotency.json',
    'canvas-trusted-release.json',
    'canvas-corrupt-transaction-recovery.json',
    'canvas-graph-head-mismatch-recovery.json'
  ]);

  if (!source.modules.includes("id: 'canvas-engine'")) errors.push('module-registry.js: Canvas Engine module is missing');
  if (!source.modules.includes("dependencies: ['design-system', 'graph-core', 'operation-engine']")) errors.push('module-registry.js: Canvas Engine dependencies are incomplete');
}

console.log(`EvaraOS CanvasSession audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('CanvasSession, GraphProjection, semantic gestures, durable Journal, writer lease, integrity recovery, and unsynchronized-change diagnostics passed.');
