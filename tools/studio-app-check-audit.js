#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  firebase: 'public/assets/js/firebase.js',
  loader: 'public/assets/js/studio/studio-trusted-journal-loader.js',
  trusted: 'public/assets/js/studio/studio-trusted-journal.js',
  authority: 'public/assets/js/studio/studio-production-authority.js',
  route: 'public/website-builder.html',
  canvasTest: 'tests/visual/specs/studio-canvas-session.spec.mjs',
  workflow: '.github/workflows/design-system-visual-qa.yml'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required App Check integration asset is missing`);
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

  for (const file of [files.firebase, files.loader, files.trusted, files.authority, files.canvasTest]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  for (const marker of [
    'initializeAppCheck',
    'ReCaptchaEnterpriseProvider',
    'firebase-app-check.js',
    'const appCheckSiteKey =',
    'new ReCaptchaEnterpriseProvider(appCheckSiteKey)',
    'isTokenAutoRefreshEnabled: true',
    'const RUNTIME_KEY = "__EVARAOS_FIREBASE_RUNTIME_V2__"',
    'export let appCheck = runtime.appCheck',
    'appCheck = initializeAppCheck(app',
    'runtime.appCheck = appCheck'
  ]) {
    if (!source.firebase.includes(marker)) errors.push(`firebase.js: missing ${marker}`);
  }

  const sdkVersion = source.firebase.match(/firebasejs\/(\d+\.\d+\.\d+)\/firebase-app-check\.js/)?.[1] || '';
  if (!sdkVersion) errors.push('firebase.js: App Check SDK version could not be resolved');
  const loaderVersion = source.loader.match(/firebasejs\/(\d+\.\d+\.\d+)\/firebase-app-check\.js/)?.[1] || '';
  if (!loaderVersion) errors.push('studio-trusted-journal-loader.js: App Check SDK version could not be resolved');
  if (sdkVersion && loaderVersion && sdkVersion !== loaderVersion) {
    errors.push(`App Check SDK version mismatch: firebase.js=${sdkVersion}, loader=${loaderVersion}`);
  }

  const siteKey = source.firebase.match(/const appCheckSiteKey\s*=\s*["']([^"']+)["']/)?.[1] || '';
  if (!siteKey || siteKey.length < 20) errors.push('firebase.js: reCAPTCHA Enterprise site key is missing or malformed');
  if (/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*["'][^"']+["']/.test(source.firebase)) {
    errors.push('firebase.js: a fixed App Check debug token must never be committed');
  }
  if (!source.firebase.includes('host === "localhost"') || !source.firebase.includes('host === "127.0.0.1"')) {
    errors.push('firebase.js: App Check debug-token lookup must remain localhost-only');
  }

  for (const marker of [
    "LOADER_VERSION = 'trusted-studio-journal-loader-v1'",
    'TOKEN_TIMEOUT_MS',
    'getToken(appCheck, forceRefresh)',
    "import('./studio-trusted-journal.js?v=1')",
    'app-check-token-confirmed',
    'app-check-unavailable',
    'trusted-journal-loaded',
    'window.EvaraAppCheckReadiness',
    'retry: () => loadTrustedJournal({ forceRefresh: true })',
    'appCheckInitialized: Boolean(appCheck)'
  ]) {
    if (!source.loader.includes(marker)) errors.push(`studio-trusted-journal-loader.js: missing ${marker}`);
  }

  for (const prohibited of [
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'console.log',
    'result.token',
    'token:'
  ]) {
    if (source.loader.includes(prohibited)) errors.push(`studio-trusted-journal-loader.js: prohibited token exposure or storage marker ${prohibited}`);
  }

  const loaderImport = '/assets/js/studio/studio-trusted-journal-loader.js?v=1';
  const trustedImport = '/assets/js/studio/studio-trusted-journal.js?v=1';
  const firebaseImport = '/assets/js/firebase.js?v=36';
  const blueprintImport = '/assets/js/studio/blueprint-operation-adapter.js?v=1';
  const writerGuardImport = '/assets/js/studio/canvas/canvas-writer-guard.js?v=1';
  if (!source.route.includes(loaderImport)) errors.push('website-builder.html: App Check trusted-Journal loader is missing');
  if (!source.route.includes(`Dynamic import contract enforced by App Check loader: ${trustedImport}`)) {
    errors.push('website-builder.html: dynamic trusted adapter contract marker is missing');
  }
  const directTrustedScript = new RegExp(`<script[^>]+src=["']${trustedImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
  if (directTrustedScript.test(source.route)) {
    errors.push('website-builder.html: trusted adapter must not load directly before App Check attestation');
  }
  if (!(source.route.indexOf(firebaseImport) < source.route.indexOf(blueprintImport)
    && source.route.indexOf(blueprintImport) < source.route.indexOf(loaderImport)
    && source.route.indexOf(loaderImport) < source.route.indexOf(writerGuardImport))) {
    errors.push('website-builder.html: Firebase, Blueprint, App Check loader, and Canvas writer load order is invalid');
  }

  if (!source.trusted.includes("ADAPTER_NAME = 'trusted-studio-journal'")) {
    errors.push('studio-trusted-journal.js: trusted adapter registration contract is missing');
  }
  if (!source.authority.includes('if (!adapter || adapter.productionAuthorityVersion) return;')) {
    errors.push('studio-production-authority.js: production authority must tolerate an App Check-blocked adapter');
  }
  if (!source.authority.includes("window.addEventListener('evara:app-check-status'")) {
    errors.push('studio-production-authority.js: late App Check readiness must rebind the Canvas release guard');
  }
  if (!source.authority.includes('trustedAdapterGuarded')) {
    errors.push('studio-production-authority.js: trusted release-guard status must be observable');
  }
  if (!source.authority.includes('Publishing requires the trusted server journal and release service.')
    && !source.authority.includes('Trusted synchronization is unavailable.')) {
    errors.push('studio-production-authority.js: unavailable trusted transport must remain fail-closed');
  }

  for (const marker of [
    'EVARA_QA_APP_CHECK_DEBUG_TOKEN',
    'page.addInitScript',
    'self.FIREBASE_APPCHECK_DEBUG_TOKEN = token',
    "window.EvaraAppCheckReadiness?.snapshot?.().state === 'ready'",
    'window.EvaraTrustedStudioJournal?.snapshot',
    "test.skip(Boolean(process.env.CI) && !appCheckDebugToken",
    'canvas-trusted-release.json'
  ]) {
    if (!source.canvasTest.includes(marker)) errors.push(`studio-canvas-session.spec.mjs: missing secure App Check QA contract ${marker}`);
  }
  if (/localStorage\.setItem\([^)]*APP_CHECK|console\.(log|warn|error)\([^)]*appCheckDebugToken|testInfo\.attach\([^)]*appCheckDebugToken/i.test(source.canvasTest)) {
    errors.push('studio-canvas-session.spec.mjs: App Check debug token must not be stored, logged, or attached');
  }
  if (/new Function|eval\(/.test(source.canvasTest)) {
    errors.push('studio-canvas-session.spec.mjs: dynamic code execution is prohibited');
  }

  for (const marker of [
    'EVARA_QA_APP_CHECK_DEBUG_TOKEN: ${{ secrets.EVARA_QA_APP_CHECK_DEBUG_TOKEN }}',
    '-z "$EVARA_QA_APP_CHECK_DEBUG_TOKEN"',
    'encrypted repository secrets',
    'Run Studio App Check audit',
    'node tools/studio-app-check-audit.js'
  ]) {
    if (!source.workflow.includes(marker)) errors.push(`design-system-visual-qa.yml: missing App Check CI contract ${marker}`);
  }
}

console.log(`EvaraOS Studio App Check audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('reCAPTCHA Enterprise initialization, singleton App Check reuse, token auto-refresh, attestation-before-import, encrypted CI debug-token bootstrap, no token exposure, and fail-closed trusted transport passed.');
