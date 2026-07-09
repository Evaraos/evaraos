#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  fixture: 'public/assets/js/studio/canvas/canvas-sandbox-fixture.js',
  projection: 'public/assets/js/studio/canvas/graph-projection.js',
  dispatcher: 'public/assets/js/studio/canvas/mock-operation-dispatcher.js',
  sandbox: 'public/assets/js/studio/canvas/canvas-sandbox.js',
  css: 'public/assets/css/pages/studio-canvas-sandbox.css',
  page: 'public/website-builder.html',
  modules: 'public/assets/js/studio/module-registry.js'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required Canvas sandbox asset is missing`);
}

if (!errors.length) {
  const fixture = read(files.fixture);
  const projection = read(files.projection);
  const dispatcher = read(files.dispatcher);
  const sandbox = read(files.sandbox);
  const css = read(files.css);
  const page = read(files.page);
  const modules = read(files.modules);

  for (const marker of [
    'createEvaraGraph',
    'createGraphNode',
    'createGraphEdge',
    'assertValidEvaraGraph',
    "kind: 'workspace'",
    "kind: 'page'",
    "kind: 'frame'",
    "kind: 'component-instance'",
    "kind: 'contains'",
    'fixture: true'
  ]) {
    if (!fixture.includes(marker)) errors.push(`canvas-sandbox-fixture.js: missing ${marker}`);
  }

  for (const marker of [
    'assertValidEvaraGraph',
    'cloneEvaraGraph',
    'getOutgoingEdges',
    'deepFreeze',
    'projectCanvasPage',
    'flattenGraphProjection',
    'findProjectedNode',
    'Canvas projection contains a cycle'
  ]) {
    if (!projection.includes(marker)) errors.push(`graph-projection.js: missing ${marker}`);
  }

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
  for (const command of commands) {
    if (!dispatcher.includes(`'${command}'`)) errors.push(`mock-operation-dispatcher.js: missing ${command}`);
  }
  for (const marker of [
    'createOperation',
    'applyTransaction',
    'inverseOperations',
    'expectedHeadRevision',
    'MockOperationDispatcher',
    'getGraph()'
  ]) {
    if (!dispatcher.includes(marker)) errors.push(`mock-operation-dispatcher.js: missing ${marker}`);
  }
  if (!dispatcher.includes('isDescendant') || !dispatcher.includes('Canvas reparent would create a graph cycle')) {
    errors.push('mock-operation-dispatcher.js: reparent cycle protection is missing');
  }
  if (!dispatcher.includes('return cloneEvaraGraph(this.#graph)')) {
    errors.push('mock-operation-dispatcher.js: graph reads must return clones');
  }

  for (const marker of [
    'projectCanvasPage',
    'MockOperationDispatcher',
    'selectedIds = new Set()',
    'startMarquee',
    'updateMarquee',
    'startPan',
    'updatePan',
    'startResize',
    'finishResize',
    "event.dataTransfer.setData('text/x-evara-canvas-node'",
    "dispatch('canvas.component.move'",
    "dispatch('canvas.component.resize'",
    "dispatch('canvas.property.set'",
    "dispatch('canvas.visibility.set'",
    "dispatch('canvas.token.bind'",
    "dispatch('canvas.data.bind'",
    'window.EvaraCanvasSandbox'
  ]) {
    if (!sandbox.includes(marker)) errors.push(`canvas-sandbox.js: missing ${marker}`);
  }

  for (const source of [fixture, projection, dispatcher, sandbox]) {
    for (const unsafe of ['innerHTML', 'outerHTML', 'eval(', 'new Function']) {
      if (source.includes(unsafe)) errors.push(`Canvas sandbox: unsafe sink detected: ${unsafe}`);
    }
  }
  for (const prohibited of ['localStorage', 'sessionStorage', 'firebase', 'firestore', 'fetch(']) {
    if (dispatcher.toLowerCase().includes(prohibited.toLowerCase())) {
      errors.push(`mock-operation-dispatcher.js: prohibited persistence/network dependency ${prohibited}`);
    }
    if (sandbox.toLowerCase().includes(prohibited.toLowerCase())) {
      errors.push(`canvas-sandbox.js: prohibited persistence/network dependency ${prohibited}`);
    }
  }

  for (const selector of [
    '.studio-canvas-sandbox',
    '.studio-canvas-sandbox-viewport[data-device="mobile"]',
    '.studio-canvas-graph-node.is-selected',
    '.studio-canvas-graph-node.is-drop-before::before',
    '.studio-canvas-graph-resize-handle',
    '.studio-canvas-sandbox-marquee',
    '.studio-canvas-graph-snap-guide.is-active',
    '@media (max-width: 900px)',
    '@media (prefers-reduced-motion: reduce)'
  ]) {
    if (!css.includes(selector)) errors.push(`studio-canvas-sandbox.css: missing ${selector}`);
  }

  const cssImport = '/assets/css/pages/studio-canvas-sandbox.css?v=1';
  const scriptImport = '/assets/js/studio/canvas/canvas-sandbox.js?v=1';
  const blueprintImport = '/assets/js/studio/studio-blueprint-serialization.js?v=1';
  if (!page.includes(cssImport)) errors.push('public/website-builder.html: Canvas sandbox stylesheet is missing');
  if (!page.includes(scriptImport)) errors.push('public/website-builder.html: Canvas sandbox runtime is missing');
  if (page.indexOf(scriptImport) < page.indexOf(blueprintImport)) {
    errors.push('public/website-builder.html: Canvas sandbox must load after Blueprint serialization');
  }

  if (!modules.includes("id: 'canvas-engine'")) errors.push('module-registry.js: Canvas Engine module is missing');
  if (!modules.includes("dependencies: ['design-system', 'graph-core', 'operation-engine']")) {
    errors.push('module-registry.js: Canvas Engine dependencies are incomplete');
  }
}

console.log(`EvaraOS Canvas sandbox audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Graph fixture, read-only projection, mock dispatcher, semantic gestures, responsive sandbox, and architecture boundaries passed.');
