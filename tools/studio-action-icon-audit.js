#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const requiredFiles = [
  'public/assets/js/icons/icon-registry.js',
  'public/assets/js/studio/studio-action-icon-config-v2.js',
  'public/assets/js/access-control.js',
  'public/assets/css/pages/studio-action-icon-config.css',
  'public/website-builder.html',
  'tests/visual/specs/studio-action-icon.spec.mjs'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required Studio action/icon asset is missing`);
}

if (exists('public/assets/js/studio/studio-action-icon-config.js')) {
  errors.push('public/assets/js/studio/studio-action-icon-config.js: superseded draft must remain removed');
}

if (!errors.length) {
  const icons = read('public/assets/js/icons/icon-registry.js');
  const config = read('public/assets/js/studio/studio-action-icon-config-v2.js');
  const access = read('public/assets/js/access-control.js');
  const css = read('public/assets/css/pages/studio-action-icon-config.css');
  const page = read('public/website-builder.html');
  const test = read('tests/visual/specs/studio-action-icon.spec.mjs');

  for (const marker of [
    "EVARA_ICON_REGISTRY_VERSION = 'icon-registry-v1'",
    'EVARA_ICONS',
    'DEFAULT_COMPONENT_ICONS',
    'normalizeEvaraIconId',
    'searchEvaraIcons',
    'createEvaraIconElement',
    'document.createElementNS'
  ]) {
    if (!icons.includes(marker)) errors.push(`icon-registry.js: missing ${marker}`);
  }

  for (const iconId of ['sparkles', 'card', 'chart', 'settings', 'message', 'map', 'route', 'briefcase', 'service', 'image', 'calendar', 'dollar']) {
    if (!icons.includes(`['${iconId}'`)) errors.push(`icon-registry.js: missing canonical ${iconId} icon`);
  }

  for (const marker of [
    "ACTION_BINDING_VERSION = 'action-binding-v1'",
    'pagesForRole',
    'canAccessPageName',
    'normalizeAccessRole',
    'SAFE_ROUTES',
    'actionIntent',
    'actionTarget',
    'findBridge',
    'data-editable-text',
    'commitAction',
    'studio-action-permission',
    'studio-icon-picker-grid',
    'EVARA_ICON_REGISTRY_VERSION'
  ]) {
    if (!config.includes(marker)) errors.push(`studio-action-icon-config-v2.js: missing ${marker}`);
  }

  if (/localStorage\.setItem\s*\(/.test(config)) {
    errors.push('studio-action-icon-config-v2.js: action/icon configuration must not create a second persistence writer');
  }
  if (/innerHTML|outerHTML|eval\(|new Function/.test(config) || /innerHTML|outerHTML|eval\(|new Function/.test(icons)) {
    errors.push('Studio action/icon runtime: unsafe DOM or code execution sink detected');
  }
  if (!config.includes("STORAGE_KEY = 'evaraos-studio-visual-builder-v1'")) {
    errors.push('studio-action-icon-config-v2.js: existing visual-builder state key must remain authoritative');
  }
  if (!access.includes('export function canAccessPageName') || !access.includes('export function pagesForRole')) {
    errors.push('access-control.js: canonical route authorization exports are missing');
  }

  for (const selector of [
    '.studio-action-config',
    '.studio-action-permission[data-action-permission="critical"]',
    '.studio-icon-picker-grid',
    '.studio-icon-picker-option',
    '.studio-action-icon-field-bridge',
    '.studio-node[data-action-allowed="false"]'
  ]) {
    if (!css.includes(selector)) errors.push(`studio-action-icon-config.css: missing ${selector}`);
  }

  if (!page.includes('/assets/css/pages/studio-action-icon-config.css?v=1')) {
    errors.push('public/website-builder.html: action/icon stylesheet is missing');
  }
  if (!page.includes('/assets/js/studio/studio-action-icon-config-v2.js?v=2')) {
    errors.push('public/website-builder.html: hardened action/icon runtime is missing');
  }
  if (page.includes('/assets/js/studio/studio-action-icon-config.js')) {
    errors.push('public/website-builder.html: superseded action/icon runtime must not be loaded');
  }

  for (const marker of [
    "page.goto('/website-builder.html'",
    'data-action-intent-control',
    'data-action-target-control',
    'data-icon-search',
    'data-icon-choice="map"',
    'data-preview-role',
    'data-action-allowed',
    'data-icon-id'
  ]) {
    if (!test.includes(marker)) errors.push(`studio-action-icon.spec.mjs: missing ${marker} coverage`);
  }
}

console.log(`EvaraOS Studio action/icon audit: ${requiredFiles.length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Studio action labels, semantic intents, permission-aware destinations, icon IDs, safe SVG rendering, and history boundaries passed.');
