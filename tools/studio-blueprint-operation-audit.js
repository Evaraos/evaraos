#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const requiredFiles = [
  'public/assets/js/studio/studio-document-model.js',
  'public/assets/js/studio/blueprint-operation-adapter.js',
  'public/assets/js/studio/blueprint-component-document.js',
  'public/assets/js/studio/core/evara-graph.js',
  'public/assets/js/studio/core/operation-protocol.js',
  'public/assets/js/studio/canvas/canvas-operation-journal.js',
  'public/assets/js/studio/canvas/canvas-session.js',
  'public/assets/js/studio/canvas/canvas-history-controller.js',
  'public/assets/js/studio/canvas/canvas-session-sandbox.js',
  'public/website-builder.html',
  'tests/visual/specs/studio-blueprint-operations.spec.mjs',
  'tests/visual/specs/studio-canvas-session.spec.mjs',
  '.github/workflows/design-system-visual-qa.yml'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required Blueprint operation asset is missing`);
}

if (!errors.length) {
  const journal = read('public/assets/js/studio/studio-document-model.js');
  const adapter = read('public/assets/js/studio/blueprint-operation-adapter.js');
  const documentRuntime = read('public/assets/js/studio/blueprint-component-document.js');
  const graph = read('public/assets/js/studio/core/evara-graph.js');
  const protocol = read('public/assets/js/studio/core/operation-protocol.js');
  const canvasJournal = read('public/assets/js/studio/canvas/canvas-operation-journal.js');
  const canvasSession = read('public/assets/js/studio/canvas/canvas-session.js');
  const history = read('public/assets/js/studio/canvas/canvas-history-controller.js');
  const sandbox = read('public/assets/js/studio/canvas/canvas-session-sandbox.js');
  const page = read('public/website-builder.html');
  const blueprintTest = read('tests/visual/specs/studio-blueprint-operations.spec.mjs');
  const canvasTest = read('tests/visual/specs/studio-canvas-session.spec.mjs');
  const workflow = read('.github/workflows/design-system-visual-qa.yml');

  for (const marker of [
    "DB_NAME = 'evaraos-studio-journal'",
    "DB_VERSION = 1",
    "OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1'",
    'graphHeads',
    'normalizeOperationEnvelope',
    'appendOperationTransaction',
    'getGraphHead',
    'listOperationTransactions',
    'transactions.add(envelope)',
    "dispatchStatus('conflict'",
    'evara:studio-operation-durable',
    'pendingTransactionIds',
    'projectionHash'
  ]) {
    if (!journal.includes(marker)) errors.push(`studio-document-model.js: missing ${marker}`);
  }

  if ((journal.match(/indexedDB\.open\(/g) || []).length !== 1) {
    errors.push('studio-document-model.js: exactly one IndexedDB journal authority must remain');
  }
  for (const store of ["'sessions'", "'transactions'", "'checkpoints'"]) {
    if (!journal.includes(store)) errors.push(`studio-document-model.js: missing canonical ${store} store`);
  }

  for (const marker of [
    "BLUEPRINT_OPERATION_ADAPTER_VERSION = 'blueprint-operation-adapter-v1'",
    "CANVAS_COMMAND_VERSION = 'canvas-semantic-command-v1'",
    'compileBlueprintDocumentToGraph',
    'serializeStudioPageToBlueprint',
    'createOperation',
    'applyTransaction',
    'changedPageIds',
    'inferSemanticIntents',
    "'canvas.component.insert'",
    "'canvas.component.delete'",
    "'canvas.component.move'",
    "'canvas.layout.set'",
    "'canvas.visibility.set'",
    "'canvas.property.set'",
    'graphDiffOperations',
    'graphSignature(result.graph) !== graphSignature(afterGraph)',
    'appendOperationTransaction',
    'listOperationTransactions',
    'getGraphHead',
    "authority: 'draft-journal-compatibility-adapter'",
    'trustedCommitRequired: true',
    'dataset.operationDurability'
  ]) {
    if (!adapter.includes(marker)) errors.push(`blueprint-operation-adapter.js: missing ${marker}`);
  }

  if (/indexedDB\.open\s*\(/.test(adapter)) errors.push('blueprint-operation-adapter.js: adapter must reuse the existing Journal database');
  if (/localStorage\.setItem\s*\(/.test(adapter)) errors.push('blueprint-operation-adapter.js: adapter must not create a direct localStorage writer');
  if (/httpsCallable|fetch\(|XMLHttpRequest|publishBlueprint|saveBlueprintDraft|rollbackBlueprint/.test(adapter)) {
    errors.push('blueprint-operation-adapter.js: trusted network or publishing calls are prohibited');
  }
  if (/innerHTML|outerHTML|eval\(|new Function/.test(adapter)) errors.push('blueprint-operation-adapter.js: unsafe DOM or code execution sink detected');

  if (!protocol.includes("EVARA_OPERATION_PROTOCOL_VERSION = '0.1.0'")) errors.push('operation-protocol.js: reviewed protocol version changed');
  for (const type of ['node.create', 'node.delete', 'node.patch', 'edge.create', 'edge.delete', 'graph.meta.patch', 'transaction.commit']) {
    if (!protocol.includes(`'${type}'`)) errors.push(`operation-protocol.js: missing ${type}`);
  }
  if (!protocol.includes('inverseOperations: inverseGroups.reverse().flat()')) errors.push('operation-protocol.js: inverse transaction contract is missing');
  if (!graph.includes("'component-instance'")) errors.push('evara-graph.js: component-instance node kind is missing');
  if (!documentRuntime.includes('compileBlueprintDocumentToGraph')) errors.push('blueprint-component-document.js: graph compiler is missing');

  for (const marker of [
    'class CanvasOperationJournal',
    'window.EvaraStudioJournal',
    'listOperationTransactions',
    'appendOperationTransaction',
    'getGraphHead',
    'replayOperations',
    'Canvas operation recovery failed',
    'Canvas graph head mismatch',
    "channel: 'direct-canvas-session'",
    'inverseOperations',
    'commitOperation',
    'pendingTransactions'
  ]) {
    if (!canvasJournal.includes(marker)) errors.push(`canvas-operation-journal.js: missing ${marker}`);
  }
  if (/indexedDB\.open|localStorage|sessionStorage|httpsCallable|fetch\(|XMLHttpRequest/.test(canvasJournal)) {
    errors.push('canvas-operation-journal.js: CanvasSession must reuse the canonical Journal without direct storage or network access');
  }

  for (const marker of [
    'CanvasOperationJournal',
    'HistoryController',
    'await this.#journal.append(prepared',
    'this.#graph = clone(prepared.graph)',
    'applyTransaction',
    'history.undo',
    'history.redo',
    'sourceDocumentId',
    'sourceFingerprint',
    'durable: true'
  ]) {
    if (!canvasSession.includes(marker)) errors.push(`canvas-session.js: missing ${marker}`);
  }
  if (canvasSession.indexOf('await this.#journal.append(prepared') > canvasSession.indexOf('this.#graph = clone(prepared.graph)')) {
    errors.push('canvas-session.js: Canvas graph must not be accepted before the Journal append resolves');
  }
  if (/indexedDB\.open|localStorage|sessionStorage|httpsCallable|fetch\(|XMLHttpRequest/.test(canvasSession)) {
    errors.push('canvas-session.js: CanvasSession must not own persistence or network transport');
  }

  for (const marker of [
    'class HistoryController',
    'inverseOperations',
    "intent: 'history.undo'",
    'revertsTransactionId',
    "intent: 'history.redo'",
    'redoesTransactionId',
    'dispatchOperations'
  ]) {
    if (!history.includes(marker)) errors.push(`canvas-history-controller.js: missing ${marker}`);
  }

  for (const marker of [
    'createCanvasSession',
    'session.undo()',
    'session.redo()',
    'session.interaction.begin',
    'session.selection.select',
    "command('canvas.component.insert'",
    "event.dataTransfer.setData('text/x-evara-canvas-node'",
    'pendingTransactions'
  ]) {
    if (!sandbox.includes(marker)) errors.push(`canvas-session-sandbox.js: missing ${marker}`);
  }
  if (sandbox.includes('MockOperationDispatcher')) {
    errors.push('canvas-session-sandbox.js: activated UI must dispatch through CanvasSession rather than own a mock dispatcher');
  }

  const serializationImport = '/assets/js/studio/studio-blueprint-serialization.js?v=1';
  const operationImport = '/assets/js/studio/blueprint-operation-adapter.js?v=1';
  const canvasImport = '/assets/js/studio/canvas/canvas-session-sandbox.js?v=1';
  const rollbackImport = '/assets/js/studio/canvas/canvas-sandbox.js?v=1';
  if (!page.includes(operationImport)) errors.push('public/website-builder.html: Blueprint operation adapter is missing');
  if (!(page.indexOf(serializationImport) >= 0 && page.indexOf(serializationImport) < page.indexOf(operationImport))) {
    errors.push('public/website-builder.html: Blueprint operation adapter must load after serialization');
  }
  if (!(page.indexOf(operationImport) < page.indexOf(canvasImport))) {
    errors.push('public/website-builder.html: Blueprint operation adapter must load before CanvasSession');
  }
  if (page.includes(rollbackImport)) errors.push('public/website-builder.html: rollback sandbox must not remain active after the migration gate');
  if (!page.includes('/assets/js/studio/studio-document-model.js?v=2')) errors.push('public/website-builder.html: operation-aware Journal cache version is missing');

  for (const marker of [
    "page.goto('/website-builder.html'",
    'EvaraStudioJournal?.appendOperationTransaction',
    'EvaraBlueprintOperationAdapter?.flush',
    "envelopeVersion).toBe('studio-journal-operation-envelope-v1'",
    "intent).toBe('canvas.component.insert'",
    "version: 'canvas-semantic-command-v1'",
    'inverseOperations.length',
    "commitOperation.type).toBe('transaction.commit'",
    'acceptedHeadRevision',
    'appendOperationTransaction(transaction)',
    'data-property-field="title"',
    'data-auto-action="create"',
    "transaction.intent === 'canvas.property.set'",
    "transaction.intent === 'canvas.layout.set'",
    'getGraphHead',
    'compatibilityForLatestProjection',
    'studio-blueprint-operation-transactions.json',
    'studio-blueprint-operations.png'
  ]) {
    if (!blueprintTest.includes(marker)) errors.push(`studio-blueprint-operations.spec.mjs: missing ${marker} coverage`);
  }

  for (const marker of [
    'semantic insert undo redo and reload recovery',
    "graphId).toMatch(/^graph:canvas:/",
    "dispatch('canvas.component.insert'",
    'EvaraCanvasSandbox.undo()',
    'EvaraCanvasSandbox.redo()',
    'pendingTransactions()',
    'page.reload',
    'recovered.exists',
    'canvas-session-recovery.json'
  ]) {
    if (!canvasTest.includes(marker)) errors.push(`studio-canvas-session.spec.mjs: missing ${marker} coverage`);
  }

  if (!workflow.includes('node tools/studio-blueprint-operation-audit.js')) {
    errors.push('.github/workflows/design-system-visual-qa.yml: Blueprint operation audit is not wired');
  }
  if (!workflow.includes('specs/studio-blueprint-operations.spec.mjs')) {
    errors.push('.github/workflows/design-system-visual-qa.yml: Blueprint operation test is not wired');
  }
  if (!workflow.includes('specs/studio-canvas-session.spec.mjs')) {
    errors.push('.github/workflows/design-system-visual-qa.yml: CanvasSession migration test is not wired');
  }
}

console.log(`EvaraOS Blueprint operation audit: ${requiredFiles.length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Blueprint and Canvas semantic commands, reversible Evara operations, canonical Journal durability, migration validation, conflict detection, and compensating history boundaries passed.');
