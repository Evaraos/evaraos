#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const errors = [];
const warnings = [];

const requiredFiles = [
  'public/assets/css/base/variables.css',
  'public/assets/css/theme/liquid-optics.css',
  'public/assets/css/design-system.css',
  'public/assets/css/design-system/primitives.css',
  'public/assets/css/design-system/workflows.css',
  'public/assets/css/design-system/settings.css',
  'public/assets/css/design-system/communications.css',
  'public/assets/css/design-system/marketplace.css',
  'public/assets/js/design-system.js',
  'public/assets/js/design-system/registry.js',
  'public/assets/js/studio/component-registry.js',
  'public/website-builder.html'
];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required design-system asset is missing`);
}

if (!errors.length) {
  const bundle = read('public/assets/css/design-system.css');
  const theme = read('public/assets/css/theme.css');
  const optics = read('public/assets/css/theme/liquid-optics.css');
  const runtime = read('public/assets/js/design-system.js');
  const registry = read('public/assets/js/design-system/registry.js');
  const studioRegistry = read('public/assets/js/studio/component-registry.js');
  const studioPage = read('public/website-builder.html');

  const requiredBundleImports = [
    'design-system/primitives.css',
    'design-system/workflows.css',
    'design-system/settings.css',
    'design-system/communications.css',
    'design-system/marketplace.css'
  ];

  for (const source of requiredBundleImports) {
    if (!bundle.includes(source)) errors.push(`public/assets/css/design-system.css: missing ${source}`);
  }

  if (!theme.includes('base/variables.css')) errors.push('public/assets/css/theme.css: missing foundation variables import');
  if (!theme.includes('theme/liquid-optics.css')) errors.push('public/assets/css/theme.css: missing authoritative Liquid Glass import');
  if (!theme.includes('design-system/primitives.css')) errors.push('public/assets/css/theme.css: missing core primitives import');
  if (!/AUTHORITATIVE MATERIAL ENGINE/.test(optics)) errors.push('public/assets/css/theme/liquid-optics.css: missing authoritative material declaration');

  const forbiddenBundlePatterns = [
    /--eva-color-brand\s*:/,
    /\.eva-glass\s*,?\s*\.glass-card\s*\{/,
    /backdrop-filter\s*:/,
    /box-shadow\s*:/,
    /background\s*:\s*(?:linear-gradient|rgba?\()/
  ];

  for (const pattern of forbiddenBundlePatterns) {
    if (pattern.test(bundle)) errors.push(`public/assets/css/design-system.css: aggregate bundle contains competing paint matched by ${pattern}`);
  }

  if (!/DESIGN_SYSTEM_VERSION\s*=\s*['"]ds-v2['"]/.test(runtime)) errors.push('public/assets/js/design-system.js: runtime is not ds-v2');
  if (!/design-system\.css\?v=\$\{DESIGN_SYSTEM_BUNDLE_VERSION\}/.test(runtime)) errors.push('public/assets/js/design-system.js: runtime does not load the versioned canonical bundle');
  if (!/design-system\/registry\.js/.test(runtime)) errors.push('public/assets/js/design-system.js: registry loader is missing');

  for (const layer of ['tokens', 'material', 'primitives', 'workflows', 'settings', 'communications', 'marketplace']) {
    if (!registry.includes(`id: '${layer}'`)) errors.push(`public/assets/js/design-system/registry.js: missing ${layer} layer`);
  }

  for (const component of ['card', 'control', 'workflow-form', 'settings-panel', 'message-bubble', 'service-card', 'dispatch-board', 'marketplace-map']) {
    if (!registry.includes(`id: '${component}'`)) errors.push(`public/assets/js/design-system/registry.js: missing ${component} contract`);
  }

  if (!studioRegistry.includes("../design-system/registry.js")) errors.push('public/assets/js/studio/component-registry.js: canonical registry is not connected');
  if (!studioRegistry.includes('data-design-system-contract')) errors.push('public/assets/js/studio/component-registry.js: previews do not expose contract metadata');
  if (!/design-system\.css\?v=2/.test(studioPage)) errors.push('public/website-builder.html: Studio is not loading design-system bundle v2');
  if (!/data-evara-design-system="ds-v2"/.test(studioPage)) errors.push('public/website-builder.html: Studio bundle contract marker is missing');

  const bundleImports = [...bundle.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1]);
  for (const importUrl of bundleImports) {
    const pathname = importUrl.split('?')[0];
    if (!pathname.startsWith('/assets/')) continue;
    const diskPath = path.join(publicRoot, pathname.replace(/^\//, '').replace(/^assets\//, 'assets/'));
    if (!fs.existsSync(diskPath)) errors.push(`public/assets/css/design-system.css: import target does not exist: ${pathname}`);
  }

  const htmlFiles = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) htmlFiles.push(full);
    }
  };
  walk(publicRoot);

  for (const file of htmlFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).replace(/\\/g, '/');
    if (/design-system\.css\?v=1(?:["'])/.test(text)) errors.push(`${relative}: stale design-system bundle v1 link`);
    if ((text.match(/design-system\.css/g) || []).length > 1) warnings.push(`${relative}: multiple design-system bundle links`);
  }

  const pageCssRoot = path.join(publicRoot, 'assets/css/pages');
  if (fs.existsSync(pageCssRoot)) {
    for (const name of fs.readdirSync(pageCssRoot)) {
      if (!name.endsWith('.css')) continue;
      const text = fs.readFileSync(path.join(pageCssRoot, name), 'utf8');
      if (/--eva-color-brand\s*:|\.eva-glass\s*\{|AUTHORITATIVE MATERIAL ENGINE/.test(text)) {
        errors.push(`public/assets/css/pages/${name}: page stylesheet attempts to own global tokens or material authority`);
      }
      if (/backdrop-filter\s*:/.test(text)) warnings.push(`public/assets/css/pages/${name}: page-level backdrop material requires design-system review`);
    }
  }
}

console.log(`EvaraOS design-system audit: ${requiredFiles.length} required assets checked.`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Design-system registry, Studio contract, bundle, and ownership audit passed.');
