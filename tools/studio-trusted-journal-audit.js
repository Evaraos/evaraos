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
  serviceTest: 'functions/studio-journal-core.test.js',
  functionIndex: 'functions/index-stats.js',
  package: 'functions/package.json',
  firebaseConfig: 'firebase.json',
  localJournal: 'public/assets/js/studio/studio-document-model.js',
  authority: 'public/assets/js/studio/studio-journal-authority-v2.js',
  idempotencyGuard: 'public/assets/js/studio/studio-journal-idempotency-guard.js',
  trustedAdapter: 'public/assets/js/studio/studio-trusted-journal.js',
  controls: 'public/assets/js/studio/studio-document-controls.js',
  operationJournal: 'public/assets/js/studio/canvas/canvas-operation-journal.js',
  canvasTest: 'tests/visual/specs/studio-canvas-session.spec.mjs',
  route: 'public/website-builder.html',
  firestoreRules: 'firebase/firestore.rules',
  storageRules: 'firebase/storage.rules',
  workflow: '.github/workflows/design-system-visual-qa.yml'
};

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`${file}: required trusted Studio Journal asset is missing`);
}

if (!errors.length) {
  const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

  for (const file of [
    files.core,
    files.service,
    files.serviceTest,
    files.functionIndex,
    files.authority,
    files.idempotencyGuard,
    files.trustedAdapter,
    files.controls,
    files.operationJournal,
    files.canvasTest
  ]) {
    try {
      execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`${file}: JavaScript syntax check failed: ${String(error.stderr || error.message).trim()}`);
    }
  }

  for (const marker of [
    "GRAPH_SCHEMA_VERSION = '0.1.0'",
    "OPERATION_PROTOCOL_VERSION = '0.1.0'",
    "OPERATION_ENVELOPE_VERSION = 'studio-journal-operation-envelope-v1'",
    'canEditStudio',
    'canPublishStudio',
    'normalizeTransactionEnvelope',
    'requestHash',
    'evaluateCommit',
    "kind: 'idempotent'",
    "kind: 'id-conflict'",
    "kind: 'revision-conflict'",
    'assignCanonicalSequence',
    'validateGraphSnapshot',
    'validateReleaseRequest',
    "code: 'unsynchronized-transactions'"
  ]) {
    if (!source.core.includes(marker)) errors.push(`studio-journal-core.js: missing ${marker}`);
  }

  for (const marker of [
    "enforceAppCheck: true",
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
    'unsynchronized Studio transactions block publication',
    'immutable: true',
    "status: 'prepared'"
  ]) {
    if (!source.service.includes(marker)) errors.push(`studio-journal-service.js: missing ${marker}`);
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
  endpoints.forEach((endpoint) => {
    if (!source.service.includes(`exports.${endpoint} = onCall`)) errors.push(`studio-journal-service.js: missing callable ${endpoint}`);
    if (!source.functionIndex.includes(`exports.${endpoint} = studioJournal.${endpoint}`)) errors.push(`functions/index-stats.js: missing export ${endpoint}`);
    if (!source.trustedAdapter.includes(`'${endpoint}'`)) errors.push(`studio-trusted-journal.js: missing callable binding ${endpoint}`);
  });

  for (const marker of [
    'same transaction ID and same content is idempotent',
    'same transaction ID with different content is rejected',
    'two transactions against the same expected revision cannot silently overwrite',
    'canonical sequence assignment',
    'trusted checkpoint snapshots require matching graph identity and revision',
    'release preparation blocks unsynchronized transactions'
  ]) {
    if (!source.serviceTest.includes(marker)) errors.push(`studio-journal-core.test.js: missing ${marker}`);
  }

  const packageJson = JSON.parse(source.package);
  if (packageJson.engines?.node !== '20') errors.push('functions/package.json: trusted Studio Journal runtime must remain on Node 20');
  if (packageJson.main !== 'index-stats.js') errors.push('functions/package.json: deployed callable entrypoint must remain index-stats.js');
  if (!String(packageJson.scripts?.['test:studio-journal'] || '').includes('studio-journal-core.test.js')) {
    errors.push('functions/package.json: test:studio-journal is missing');
  }
  if (!String(packageJson.scripts?.test || '').includes('studio-journal-core.test.js')) {
    errors.push('functions/package.json: default test command does not include trusted Studio Journal tests');
  }
  if (packageJson.scripts?.deploy !== 'firebase deploy --only functions') {
    errors.push('functions/package.json: functions-only deployment command is missing');
  }
  if (!source.firebaseConfig.includes('"source": "functions"')) errors.push('firebase.json: Functions source must remain functions/');

  for (const marker of [
    "AUTHORITY_VERSION = 'studio-journal-authority-v2'",
    "DB_NAME = 'evaraos-studio-journal'",
    'sameRequest',
    'sequenceWidth',
    'resequenceGraph',
    "'server-confirmed'",
    "'offline'",
    "'conflict'",
    "'recovery-required'",
    'listPendingOperationTransactions',
    'markTransactionState',
    'setDurabilityState',
    'rejectTransaction',
    'recordTrustedCheckpoint',
    'latestTrustedCheckpoint',
    'installRecoveryPlan',
    'authorityReady'
  ]) {
    if (!source.authority.includes(marker)) errors.push(`studio-journal-authority-v2.js: missing ${marker}`);
  }
  if ((source.authority.match(/indexedDB\.open\(/g) || []).length !== 1 || !source.authority.includes("DB_NAME = 'evaraos-studio-journal'")) {
    errors.push('studio-journal-authority-v2.js: authority must reuse exactly the canonical IndexedDB database');
  }
  if (!source.authority.includes('const base = window.EvaraStudioJournal')) {
    errors.push('studio-journal-authority-v2.js: authority must extend the canonical Journal rather than replace it');
  }
  if (/localStorage\.setItem|firebase|firestore|getStorage|uploadBytes|fetch\(/i.test(source.authority)) {
    errors.push('studio-journal-authority-v2.js: direct compatibility storage, Firebase, or network access is prohibited');
  }

  for (const marker of [
    "GUARD_VERSION = 'studio-journal-idempotency-guard-v1'",
    'semanticOperation',
    'semanticCommand',
    'semanticallyEqual',
    'appendOperationTransaction: guardedAppend',
    'local-idempotency-conflict',
    'transaction-id-reused',
    'reused with different content'
  ]) {
    if (!source.idempotencyGuard.includes(marker)) errors.push(`studio-journal-idempotency-guard.js: missing ${marker}`);
  }
  if (/requestHash\s*===|indexedDB|localStorage|firebase|firestore|fetch\(/i.test(source.idempotencyGuard)) {
    errors.push('studio-journal-idempotency-guard.js: public idempotency must recompute semantic content without storage or network access');
  }

  for (const marker of [
    "ADAPTER_NAME = 'trusted-studio-journal'",
    "ADAPTER_VERSION = 'trusted-studio-journal-v2'",
    'onAuthStateChanged',
    'branchIdForGraph',
    "`${branch}--g-${digest(graph)}`",
    'context(record.graphId)',
    'context(graphSnapshot.graphId)',
    'context(graphId)',
    "'graph-id-conflict'",
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
    'Unsynchronized Canvas transactions block publication',
    'pendingTransactionIds: []',
    'registerServerAdapter'
  ]) {
    if (!source.trustedAdapter.includes(marker)) errors.push(`studio-trusted-journal.js: missing ${marker}`);
  }
  if (/indexedDB|localStorage|sessionStorage|getFirestore|getStorage|doc\(|setDoc|addDoc|uploadBytes|fetch\(/.test(source.trustedAdapter)) {
    errors.push('studio-trusted-journal.js: trusted client adapter must use callable contracts and the canonical Journal only');
  }

  for (const marker of [
    'prepareTrustedRelease',
    'integrityState',
    'canvasWriterState',
    'listPendingOperationTransactions',
    'adapter.syncGraph',
    'adapter.release',
    'Trusted checkpoint',
    'trusted-restore',
    'rejectPendingAndRecover',
    'Publishing requires the trusted server journal and release service.'
  ]) {
    if (!source.controls.includes(marker)) errors.push(`studio-document-controls.js: missing ${marker}`);
  }

  for (const marker of [
    'latestTrustedCheckpoint',
    'graphSnapshot',
    'REPLAY_EXCLUDED_STATES',
    "record.durabilityState === 'rejected'",
    'Transaction sequence range must contain exactly',
    'checkpointRevision',
    'trustedCheckpoint'
  ]) {
    if (!source.operationJournal.includes(marker)) errors.push(`canvas-operation-journal.js: missing ${marker}`);
  }

  const modelImport = '/assets/js/studio/studio-document-model.js?v=2';
  const authorityImport = '/assets/js/studio/studio-journal-authority-v2.js?v=1';
  const idempotencyImport = '/assets/js/studio/studio-journal-idempotency-guard.js?v=1';
  const blueprintImport = '/assets/js/studio/blueprint-operation-adapter.js?v=1';
  const trustedImport = '/assets/js/studio/studio-trusted-journal.js?v=1';
  const guardImport = '/assets/js/studio/canvas/canvas-writer-guard.js?v=1';
  const canvasImport = '/assets/js/studio/canvas/canvas-session-sandbox.js?v=2';
  const controlsImport = '/assets/js/studio/studio-document-controls.js?v=3';
  [modelImport, authorityImport, idempotencyImport, blueprintImport, trustedImport, guardImport, canvasImport, controlsImport].forEach((entry) => {
    if (!source.route.includes(entry)) errors.push(`public/website-builder.html: missing ${entry}`);
  });
  if (!(source.route.indexOf(modelImport) < source.route.indexOf(authorityImport)
    && source.route.indexOf(authorityImport) < source.route.indexOf(idempotencyImport)
    && source.route.indexOf(idempotencyImport) < source.route.indexOf(controlsImport)
    && source.route.indexOf(blueprintImport) < source.route.indexOf(trustedImport)
    && source.route.indexOf(trustedImport) < source.route.indexOf(guardImport)
    && source.route.indexOf(guardImport) < source.route.indexOf(canvasImport))) {
    errors.push('public/website-builder.html: trusted Journal authority load order is invalid');
  }
  if (source.route.includes('studio-server-journal-adapter.js')) {
    errors.push('public/website-builder.html: duplicate trusted Journal adapter must not be loaded');
  }

  if (!source.firestoreRules.includes('allow read, write: if false;')) {
    errors.push('firebase/firestore.rules: default direct-client deny rule is missing');
  }
  if (!source.storageRules.includes('allow read, write: if false;')) {
    errors.push('firebase/storage.rules: default direct-client deny rule is missing');
  }
  if (/match \/studio-journal|match \/studio_projects/.test(source.firestoreRules + source.storageRules)) {
    errors.push('Firebase rules: trusted Studio Journal paths must not be directly client-accessible');
  }

  for (const marker of [
    'corruption and graph-head recovery validation',
    'recovery-required',
    'pendingTransactionCount',
    'unsynchronizedChanges',
    'second tab is read-only and takes over after release',
    'local transaction IDs are idempotent and conflicting reuse fails closed',
    'trusted synchronization checkpoint and immutable release are server confirmed',
    'canvas-local-idempotency.json',
    'canvas-trusted-release.json'
  ]) {
    if (!source.canvasTest.includes(marker)) errors.push(`studio-canvas-session.spec.mjs: missing ${marker}`);
  }
  if (/new Function|eval\(/.test(source.canvasTest)) {
    errors.push('studio-canvas-session.spec.mjs: dynamic code execution is prohibited even in QA helpers');
  }

  for (const marker of [
    "- 'functions/**'",
    'node tools/studio-trusted-journal-audit.js',
    'working-directory: functions',
    'npm run test:studio-journal',
    "node-version: '20'"
  ]) {
    if (!source.workflow.includes(marker)) errors.push(`design-system-visual-qa.yml: missing trusted Journal CI contract ${marker}`);
  }
}

console.log(`EvaraOS trusted Studio Journal audit: ${Object.keys(files).length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Trusted graph-scoped branch commits, canonical sequences, recomputed idempotency, conflicts, checkpoints, recovery, synchronization, immutable release gates, Backend tests, and deployment contracts passed.');
