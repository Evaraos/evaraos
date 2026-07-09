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
  sandbox: 'public/assets/js/studio/canvas/canvas-session-sandbox.js',
  css: 'public/assets/css/pages/studio-canvas-sandbox.css',
  page: 'public/website-builder.html',
  modules: 'public/assets/js/studio/module-registry.js',
  journal: 'public/assets/js/studio/studio-document-model.js',
  blueprintAdapter: 'public/assets/js/studio/blueprint-operation-adapter.js'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required Canvas asset is missing`);
}

if (!errors.length) {
  const fixture = read(files.fixture);
  const projection = read(files.projection);
  const dispatcher = read(files.dispatcher);
  const layout = read(files.layout);
  const controllers = read(files.controllers);
  const operationJournal = read(files.operationJournal);
  const history = read(files.history);
  const session = read(files.session);
  const sandbox = read(files.sandbox);
  const css = read(files.css);
  const page = read(files.page);
  const modules = read(files.modules);
  const journal = read(files.journal);
  const blueprintAdapter = read(files.blueprintAdapter);

  for (const file of [
    files.fixture,
    files.projection,
    files.dispatcher,
    files.layout,
    files.controllers,
    files.operationJournal,
    files.history,
    files.session,
    files.sandbox
  ]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  for (const marker of [
    'createEvaraGraph', 'createGraphNode', 'createGraphEdge', 'assertValidEvaraGraph',
    "kind: 'workspace'", "kind: 'page'", "kind: 'frame'", "kind: 'component-instance'",
    "kind: 'contains'", 'fixture: true'
  ]) {
    if (!fixture.includes(marker)) errors.push(`canvas-sandbox-fixture.js: missing ${marker}`);
  }

  for (const marker of [
    'assertValidEvaraGraph', 'cloneEvaraGraph', 'getOutgoingEdges', 'deepFreeze',
    'projectCanvasPage', 'flattenGraphProjection', 'findProjectedNode',
    'Canvas projection contains a cycle', 'LayoutResolver.resolve', 'layoutResolution'
  ]) {
    if (!projection.includes(marker)) errors.push(`graph-projection.js: missing ${marker}`);
  }

  const commands = [
    'canvas.component.insert', 'canvas.component.move', 'canvas.component.resize',
    'canvas.component.reparent', 'canvas.component.duplicate', 'canvas.component.delete',
    'canvas.property.set', 'canvas.layout.set', 'canvas.visibility.set',
    'canvas.token.bind', 'canvas.data.bind'
  ];
  for (const command of commands) {
    if (!dispatcher.includes(`'${command}'`)) errors.push(`mock-operation-dispatcher.js: missing ${command}`);
  }
  for (const marker of ['createOperation', 'applyTransaction', 'inverseOperations', 'expectedHeadRevision', 'MockOperationDispatcher']) {
    if (!dispatcher.includes(marker)) errors.push(`mock-operation-dispatcher.js: missing ${marker}`);
  }
  if (!dispatcher.includes('isDescendant') || !dispatcher.includes('Canvas reparent would create a graph cycle')) {
    errors.push('mock-operation-dispatcher.js: reparent cycle protection is missing');
  }

  for (const marker of [
    "CANVAS_LAYOUT_MODES = Object.freeze(['flow', 'grid', 'spatial'])",
    'resolveFlowLayout', 'resolveGridLayout', 'resolveSpatialLayout', 'resolveCanvasSnap',
    "kind: 'grid'", "kind: 'edge'", "kind: 'baseline'", "kind: 'breakpoint'"
  ]) {
    if (!layout.includes(marker)) errors.push(`layout-resolver.js: missing ${marker}`);
  }

  for (const marker of [
    'SelectionController', 'InteractionController', 'ViewportController',
    '#selected = new Set()', '#gesture = null', 'setMarquee', 'setDevice', 'setZoom', 'setPan'
  ]) {
    if (!controllers.includes(marker)) errors.push(`canvas-controllers.js: missing ${marker}`);
  }

  for (const marker of [
    'appendOperationTransaction', 'listOperationTransactions', 'getGraphHead',
    'replayOperations', 'direct-canvas-session', 'expectedHeadRevision',
    'inverseOperations', 'commitOperation', 'pendingTransactions', 'recovery-required'
  ]) {
    if (!operationJournal.includes(marker)) errors.push(`canvas-operation-journal.js: missing ${marker}`);
  }
  if (operationJournal.includes('indexedDB.open') || operationJournal.includes('localStorage')) {
    errors.push('canvas-operation-journal.js: Canvas must use the shared Studio Journal instead of opening a parallel persistence layer');
  }

  for (const marker of [
    'HistoryController', "intent === 'history.undo'", "intent === 'history.redo'",
    'revertsTransactionId', 'redoesTransactionId', 'inverseOperations'
  ]) {
    if (!history.includes(marker)) errors.push(`canvas-history-controller.js: missing ${marker}`);
  }

  for (const marker of [
    'CanvasSession', 'CanvasOperationJournal', 'HistoryController',
    'SelectionController', 'InteractionController', 'ViewportController',
    'LayoutResolver', 'SnapResolver', 'authored-blueprint-graph',
    'graph:canvas:', '#commitPrepared', 'await this.#journal.append',
    'this.#graph = clone(prepared.graph)', 'pendingTransactions', 'undo()', 'redo()'
  ]) {
    if (!session.includes(marker)) errors.push(`canvas-session.js: missing ${marker}`);
  }
  if (session.indexOf('await this.#journal.append') > session.indexOf('this.#graph = clone(prepared.graph)')) {
    errors.push('canvas-session.js: graph promotion must occur only after journal durability succeeds');
  }
  if (session.includes('CanvasJournalAdapter')) errors.push('canvas-session.js: deprecated parallel Canvas journal adapter is still active');

  for (const marker of [
    'createCanvasSession', 'startMarquee', 'updateMarquee', 'startPan', 'updatePan',
    'startResize', 'finishResize', "event.dataTransfer.setData('text/x-evara-canvas-node'",
    "command('canvas.component.move'", "command('canvas.component.resize'",
    "command('canvas.property.set'", "command('canvas.visibility.set'",
    "command('canvas.token.bind'", "command('canvas.data.bind'",
    'session.undo()', 'session.redo()', 'window.EvaraCanvasSandbox'
  ]) {
    if (!sandbox.includes(marker)) errors.push(`canvas-session-sandbox.js: missing ${marker}`);
  }

  for (const source of [fixture, projection, dispatcher, layout, controllers, operationJournal, history, session, sandbox]) {
    for (const unsafe of ['innerHTML', 'outerHTML', 'eval(', 'new Function']) {
      if (source.includes(unsafe)) errors.push(`Canvas runtime: unsafe sink detected: ${unsafe}`);
    }
  }
  for (const source of [dispatcher, layout, controllers, operationJournal, history, session, sandbox]) {
    for (const prohibited of ['localStorage', 'sessionStorage', 'firebase', 'firestore', 'fetch(']) {
      if (source.toLowerCase().includes(prohibited.toLowerCase())) errors.push(`Canvas runtime: prohibited dependency ${prohibited}`);
    }
  }

  for (const marker of ['appendOperationTransaction', 'getGraphHead', 'graphHeads', 'OPERATION_ENVELOPE_VERSION']) {
    if (!journal.includes(marker)) errors.push(`studio-document-model.js: missing shared operation-journal contract ${marker}`);
  }
  if (!blueprintAdapter.includes('appendOperationTransaction') || !blueprintAdapter.includes('graph:studio:')) {
    errors.push('blueprint-operation-adapter.js: Blueprint operation integration is incomplete');
  }

  for (const selector of [
    '.studio-canvas-sandbox', '.studio-canvas-sandbox-viewport[data-device="mobile"]',
    '.studio-canvas-graph-node.is-selected', '.studio-canvas-graph-node.is-drop-before::before',
    '.studio-canvas-graph-resize-handle', '.studio-canvas-sandbox-marquee',
    '.studio-canvas-graph-snap-guide.is-active', '@media (max-width:900px)',
    '@media (prefers-reduced-motion:reduce)'
  ]) {
    if (!css.includes(selector)) errors.push(`studio-canvas-sandbox.css: missing ${selector}`);
  }

  const cssImport = '/assets/css/pages/studio-canvas-sandbox.css?v=1';
  const scriptImport = '/assets/js/studio/canvas/canvas-session-sandbox.js?v=1';
  const oldScriptImport = '/assets/js/studio/canvas/canvas-sandbox.js?v=1';
  const blueprintOperationImport = '/assets/js/studio/blueprint-operation-adapter.js?v=1';
  if (!page.includes(cssImport)) errors.push('public/website-builder.html: Canvas stylesheet is missing');
  if (!page.includes(scriptImport)) errors.push('public/website-builder.html: journaled CanvasSession runtime is missing');
  if (page.includes(oldScriptImport)) errors.push('public/website-builder.html: rollback Canvas sandbox must not remain active');
  if (page.indexOf(scriptImport) < page.indexOf(blueprintOperationImport)) {
    errors.push('public/website-builder.html: CanvasSession must load after Blueprint operation integration');
  }

  if (!modules.includes("id: 'canvas-engine'")) errors.push('module-registry.js: Canvas Engine module is missing');
  if (!modules.includes("dependencies: ['design-system', 'graph-core', 'operation-engine']")) {
    errors.push('module-registry.js: Canvas Engine dependencies are incomplete');
  }
}

console.log(`EvaraOS CanvasSession audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('CanvasSession, GraphProjection, semantic dispatcher, Flow/Grid/Spatial layout, controllers, durable history, and shared journal boundaries passed.');
