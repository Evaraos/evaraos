#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  authority: 'public/assets/js/studio/studio-production-authority.js',
  css: 'public/assets/css/pages/studio-production-authority.css',
  route: 'public/website-builder.html',
  loader: 'public/assets/js/studio/studio-trusted-journal-loader.js',
  trusted: 'public/assets/js/studio/studio-trusted-journal.js',
  controls: 'public/assets/js/studio/studio-document-controls.js',
  compatibility: 'public/assets/js/studio/studio-visual-builder.js',
  registry: 'public/assets/js/studio/module-registry.js'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required production-authority asset is missing`);
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
  for (const file of [files.authority, files.loader, files.trusted, files.controls, files.compatibility, files.registry]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  for (const marker of [
    "AUTHORITY_VERSION = 'studio-production-authority-v1'",
    "CANVAS_GRAPH_PREFIX = 'graph:canvas:'",
    'assertCanvasGraph',
    'Compatibility projections are migration-only',
    'productionAuthorityVersion',
    "authority: 'canvas-session'",
    "compatibilityMode: 'migration-only'",
    'releaseGraphPrefix',
    'retry-sync',
    'recover-trusted',
    'create-branch',
    'dismiss-conflict',
    'rejectPendingAndRecover',
    'latestTrustedCheckpoint',
    'createBranch',
    'The local draft was preserved',
    'No last-write-wins overwrite was attempted',
    "window.addEventListener('evara:app-check-status'",
    'trustedAdapterGuarded'
  ]) {
    if (!source.authority.includes(marker)) errors.push(`studio-production-authority.js: missing ${marker}`);
  }
  for (const prohibited of ['innerHTML', 'outerHTML', 'eval(', 'new Function', 'localStorage', 'sessionStorage', 'indexedDB', 'getFirestore', 'getStorage', 'fetch(']) {
    if (source.authority.includes(prohibited)) errors.push(`studio-production-authority.js: prohibited dependency or unsafe sink ${prohibited}`);
  }

  for (const selector of [
    'data-studio-authoring-authority="canvas-session"',
    '.studio-production-authority-badge',
    '.studio-compatibility-migration-notice',
    '.studio-production-conflict-panel',
    '.studio-production-conflict-actions',
    '.studio-production-authority-toast',
    '@media (max-width: 820px)',
    '@media (prefers-reduced-motion: reduce)'
  ]) {
    if (!source.css.includes(selector)) errors.push(`studio-production-authority.css: missing ${selector}`);
  }

  for (const marker of [
    'getToken(appCheck, forceRefresh)',
    "import('./studio-trusted-journal.js?v=1')",
    'app-check-token-confirmed',
    'trusted-journal-loaded',
    'app-check-unavailable'
  ]) {
    if (!source.loader.includes(marker)) errors.push(`studio-trusted-journal-loader.js: missing ${marker}`);
  }

  const authorityCss = '/assets/css/pages/studio-production-authority.css?v=1';
  const authorityJs = '/assets/js/studio/studio-production-authority.js?v=1';
  const loaderJs = '/assets/js/studio/studio-trusted-journal-loader.js?v=1';
  const trustedJs = '/assets/js/studio/studio-trusted-journal.js?v=1';
  const blueprintJs = '/assets/js/studio/blueprint-operation-adapter.js?v=1';
  const canvasJs = '/assets/js/studio/canvas/canvas-session-sandbox.js?v=2';
  if (!source.route.includes(authorityCss)) errors.push('website-builder.html: production-authority stylesheet is missing');
  if (!source.route.includes(authorityJs)) errors.push('website-builder.html: production-authority runtime is missing');
  if (!source.route.includes(loaderJs)) errors.push('website-builder.html: App Check trusted-Journal loader is missing');
  if (!source.route.includes(`Dynamic import contract enforced by App Check loader: ${trustedJs}`)) {
    errors.push('website-builder.html: trusted adapter dynamic-import contract is missing');
  }
  const directTrustedScript = new RegExp(`<script[^>]+src=["']${trustedJs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
  if (directTrustedScript.test(source.route)) {
    errors.push('website-builder.html: trusted adapter must not load directly before App Check attestation');
  }
  if (!(source.route.indexOf(blueprintJs) < source.route.indexOf(loaderJs)
    && source.route.indexOf(loaderJs) < source.route.indexOf(canvasJs)
    && source.route.indexOf(canvasJs) < source.route.indexOf(authorityJs))) {
    errors.push('website-builder.html: Blueprint, App Check loader, CanvasSession, and production-authority load order is invalid');
  }

  if (!source.trusted.includes('prepareImmutableRelease') || !source.trusted.includes('createTrustedCheckpoint')) {
    errors.push('studio-trusted-journal.js: trusted checkpoint and immutable release interfaces are missing');
  }
  if (!source.controls.includes('ensureCanvasSession') || !source.controls.includes('prepareTrustedRelease')) {
    errors.push('studio-document-controls.js: release controls must resolve the authoritative CanvasSession');
  }
  if (!source.controls.includes("document.body.dataset.canvasWriterState !== 'writer'")) {
    errors.push('studio-document-controls.js: only the active writer may prepare a release');
  }
  if (!source.controls.includes('snapshot.integrityState') || !/unsynchronized Canvas transaction/i.test(source.controls)) {
    errors.push('studio-document-controls.js: integrity and unsynchronized release gates are missing');
  }

  if (!source.compatibility.includes("STORAGE_KEY = 'evaraos-studio-visual-builder-v1'")) {
    errors.push('studio-visual-builder.js: compatibility migration source is missing');
  }
  if (!source.compatibility.includes('localStorage.setItem(STORAGE_KEY')) {
    errors.push('studio-visual-builder.js: compatibility projection contract changed unexpectedly');
  }
  if (source.authority.includes('localStorage.setItem')) {
    errors.push('studio-production-authority.js: production authority must never persist through compatibility localStorage');
  }

  if (!source.registry.includes("id: 'canvas-engine'")) errors.push('module-registry.js: Canvas Engine registration is missing');
  if (!source.registry.includes("id: 'operation-engine'")) errors.push('module-registry.js: Operation Engine registration is missing');
}

console.log(`EvaraOS production-authority audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('App Check-gated Canvas-only release authority, migration-only compatibility, conflict resolution, and cutover boundaries passed.');
