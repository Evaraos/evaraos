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
  'public/assets/css/pages/studio-component-catalog.css',
  'public/website-builder.html'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required Studio catalog asset is missing`);
}

if (!errors.length) {
  const designRegistry = read('public/assets/js/design-system/registry.js');
  const componentRegistry = read('public/assets/js/studio/component-registry.js');
  const builder = read('public/assets/js/studio/studio-visual-builder.js');
  const layout = read('public/assets/js/studio/studio-layout-engine.js');
  const catalogCss = read('public/assets/css/pages/studio-component-catalog.css');
  const studioPage = read('public/website-builder.html');

  if (!componentRegistry.includes("STUDIO_COMPONENT_VERSION = 'component-engine-v4'")) {
    errors.push('public/assets/js/studio/component-registry.js: catalog must remain on component-engine-v4');
  }

  const expectedComponents = [
    'glass-card',
    'text-block',
    'action-button',
    'metric-card',
    'status-card',
    'workflow-form',
    'upload-field',
    'notice-banner',
    'settings-panel',
    'preference-row',
    'conversation-row',
    'message-bubble',
    'map-block',
    'tracking-card',
    'field-card',
    'service-card',
    'timeline-card',
    'image-block',
    'dev-block'
  ];

  for (const id of expectedComponents) {
    if (!componentRegistry.includes(`id: '${id}'`)) errors.push(`component registry: missing ${id}`);
    if (!componentRegistry.includes(`'${id}':`)) errors.push(`component registry: missing Design System contract mapping for ${id}`);
  }

  const duplicateIds = expectedComponents.filter((id, index) => expectedComponents.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`audit configuration contains duplicate component IDs: ${duplicateIds.join(', ')}`);

  const requiredContracts = [
    'card',
    'text',
    'control',
    'workflow-form',
    'workflow-upload',
    'workflow-notice',
    'settings-panel',
    'settings-field',
    'conversation-row',
    'message-bubble',
    'marketplace-map',
    'marketplace-tracking',
    'field-card',
    'service-card',
    'marketplace-timeline'
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

  if (!layout.includes("node?.dataset.nodeType === 'hero-block'")) {
    errors.push('studio-layout-engine.js: only the hero may remain pinned by type');
  }
  if (!layout.includes("document.querySelectorAll('.studio-node[data-node-id]')")) {
    errors.push('studio-layout-engine.js: layout operations must remain generic across registered nodes');
  }

  if (!studioPage.includes('/assets/css/pages/studio-component-catalog.css?v=1')) {
    errors.push('public/website-builder.html: expanded catalog preview stylesheet is missing');
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
}

console.log(`EvaraOS Studio catalog audit: ${requiredFiles.length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Studio catalog registry, contracts, previews, layout compatibility, and authoring boundaries passed.');
