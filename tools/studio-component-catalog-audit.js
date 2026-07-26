#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];

const requiredFiles = [
  'public/assets/js/design-system/registry.js',
  'public/assets/js/studio/component-registry.js',
  'public/assets/js/studio/studio-visual-builder.js',
  'public/assets/js/studio/studio-layout-engine.js',
  'public/assets/js/studio/studio-auto-layout.js',
  'public/assets/js/studio/studio-auto-layout-bridge.js',
  'public/assets/js/studio/studio-document-model.js',
  'public/assets/js/studio/studio-document-controls.js',
  'public/assets/js/studio/studio-component-inspector.js',
  'public/assets/css/pages/studio-component-catalog.css',
  'public/assets/css/pages/studio-component-inspector.css',
  'public/assets/css/pages/studio-auto-layout.css',
  'public/assets/css/pages/studio-auto-layout-widths.css',
  'public/assets/css/pages/studio-document-model.css',
  'public/assets/css/pages/studio-shell-authority.css',
  'public/website-builder.html'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required Studio asset is missing`);
}

if (!errors.length) {
  const designRegistry = read('public/assets/js/design-system/registry.js');
  const componentRegistry = read('public/assets/js/studio/component-registry.js');
  const builder = read('public/assets/js/studio/studio-visual-builder.js');
  const layout = read('public/assets/js/studio/studio-layout-engine.js');
  const autoLayout = read('public/assets/js/studio/studio-auto-layout.js');
  const autoLayoutBridge = read('public/assets/js/studio/studio-auto-layout-bridge.js');
  const journal = read('public/assets/js/studio/studio-document-model.js');
  const journalControls = read('public/assets/js/studio/studio-document-controls.js');
  const inspector = read('public/assets/js/studio/studio-component-inspector.js');
  const catalogCss = read('public/assets/css/pages/studio-component-catalog.css');
  const inspectorCss = read('public/assets/css/pages/studio-component-inspector.css');
  const autoLayoutCss = read('public/assets/css/pages/studio-auto-layout.css');
  const autoLayoutWidths = read('public/assets/css/pages/studio-auto-layout-widths.css');
  const journalCss = read('public/assets/css/pages/studio-document-model.css');
  const shellCss = read('public/assets/css/pages/studio-shell-authority.css');
  const studioPage = read('public/website-builder.html');

  if (!componentRegistry.includes("STUDIO_COMPONENT_VERSION = 'component-engine-v4'")) {
    errors.push('public/assets/js/studio/component-registry.js: catalog must remain on component-engine-v4');
  }

  const expectedComponents = [
    'glass-card', 'text-block', 'action-button', 'metric-card', 'status-card',
    'workflow-form', 'upload-field', 'notice-banner', 'settings-panel', 'preference-row',
    'conversation-row', 'message-bubble', 'map-block', 'tracking-card', 'field-card',
    'service-card', 'timeline-card', 'image-block', 'dev-block'
  ];

  for (const id of expectedComponents) {
    if (!componentRegistry.includes(`id: '${id}'`)) errors.push(`component registry: missing ${id}`);
    if (!componentRegistry.includes(`'${id}':`)) errors.push(`component registry: missing Design System contract mapping for ${id}`);
  }

  const duplicateIds = expectedComponents.filter((id, index) => expectedComponents.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`audit configuration contains duplicate component IDs: ${duplicateIds.join(', ')}`);

  const requiredContracts = [
    'card', 'text', 'control', 'workflow-form', 'workflow-upload', 'workflow-notice',
    'settings-panel', 'settings-field', 'conversation-row', 'message-bubble',
    'marketplace-map', 'marketplace-tracking', 'field-card', 'service-card', 'marketplace-timeline'
  ];

  for (const contract of requiredContracts) {
    if (!designRegistry.includes(`id: '${contract}'`)) errors.push(`design-system registry: missing ${contract} contract`);
  }

  if (!builder.includes("...STUDIO_COMPONENTS.map((item) => item.id)")) {
    errors.push('studio-visual-builder.js: component types must continue deriving from the canonical Studio registry');
  }
  if (!builder.includes("STUDIO_COMPONENTS.filter((item) => item.id !== 'dev-block')")) {
    errors.push('studio-visual-builder.js: add sheet must remain registry-driven and keep Developer Block restricted');
  }
  if (!builder.includes('node.type.replaceAll')) {
    errors.push('studio-visual-builder.js: generic registered component fallback is missing');
  }
  if (!builder.includes("closest('.studio-viewport-switcher button[data-device]')")) {
    errors.push('studio-visual-builder.js: viewport controls must use the scoped button selector');
  }
  if (builder.includes("closest('[data-device]')")) {
    errors.push('studio-visual-builder.js: broad viewport selector blocks canvas component selection');
  }

  if (!layout.includes("node?.dataset.nodeType === 'hero-block'")) {
    errors.push('studio-layout-engine.js: only the hero may remain pinned by type');
  }
  if (!layout.includes("document.querySelectorAll('.studio-node[data-node-id]')")) {
    errors.push('studio-layout-engine.js: layout operations must remain generic across registered nodes');
  }

  if (!autoLayout.includes("AUTO_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1'")) {
    errors.push('studio-auto-layout.js: versioned compatibility Auto Layout key is missing');
  }
  if (!autoLayout.includes("node?.dataset.nodeType !== 'hero-block'")) {
    errors.push('studio-auto-layout.js: hero must remain excluded from stack membership');
  }
  for (const capability of ['direction', 'gap', 'padding', 'align', 'wrap', 'children']) {
    if (!autoLayout.includes(capability)) errors.push(`studio-auto-layout.js: missing ${capability} capability`);
  }
  if (!autoLayout.includes('MutationObserver') || !autoLayout.includes('normalizeAutoState')) {
    errors.push('studio-auto-layout.js: validated lifecycle rehydration is incomplete');
  }
  if (!autoLayout.includes('undoAuto') || !autoLayout.includes('redoAuto')) {
    errors.push('studio-auto-layout.js: Auto Layout history controls are missing');
  }
  if (!autoLayoutBridge.includes("text/x-evara-studio-node") || !autoLayoutBridge.includes('[data-auto-node]')) {
    errors.push('studio-auto-layout-bridge.js: hierarchy drag payload bridge is incomplete');
  }

  for (const marker of [
    "DB_NAME = 'evaraos-studio-journal'",
    "SESSION_STORE = 'sessions'",
    "TRANSACTION_STORE = 'transactions'",
    "CHECKPOINT_STORE = 'checkpoints'",
    'indexedDB.open',
    'expectedHeadRevision',
    'inverseOperations',
    'pendingTransactionIds',
    'appendTransaction',
    'createCheckpoint',
    'restoreCheckpoint',
    'registerServerAdapter',
    "type: 'compatibility.projection.replace'",
    "reason: 'trusted-release-required'"
  ]) {
    if (!journal.includes(marker)) errors.push(`studio-document-model.js: missing journal contract marker ${marker}`);
  }

  for (const intent of [
    'canvas.layout.set', 'canvas.property.set', 'history.undo', 'checkpoint.create', 'migration.apply'
  ]) {
    if (!journal.includes(`'${intent}'`)) errors.push(`studio-document-model.js: missing semantic intent ${intent}`);
  }

  if (!journal.includes('installCompatibilityBridge();') || journal.indexOf('installCompatibilityBridge();') > journal.indexOf('initialize()\n  .then')) {
    errors.push('studio-document-model.js: compatibility bridge must install synchronously before journal initialization completes');
  }
  if (!journal.includes('return { migrationProjection:') || !journal.includes('.then(async ({ migrationProjection })')) {
    errors.push('studio-document-model.js: startup migration must occur after journal initialization without recursive initialize calls');
  }
  if (!journalControls.includes('Publishing requires the trusted server journal and release service.')) {
    errors.push('studio-document-controls.js: browser-only publishing must remain blocked');
  }
  if (!journalControls.includes('window.EvaraStudioJournal') || !journalControls.includes('createCheckpoint') || !journalControls.includes('restoreCheckpoint')) {
    errors.push('studio-document-controls.js: journal recovery controls are incomplete');
  }

  const inspectorContracts = [
    'componentsByCategory',
    'getStudioComponent',
    'CATEGORY_ORDER',
    'catalogSearch',
    'propertyField',
    'removeLegacyFieldBridges',
    'EvaraStudioPropertyBridge',
    'updateNodeField',
    "matches('input[data-property-field], textarea[data-property-field]')",
    'REQUIRED_FIELDS',
    'SELECT_OPTIONS',
    'MutationObserver'
  ];
  for (const marker of inspectorContracts) {
    if (!inspector.includes(marker)) errors.push(`studio-component-inspector.js: missing inspector contract ${marker}`);
  }

  for (const semanticField of ['action', 'style', 'tone', 'direction', 'status', 'locationSource', 'zoom']) {
    if (!inspector.includes(`${semanticField}: [`)) errors.push(`studio-component-inspector.js: missing semantic options for ${semanticField}`);
  }
  if (/localStorage\.setItem\s*\(/.test(inspector)) {
    errors.push('studio-component-inspector.js: inspector must not create a second persistence writer');
  }
  if (!inspector.includes("STORAGE_KEY = 'evaraos-studio-visual-builder-v1'")) {
    errors.push('studio-component-inspector.js: inspector must read the existing visual-builder state');
  }

  for (const source of [autoLayout, autoLayoutBridge, journal, journalControls, inspector]) {
    for (const unsafeSink of ['innerHTML', 'outerHTML', 'eval(', 'new Function']) {
      if (source.includes(unsafeSink)) errors.push(`Studio runtime: unsafe sink detected: ${unsafeSink}`);
    }
  }

  const journalModelImport = '/assets/js/studio/studio-document-model.js';
  const journalControlsImport = '/assets/js/studio/studio-document-controls.js';
  const builderImport = '/assets/js/studio/studio-visual-builder.js';
  const inspectorImport = '/assets/js/studio/studio-component-inspector.js';
  if (!studioPage.includes('/assets/css/pages/studio-component-catalog.css?v=1')) {
    errors.push('public/website-builder.html: expanded catalog preview stylesheet is missing');
  }
  if (!studioPage.includes('/assets/css/pages/studio-component-inspector.css?v=2')) {
    errors.push('public/website-builder.html: property inspector stylesheet is missing');
  }
  if (!studioPage.includes('/assets/css/pages/studio-auto-layout.css?v=1')) {
    errors.push('public/website-builder.html: Auto Layout stylesheet is missing');
  }
  if (!studioPage.includes('/assets/css/pages/studio-auto-layout-widths.css?v=1')) {
    errors.push('public/website-builder.html: compatible Auto Layout width stylesheet is missing');
  }
  if (!studioPage.includes('/assets/css/pages/studio-document-model.css?v=1')) {
    errors.push('public/website-builder.html: draft journal stylesheet is missing');
  }
  if (!studioPage.includes('/assets/css/pages/studio-shell-authority.css?v=2')) {
    errors.push('public/website-builder.html: Studio shell authority stylesheet is missing');
  }
  if (!studioPage.includes('/assets/js/studio/studio-auto-layout.js?v=1')) {
    errors.push('public/website-builder.html: Auto Layout runtime is missing');
  }
  if (!studioPage.includes('/assets/js/studio/studio-auto-layout-bridge.js?v=1')) {
    errors.push('public/website-builder.html: Auto Layout drag bridge is missing');
  }
  if (!studioPage.includes(journalModelImport) || !studioPage.includes(journalControlsImport)) {
    errors.push('public/website-builder.html: operation-aware Journal runtime or controls are missing');
  }
  if (!studioPage.includes(inspectorImport)) {
    errors.push('public/website-builder.html: component property inspector is missing');
  }
  if (studioPage.indexOf(journalModelImport) > studioPage.indexOf(builderImport)) {
    errors.push('public/website-builder.html: draft journal must load before the compatibility visual builder');
  }
  if (studioPage.indexOf(inspectorImport) < studioPage.indexOf(builderImport)) {
    errors.push('public/website-builder.html: property inspector must load after the visual builder');
  }

  for (const selector of [
    '.studio-auto-layout-frame[data-auto-direction="row"]',
    '.studio-auto-layout-frame[data-auto-direction="column"]',
    '@media (max-width: 720px)'
  ]) {
    if (!autoLayoutCss.includes(selector)) errors.push(`studio-auto-layout.css: missing ${selector}`);
  }
  for (const span of ['3', '4', '6', '8', '12']) {
    if (!autoLayoutWidths.includes(`data-span="${span}"`)) errors.push(`studio-auto-layout-widths.css: missing explicit ${span}/12 width rule`);
  }
  for (const selector of ['data-state="syncing"', 'data-state="saved-locally"', '.studio-journal-heading']) {
    if (!journalCss.includes(selector)) errors.push(`studio-document-model.css: missing ${selector}`);
  }
  for (const marker of [
    'body.studio-visual-page > #appRoot',
    'transform: none !important',
    'grid-template-rows: 62px minmax(0, 1fr)',
    '.studio-top-actions > *',
    '@media (max-width: 1680px)',
    '.studio-production-authority-badge'
  ]) {
    if (!shellCss.includes(marker)) errors.push(`studio-shell-authority.css: missing ${marker}`);
  }

  for (const id of expectedComponents.filter((id) => !['glass-card', 'action-button', 'metric-card', 'map-block', 'image-block', 'dev-block'].includes(id))) {
    if (!catalogCss.includes(`data-node-type="${id}"`) && !catalogCss.includes(`data-add-component="${id}"`)) {
      errors.push(`studio-component-catalog.css: missing preview treatment for ${id}`);
    }
  }

  for (const misleadingCopy of ['Healthy', 'Choose files', '9:41 AM', '12 min', 'Open job', 'From $149', 'Requested']) {
    if (catalogCss.includes(`content: "${misleadingCopy}`)) {
      errors.push(`studio-component-catalog.css: decorative pseudo-element contains non-editable copy: ${misleadingCopy}`);
    }
  }

  for (const selector of [
    '.studio-catalog-search',
    '.studio-catalog-group',
    '.studio-component-inspector',
    '.studio-property-field',
    '.studio-catalog-field-bridge',
    '.studio-catalog-meta',
    '[data-catalog-tone="warning"]',
    '[data-catalog-direction="incoming"]'
  ]) {
    if (!inspectorCss.includes(selector)) errors.push(`studio-component-inspector.css: missing ${selector}`);
  }
}

console.log(`EvaraOS Studio audit: ${requiredFiles.length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Studio catalog, property inspector, semantic controls, Canvas compatibility layer, Auto Layout, operation-aware IndexedDB Journal, recovery, and authoring boundaries passed.');
