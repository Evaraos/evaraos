#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const files = Object.freeze({
  service: 'functions/studio-release-runtime-service.js',
  exports: 'functions/index-stats.js',
  client: 'public/assets/js/studio/studio-release-runtime-client.js',
  studio: 'public/website-builder.html',
  workflow: '.github/workflows/studio-release-runtime.yml'
});
const failures = [];

function read(file) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    failures.push(`${file}: required trusted release-runtime file is missing`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function requireMarkers(label, source, markers) {
  markers.forEach((marker) => {
    if (!source.includes(marker)) failures.push(`${label}: missing required contract ${marker}`);
  });
}

function forbidMarkers(label, source, markers) {
  markers.forEach((marker) => {
    if (source.includes(marker)) failures.push(`${label}: prohibited authority or sink ${marker}`);
  });
}

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

if (!failures.length) {
  const syntaxChecks = [
    ['functions/studio-release-runtime-service.js', []],
    ['functions/index-stats.js', []],
    ['public/assets/js/studio/studio-release-runtime-client.js', ['--input-type=module']],
    ['tools/studio-release-runtime-audit.js', []]
  ];
  syntaxChecks.forEach(([file, flags]) => {
    try {
      const moduleInput = flags.includes('--input-type=module');
      execFileSync(process.execPath, [...flags, '--check', ...(moduleInput ? [] : [path.join(root, file)])], {
        stdio: 'pipe',
        ...(moduleInput ? { input: fs.readFileSync(path.join(root, file)) } : {})
      });
    } catch (error) {
      failures.push(`${file}: syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  });

  requireMarkers('Trusted release service', source.service, [
    'enforceAppCheck: true',
    'activateStudioRelease',
    'getPublishedStudioRelease',
    'canPublishStudio',
    'canEditStudio',
    'Cross-company Studio access is not allowed.',
    'Only a prepared immutable release can be activated.',
    'An active release cannot be reassigned',
    'studio-journal/${companyId}/${projectId}/releases/${releaseId}.json',
    'activeStudioReleases',
    'studio_release_activated',
    'getMetadata()',
    'MAX_RELEASE_BYTES',
    'validateGraphSnapshot',
    'validated.graphHash !== release.graphHash',
    'The active Studio release object metadata is inconsistent.'
  ]);

  requireMarkers('Functions entrypoint', source.exports, [
    'const studioReleaseRuntime = require("./studio-release-runtime-service")',
    'exports.activateStudioRelease = studioReleaseRuntime.activateStudioRelease',
    'exports.getPublishedStudioRelease = studioReleaseRuntime.getPublishedStudioRelease'
  ]);

  requireMarkers('Trusted release client', source.client, [
    "httpsCallable(functions, 'activateStudioRelease')",
    "httpsCallable(functions, 'getPublishedStudioRelease')",
    'EvaraStudioReleaseRuntime',
    'evara:studio-release-active',
    'evara:studio-published-release-loaded',
    'evara:studio-release-activation-error',
    'evara:studio-published-release-error'
  ]);

  forbidMarkers('Trusted release client', source.client, [
    'getSavedUserProfile',
    'getSavedUserRole',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'MutationObserver',
    'document.',
    'querySelector',
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'eval(',
    'new Function',
    'getDoc',
    'setDoc',
    'updateDoc',
    'addDoc',
    'deleteDoc',
    'getStorage',
    'uploadBytes',
    'deleteObject',
    'addEventListener('
  ]);

  const clientPath = '/assets/js/studio/studio-release-runtime-client.js?v=1';
  const clientCount = source.studio.split(clientPath).length - 1;
  if (clientCount !== 1) {
    failures.push(`public/website-builder.html: trusted release client must be loaded exactly once; found ${clientCount}`);
  }

  requireMarkers('Trusted release workflow', source.workflow, [
    'name: Trusted Studio Release Runtime',
    'node --check functions/studio-release-runtime-service.js',
    'node --experimental-default-type=module --check public/assets/js/studio/studio-release-runtime-client.js',
    'node tools/studio-release-runtime-audit.js'
  ]);
}

console.log(`EvaraOS trusted Studio release-runtime audit: ${Object.keys(files).length} files checked.`);
if (failures.length) {
  console.error(`Errors (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Studio release activation and retrieval remain App Check-protected, tenant-scoped, immutable, integrity-validated, and free of browser-side persistence or publishing authority.');
