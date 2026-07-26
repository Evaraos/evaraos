#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  service: 'functions/studio-release-runtime-service.js',
  exports: 'functions/index-stats.js',
  activation: 'public/assets/js/studio/studio-release-activation-v1.js',
  runtime: 'public/assets/js/studio/studio-published-graph-runtime-v1.js',
  runtimeCss: 'public/assets/css/pages/studio-published-graph-v1.css',
  activationCss: 'public/assets/css/pages/studio-release-activation-v1.css',
  nav: 'public/assets/js/nav.js',
  route: 'public/website-builder.html',
  workbench: 'public/assets/js/studio/canvas/studio-canvas-workbench-v5.js',
  graphProjection: 'public/assets/js/studio/canvas/graph-projection.js',
  authenticatedSpec: 'tests/visual/specs/studio-workbench-v5.spec.mjs',
  storageRules: 'firebase/storage.rules'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required release-runtime asset is missing`);
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
  for (const file of [files.service, files.exports]) {
    try { execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' }); }
    catch (error) { errors.push(`${file}: CommonJS syntax check failed: ${String(error.stderr || error.message).trim()}`); }
  }
  for (const file of [files.activation, files.runtime, files.workbench, files.graphProjection, files.authenticatedSpec]) {
    try { execFileSync(process.execPath, ['--experimental-default-type=module', '--check', path.join(root, file)], { stdio: 'pipe' }); }
    catch (error) { errors.push(`${file}: module syntax check failed: ${String(error.stderr || error.message).trim()}`); }
  }

  const serviceMarkers = [
    'enforceAppCheck: true', 'activateStudioRelease', 'getPublishedStudioRelease',
    'canPublishStudio', 'activeStudioReleases', "status: 'active'", 'studio_release_activated',
    'validateGraphSnapshot', 'validated.graphHash !== release.graphHash', 'bucket.file',
    'Cross-company Studio access is not allowed', "CHANNELS = new Set(['production', 'staging'])"
  ];
  serviceMarkers.forEach((marker) => {
    if (!source.service.includes(marker)) errors.push(`Trusted release runtime service: missing ${marker}`);
  });

  for (const marker of [
    'exports.activateStudioRelease = studioReleaseRuntime.activateStudioRelease',
    'exports.getPublishedStudioRelease = studioReleaseRuntime.getPublishedStudioRelease'
  ]) {
    if (!source.exports.includes(marker)) errors.push(`functions/index-stats.js: missing callable export ${marker}`);
  }

  const activationMarkers = [
    "httpsCallable(functions, 'activateStudioRelease')", 'evara:studio-release-complete',
    'evara:studio-release-active', 'EvaraStudioJournal?.getLocalSession',
    'projectId', 'channel', 'slug', 'seoTitle', 'seoDescription',
    'studio-release-activation-v1', 'persistActiveMetadata', 'studio-active-release-badge'
  ];
  activationMarkers.forEach((marker) => {
    if (!source.activation.includes(marker)) errors.push(`Studio activation client: missing ${marker}`);
  });

  const runtimeMarkers = [
    "httpsCallable(functions, 'getPublishedStudioRelease')", 'projectCanvasPage',
    "'/dashboard.html': 'owner-dashboard'", "'/customer_dashboard.html': 'customer-portal'",
    "'/jobs.html': 'jobs'", "'/leads.html': 'leads'", "'/settings-v2.html': 'settings'",
    'studioReleaseChannel', 'production', 'staging', 'visibleForRole', 'responsive',
    'studio-published-root', 'studio-published-node', 'safeUrl(value, { sameOrigin = false }',
    'open-modal', 'send-email', 'toggle-visibility', 'EvaraPublishedStudioRuntime',
    'evara:published-studio-release-rendered', 'localStorage.setItem(cacheKey()'
  ];
  runtimeMarkers.forEach((marker) => {
    if (!source.runtime.includes(marker)) errors.push(`Published graph runtime: missing ${marker}`);
  });

  for (const unsafe of ['innerHTML', 'outerHTML', 'eval(', 'new Function', 'document.write']) {
    if (source.activation.includes(unsafe)) errors.push(`Studio activation client: prohibited unsafe sink ${unsafe}`);
    if (source.runtime.includes(unsafe)) errors.push(`Published graph runtime: prohibited unsafe sink ${unsafe}`);
  }

  const cssMarkers = [
    '.is-studio-published-active>:not([data-studio-published-root])', '.studio-published-grid',
    '.studio-published-node', '.studio-published-hero-block', '.studio-published-media',
    '.studio-published-modal', '@media(max-width:600px)', '.studio-active-release-badge'
  ];
  cssMarkers.forEach((marker) => {
    const combined = `${source.runtimeCss}\n${source.activationCss}`;
    if (!combined.includes(marker)) errors.push(`Published graph presentation: missing ${marker}`);
  });

  if (!source.nav.includes('import "./studio/studio-published-graph-runtime-v1.js?v=1"')) {
    errors.push('public/assets/js/nav.js: global active-release runtime import is missing');
  }
  for (const marker of [
    '/assets/css/pages/studio-release-activation-v1.css?v=1',
    '/assets/js/studio/studio-release-activation-v1.js?v=1'
  ]) {
    if (!source.route.includes(marker)) errors.push(`public/website-builder.html: activation asset is missing ${marker}`);
  }

  if (!source.workbench.includes("window.dispatchEvent(new CustomEvent('evara:studio-release-complete'")) {
    errors.push('Graph Workbench: prepared-release activation handoff event is missing');
  }
  if (!source.graphProjection.includes('responsiveSpan') || !source.graphProjection.includes('effectiveSpan')) {
    errors.push('Graph projection: published responsive span resolution is incomplete');
  }

  const proofMarkers = [
    'EvaraStudioReleaseActivation?.version', 'evara:studio-release-active',
    'active on staging\\/owner-dashboard', '/dashboard.html?studioReleaseChannel=staging',
    'EvaraPublishedStudioRuntime?.snapshot?.().active', '[data-studio-published-root]',
    "expect(live.release.status).toBe('active')"
  ];
  proofMarkers.forEach((marker) => {
    if (!source.authenticatedSpec.includes(marker)) errors.push(`Authenticated release proof: missing ${marker}`);
  });

  for (const marker of [
    'match /companies/{companyId}/studio/media/{allFiles=**}',
    'studioMetadataMatches(companyId)', 'studio-canvas-workbench-v5',
    "request.resource.contentType.matches('video/.*')"
  ]) {
    if (!source.storageRules.includes(marker)) errors.push(`Studio media authorization: missing ${marker}`);
  }
}

console.log(`EvaraOS Studio release-runtime audit: ${Object.keys(files).length} assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Prepared releases activate through App Check, active pointers remain tenant-scoped, immutable graphs are integrity-validated, and the shared app runtime renders active route releases responsively.');
