#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const files = {
  core: 'functions/studio-journal-core.js',
  service: 'functions/studio-journal-service.js',
  tests: 'functions/studio-journal-core.test.js',
  index: 'functions/index-stats.js',
  package: 'functions/package.json',
  firebaseConfig: 'firebase.json',
  authority: 'public/assets/js/studio/studio-journal-authority-v2.js',
  idempotency: 'public/assets/js/studio/studio-journal-idempotency-guard.js',
  loader: 'public/assets/js/studio/studio-trusted-journal-loader.js',
  adapter: 'public/assets/js/studio/studio-trusted-journal.js',
  controls: 'public/assets/js/studio/studio-document-controls.js',
  operationJournal: 'public/assets/js/studio/canvas/canvas-operation-journal.js',
  route: 'public/website-builder.html',
  firestoreRules: 'firebase/firestore.rules',
  storageRules: 'firebase/storage.rules',
  canvasTest: 'tests/visual/specs/studio-canvas-session.spec.mjs',
  workflow: '.github/workflows/design-system-visual-qa.yml'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required trusted Studio Journal asset is missing`);
}

function requireMarkers(source, label, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) errors.push(`${label}: missing ${marker}`);
  }
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
  for (const file of [files.core, files.service, files.tests, files.index, files.authority, files.idempotency, files.loader, files.adapter, files.controls, files.operationJournal, files.canvasTest]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  requireMarkers(source.core, 'studio-journal-core.js', [
    "GRAPH_SCHEMA_VERSION = '0.1.0'",
    "OPERATION_PROTOCOL_VERSION = '0.1.0'",
    "OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1'",
    'canEditStudio',
    'canPublishStudio',
    'normalizeTransactionEnvelope',
    'evaluateCommit',
    "kind: 'idempotent'",
    "kind: 'id-conflict'",
    "kind: 'revision-conflict'",
    'assignCanonicalSequence',
    'validateGraphSnapshot',
    'validateReleaseRequest',
    "code: 'unsynchronized-transactions'"
  ]);

  requireMarkers(source.service, 'studio-journal-service.js', [
    'enforceAppCheck: true',
    'resolveCaller',
    'canEditStudio',
    'canPublishStudio',
    'db.runTransaction',
    'transaction.create(txRef',
    "collection('operations')",
    'startSequence',
    'endSequence',
    'preconditionOpts: { ifGenerationMatch: 0 }',
    'studio-journal/',
    'audit_logs',
    'immutable: true',
    "status: 'prepared'"
  ]);
  if (!/unsynchronized Studio transactions block publication/i.test(source.service)) {
    errors.push('studio-journal-service.js: unsynchronized Studio transactions must block publication');
  }

  const endpoints = [
    'openStudioBranch',
    'commitStudioTransaction',
    'getStudioOperationRange',
    'createStudioCheckpoint',
    'restoreStudioCheckpoint',
    'createStudioBranch',
    'closeStudioSession',
    'prepareStudioRelease'
  ];
  for (const endpoint of endpoints) {
    if (!source.service.includes(`exports.${endpoint} = onCall`)) errors.push(`studio-journal-service.js: missing callable ${endpoint}`);
    if (!source.index.includes(`exports.${endpoint} = studioJournal.${endpoint}`)) errors.push(`functions/index-stats.js: missing export ${endpoint}`);
    if (!source.adapter.includes(`'${endpoint}'`)) errors.push(`studio-trusted-journal.js: missing callable binding ${endpoint}`);
  }

  requireMarkers(source.tests, 'studio-journal-core.test.js', [
    'same transaction ID and same content is idempotent',
    'same transaction ID with different content is rejected',
    'two transactions against the same expected revision cannot silently overwrite',
    'canonical sequence assignment',
    'trusted checkpoint snapshots require matching graph identity and revision',
    'release preparation blocks unsynchronized transactions'
  ]);

  const packageJson = JSON.parse(source.package);
  if (packageJson.engines?.node !== '20') errors.push('functions/package.json: trusted Studio Journal runtime must remain on Node 20');
  if (packageJson.main !== 'index-stats.js') errors.push('functions/package.json: callable entrypoint must remain index-stats.js');
  if (!String(packageJson.scripts?.['test:studio-journal'] || '').includes('studio-journal-core.test.js')) errors.push('functions/package.json: test:studio-journal is missing');
  if (!String(packageJson.scripts?.test || '').includes('studio-journal-core.test.js')) errors.push('functions/package.json: default tests must include the trusted Studio Journal suite');
  if (!source.firebaseConfig.includes('"source": "functions"')) errors.push('firebase.json: Functions source must remain functions/');

  requireMarkers(source.authority, 'studio-journal-authority-v2.js', [
    "AUTHORITY_VERSION = 'studio-journal-authority-v2'",
    "DB_NAME = 'evaraos-studio-journal'",
    'sameRequest',
    'sequenceWidth',
    'resequenceGraph',
    'listPendingOperationTransactions',
    'markTransactionState',
    'setDurabilityState',
    'rejectTransaction',
    'recordTrustedCheckpoint',
    'latestTrustedCheckpoint',
    'installRecoveryPlan',
    'authorityReady'
  ]);
  if ((source.authority.match(/indexedDB\.open\(/g) || []).length !== 1) errors.push('studio-journal-authority-v2.js: authority must reuse exactly one canonical IndexedDB database');
  if (/localStorage\.setItem|getFirestore|getStorage|uploadBytes|fetch\(/i.test(source.authority)) errors.push('studio-journal-authority-v2.js: direct compatibility storage or network writes are prohibited');

  requireMarkers(source.idempotency, 'studio-journal-idempotency-guard.js', [
    "GUARD_VERSION = 'studio-journal-idempotency-guard-v1'",
    'semanticOperation',
    'semanticCommand',
    'semanticallyEqual',
    'appendOperationTransaction: guardedAppend',
    'local-idempotency-conflict',
    'transaction-id-reused'
  ]);
  if (/indexedDB|localStorage|firebase|firestore|fetch\(/i.test(source.idempotency)) errors.push('studio-journal-idempotency-guard.js: idempotency must recompute semantics without persistence or network access');

  requireMarkers(source.loader, 'studio-trusted-journal-loader.js', [
    'getToken(appCheck, forceRefresh)',
    "import('./studio-trusted-journal.js?v=1')",
    'app-check-token-confirmed',
    'trusted-journal-loaded',
    'app-check-unavailable',
    'EvaraAppCheckReadiness'
  ]);

  requireMarkers(source.adapter, 'studio-trusted-journal.js', [
    "ADAPTER_NAME = 'trusted-studio-journal'",
    "ADAPTER_VERSION = 'trusted-studio-journal-v2'",
    'branchIdForGraph',
    'commitOne',
    'synchronizeGraph',
    'listPendingOperationTransactions',
    "markTransactionState(record.transactionId, 'syncing'",
    "markTransactionState(record.transactionId, 'server-confirmed'",
    "markTransactionState(record.transactionId, 'conflict'",
    "markTransactionState(record.transactionId, 'offline'",
    "markTransactionState(record.transactionId, 'recovery-required'",
    'createTrustedCheckpoint',
    'restoreTrustedCheckpoint',
    'rejectPendingAndRecover',
    'prepareImmutableRelease',
    'pendingTransactionIds: []',
    'registerServerAdapter'
  ]);
  if (/indexedDB|localStorage|sessionStorage|getFirestore|getStorage|setDoc|addDoc|uploadBytes|fetch\(/.test(source.adapter)) errors.push('studio-trusted-journal.js: trusted client transport must use callables and the canonical Journal only');

  requireMarkers(source.controls, 'studio-document-controls.js', [
    'ensureCanvasSession',
    'prepareTrustedRelease',
    'snapshot.integrityState',
    'canvasWriterState',
    'listPendingOperationTransactions',
    'adapter.syncGraph',
    'adapter.release',
    'rejectPendingAndRecover'
  ]);
  if (!/unsynchronized Canvas transaction/i.test(source.controls)) errors.push('studio-document-controls.js: unsynchronized Canvas transactions must block publication');

  requireMarkers(source.operationJournal, 'canvas-operation-journal.js', [
    'latestTrustedCheckpoint',
    'graphSnapshot',
    'REPLAY_EXCLUDED_STATES',
    "record.durabilityState === 'rejected'",
    'checkpointRevision',
    'trustedCheckpoint'
  ]);

  const routeOrder = [
    '/assets/js/studio/studio-document-model.js?v=2',
    '/assets/js/studio/studio-journal-authority-v2.js?v=1',
    '/assets/js/studio/studio-journal-idempotency-guard.js?v=1',
    '/assets/js/studio/blueprint-operation-adapter.js?v=1',
    '/assets/js/studio/studio-trusted-journal-loader.js?v=1',
    '/assets/js/studio/canvas/canvas-writer-guard.js?v=1',
    '/assets/js/studio/canvas/canvas-session-sandbox.js?v=2'
  ];
  routeOrder.forEach((entry) => {
    if (!source.route.includes(entry)) errors.push(`website-builder.html: missing ${entry}`);
  });
  for (let index = 1; index < routeOrder.length; index += 1) {
    if (source.route.indexOf(routeOrder[index - 1]) >= source.route.indexOf(routeOrder[index])) errors.push('website-builder.html: trusted Journal and Canvas load order is invalid');
  }
  if (/<script[^>]+studio-trusted-journal\.js\?v=1/i.test(source.route)) errors.push('website-builder.html: trusted adapter must not load directly before App Check attestation');

  if (!source.firestoreRules.includes('allow read, write: if false;')) errors.push('firebase/firestore.rules: default direct-client deny rule is missing');
  if (!source.storageRules.includes('allow read, write: if false;')) errors.push('firebase/storage.rules: default direct-client deny rule is missing');
  if (/match \/studio-journal|match \/studio_projects/.test(source.firestoreRules + source.storageRules)) errors.push('Firebase rules: trusted Studio Journal paths must not be directly client-accessible');

  requireMarkers(source.canvasTest, 'studio-canvas-session.spec.mjs', [
    'local transaction IDs are idempotent and conflicting reuse fails closed',
    'trusted synchronization checkpoint and immutable release are server confirmed',
    'corrupted Canvas transaction fails closed with recovery-required',
    'graph-head mismatch fails closed and requires refresh',
    'canvas-local-idempotency.json',
    'canvas-trusted-release.json'
  ]);

  requireMarkers(source.workflow, 'design-system-visual-qa.yml', [
    "- 'functions/**'",
    'node tools/studio-app-check-audit.js',
    'node tools/studio-trusted-journal-audit.js',
    'node tools/studio-production-authority-audit.js',
    'npm run test:studio-journal'
  ]);
}

console.log(`EvaraOS trusted Studio Journal audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Trusted callables, atomic branch commits, canonical sequences, local idempotency, App Check-gated transport, checkpoints, recovery, and immutable release gates passed.');
