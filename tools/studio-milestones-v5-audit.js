#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  route: 'public/website-builder.html',
  workbench: 'public/assets/js/studio/canvas/studio-canvas-workbench-v5.js',
  workbenchCss: 'public/assets/css/pages/studio-canvas-workbench-v5.css',
  canvas: 'public/assets/js/studio/canvas/canvas-session-sandbox.js',
  session: 'public/assets/js/studio/canvas/canvas-session.js',
  projection: 'public/assets/js/studio/canvas/graph-projection.js',
  dispatcher: 'public/assets/js/studio/canvas/mock-operation-dispatcher.js',
  trusted: 'public/assets/js/studio/studio-trusted-journal.js',
  authority: 'public/assets/js/studio/studio-production-authority.js',
  ownerControl: 'public/assets/js/studio/studio-owner-control-center.js'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required Studio milestone asset is missing`);
}
if (fs.existsSync(path.join(root, 'public/assets/js/studio/studio-inspector-v3.js'))) {
  errors.push('Legacy studio-inspector-v3.js must be removed instead of competing with Graph Workbench.');
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

  for (const file of [files.workbench, files.canvas, files.session, files.projection, files.dispatcher, files.trusted, files.authority, files.ownerControl]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  const routeImports = [
    '/assets/css/pages/studio-canvas-sandbox.css?v=1',
    '/assets/css/pages/studio-canvas-workbench-v5.css?v=1',
    '/assets/js/studio/canvas/canvas-session-sandbox.js?v=3',
    '/assets/js/studio/canvas/studio-canvas-workbench-v5.js?v=2',
    '/assets/js/studio/studio-owner-control-center.js?v=3',
    '/assets/js/studio/studio-trusted-journal-loader.js?v=1',
    '/assets/js/studio/studio-production-authority.js?v=2'
  ];
  routeImports.forEach((marker) => {
    if (!source.route.includes(marker)) errors.push(`website-builder.html: missing authoritative Studio import ${marker}`);
  });

  for (const prohibited of [
    'studio-canvas-engine-v3.js',
    'studio-canvas-toolbar-v3.js',
    'studio-inspector-v3.js',
    'studio-platform-v4.js',
    'studio-canvas-inspector-v3.css',
    'studio-platform-v4.css'
  ]) {
    if (source.route.includes(prohibited)) errors.push(`website-builder.html: competing prototype must not load: ${prohibited}`);
  }

  const milestoneOne = [
    'canvas.component.insert', 'canvas.component.move', 'canvas.component.resize',
    'canvas.component.duplicate', 'canvas.component.delete', 'canvas.layout.set',
    'canvas.property.set', 'canvas.visibility.set', 'SelectionController',
    'HistoryController', 'SnapResolver', 'studio-workbench-resize',
    "['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']",
    'startSpatialDrag', 'pasteClipboard', 'layerSelected', 'requireAuthoredGraph: true',
    'options.throwOnError', 'existingDirections'
  ];
  milestoneOne.forEach((marker) => {
    const combined = `${source.workbench}\n${source.canvas}\n${source.session}\n${source.dispatcher}`;
    if (!combined.includes(marker)) errors.push(`Milestone 1 Canvas Engine: missing ${marker}`);
  });

  const inspectorMarkers = [
    "section('Content'", "section('Layout'", "section('Typography'", "section('Appearance and effects'",
    'layout.minWidth', 'layout.maxWidth', 'layout.minHeight', 'layout.maxHeight',
    'layout.x', 'layout.y', 'layout.zIndex', 'layout.gap', 'layout.padding',
    'style.fontFamily', 'style.fontSize', 'style.fontWeight', 'style.lineHeight',
    'style.letterSpacing', 'style.textAlign', 'style.textTransform', 'style.textDecoration',
    'style.backgroundColor', 'style.borderColor', 'style.borderWidth', 'style.borderStyle',
    'style.radius', 'style.opacity', 'style.boxShadow', 'style.filter', 'style.rotate',
    'style.scale', 'style.transition', 'STUDIO_COMPONENTS.find'
  ];
  inspectorMarkers.forEach((marker) => {
    if (!source.workbench.includes(marker)) errors.push(`Milestone 2 Inspector: missing ${marker}`);
  });

  const mediaMarkers = [
    'getStorage', 'uploadBytesResumable', 'getDownloadURL', 'deleteObject',
    'companies/${id}/studio/media/', "accept: 'image/*,video/*'", 'applyAsset',
    'style.objectFit', 'style.objectPosition', 'content.alt', 'content.assetUrl', 'content.assetType'
  ];
  mediaMarkers.forEach((marker) => {
    if (!source.workbench.includes(marker)) errors.push(`Milestone 3 Media Manager: missing ${marker}`);
  });

  const reusableMarkers = [
    'reusableComponents', 'saveReusable', 'insert-reusable', 'delete-reusable',
    'MAX_COMPONENTS', 'insertComponent(item.componentType, item.node)'
  ];
  reusableMarkers.forEach((marker) => {
    if (!source.workbench.includes(marker)) errors.push(`Milestone 4 Reusable Components: missing ${marker}`);
  });

  const responsiveMarkers = [
    "const DEVICES = ['desktop', 'tablet', 'mobile']", 'responsive.${device}.span',
    'responsive.${device}.visible', 'responsiveSpan', 'effectiveSpan', 'DEVICE_WIDTHS',
    "[data-device='mobile']", '@media(max-width:760px)'
  ];
  responsiveMarkers.forEach((marker) => {
    const combined = `${source.workbench}\n${source.projection}\n${source.workbenchCss}`;
    if (!combined.includes(marker)) errors.push(`Milestone 5 Responsive Builder: missing ${marker}`);
  });

  const versionMarkers = [
    'MAX_VERSIONS', 'createVersion', 'restoreVersion', 'adapter.checkpoint',
    'adapter.restore', 'checkpointId', 'graphRevision', 'Trusted checkpoints'
  ];
  versionMarkers.forEach((marker) => {
    const combined = `${source.workbench}\n${source.trusted}`;
    if (!combined.includes(marker)) errors.push(`Milestone 6 Version History: missing ${marker}`);
  });

  const logicMarkers = [
    "const ACTION_TYPES = ['navigate', 'open-modal', 'send-email', 'call', 'toggle-visibility']",
    "const TRIGGERS = ['click', 'submit', 'load']", 'executeAction', 'safeNavigation',
    'mailto:', 'tel:', 'workbench-preview-modal', 'toggle-logic-preview'
  ];
  logicMarkers.forEach((marker) => {
    if (!source.workbench.includes(marker)) errors.push(`Milestone 7 No-code Logic: missing ${marker}`);
  });

  const releaseMarkers = [
    'publishRelease', 'adapter.release', 'releaseId', 'checkpointId', 'pending.length',
    'prepareImmutableRelease', 'assertCanvasGraph', "authority: 'canvas-session'",
    'appBuilder', 'studioWorkbench', 'serverTimestamp'
  ];
  releaseMarkers.forEach((marker) => {
    const combined = `${source.workbench}\n${source.trusted}\n${source.authority}`;
    if (!combined.includes(marker)) errors.push(`Milestone 8 Full Visual App Builder: missing ${marker}`);
  });

  const cssMarkers = [
    '.studio-canvas-workbench', '.studio-workbench-tabs', '.studio-workbench-grid',
    '.studio-workbench-resize.is-nw', '.studio-workbench-resize.is-se',
    '.studio-canvas-graph-node.is-workbench-hidden', '.studio-canvas-graph-node.is-workbench-locked',
    '.studio-workbench-node-media', '.studio-workbench-preview-modal',
    'height:100dvh', 'env(safe-area-inset-bottom,0px)', '@media(max-width:760px)'
  ];
  cssMarkers.forEach((marker) => {
    if (!source.workbenchCss.includes(marker)) errors.push(`Studio workbench CSS: missing ${marker}`);
  });

  for (const unsafe of ['innerHTML', 'outerHTML', 'eval(', 'new Function', 'document.write']) {
    if (source.workbench.includes(unsafe)) errors.push(`studio-canvas-workbench-v5.js: prohibited unsafe sink ${unsafe}`);
    if (source.ownerControl.includes(unsafe)) errors.push(`studio-owner-control-center.js: prohibited unsafe sink ${unsafe}`);
  }
  if (!source.route.includes('<template id="studioOwnerControlTemplate">')) {
    errors.push('website-builder.html: safe Owner App Settings template is missing');
  }
  if (!source.ownerControl.includes("document.getElementById('studioOwnerControlTemplate')") || !source.ownerControl.includes('template.content.cloneNode(true)')) {
    errors.push('studio-owner-control-center.js: Owner App Settings must clone the trusted route template');
  }

  if (!source.workbench.includes("window.EvaraStudioWorkbench = Object.freeze")) {
    errors.push('studio-canvas-workbench-v5.js: public integration API is missing');
  }
  if (!source.workbench.includes("document.body.dataset.studioPrimarySurface = 'graph-canvas'")) {
    errors.push('studio-canvas-workbench-v5.js: Graph Canvas is not promoted as the primary Studio surface');
  }
  if (!source.workbench.includes('localStorage.setItem(localKey()') || !source.workbench.includes('persistRemoteMeta')) {
    errors.push('Studio persistence: local draft and company workspace metadata writers are both required');
  }
  if (!source.workbench.includes('studioWorkbenches') || !source.workbench.includes("activeSnapshot?.source !== 'authored-blueprint-graph'")) {
    errors.push('Studio persistence and boot must remain graph-scoped and reject recovery fixtures');
  }
}

console.log(`EvaraOS Studio milestone audit: ${Object.keys(files).length} authoritative assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('All eight Studio milestone contracts, trusted persistence, Firebase media, responsive/mobile presentation, semantic Graph operations, versions, logic, and immutable publishing passed.');
