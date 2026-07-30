#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = {
  indexes: 'firestore.indexes.json',
  rules: 'firebase/firestore.rules',
  client: 'public/assets/js/messages.js',
  photo: 'public/assets/js/messages-group-photo.js',
  callable: 'functions/messaging-registry.js',
  core: 'functions/messaging-registry-core.js',
  tests: 'functions/messaging-registry-core.test.js'
};

const source = {};
const errors = [];

for (const [key, relative] of Object.entries(files)) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    errors.push(`${relative}: required messaging registry asset is missing`);
    continue;
  }
  source[key] = fs.readFileSync(absolute, 'utf8');
}

function requireMarker(key, marker, message) {
  if (!source[key]?.includes(marker)) errors.push(`${files[key]}: ${message}`);
}

function rejectMarker(key, marker, message) {
  if (source[key]?.includes(marker)) errors.push(`${files[key]}: ${message}`);
}

try {
  const indexes = JSON.parse(source.indexes || '{}').indexes || [];
  const signatures = new Set(indexes
    .filter((index) => index.collectionGroup === 'messages' && index.queryScope === 'COLLECTION')
    .map((index) => (index.fields || [])
      .map((field) => `${field.fieldPath}:${field.arrayConfig || field.order}`)
      .join('|')));
  [
    'kind:ASCENDING|companyId:ASCENDING|memberUids:CONTAINS',
    'kind:ASCENDING|companyId:ASCENDING|adminUids:CONTAINS',
    'kind:ASCENDING|companyId:ASCENDING|allowedRoles:CONTAINS'
  ].forEach((signature) => {
    if (!signatures.has(signature)) errors.push(`${files.indexes}: required registry query index is missing (${signature})`);
  });
} catch (error) {
  errors.push(`${files.indexes}: cannot parse index configuration (${error.message})`);
}

requireMarker('rules', 'function registryRead(data)', 'registry list authorization must evaluate query results directly');
requireMarker('rules', 'allow read: if registryRead(resource.data);', 'registry list authorization must not recursively read its own document');
requireMarker('rules', "allow read: if channelId != '_group_registry' && conversationMember(channelId);", 'generic channel-message rules must exclude registry metadata documents');
rejectMarker('rules', 'match /channels/_group_registry/messages/{id} { allow read: if conversationMember(id);', 'registry list rules must not recursively resolve the same registry record');

requireMarker('client', 'httpsCallable(functions, "resolveMessageRecipient")', 'recipient discovery must use the tenant-enforcing callable');
requireMarker('client', 'setDoc(doc(db, "channels", REGISTRY, "messages", groupId)', 'conversation registry writes must use groupId as the document ID');
requireMarker('client', 'where("kind", "==", kind)', 'direct and group registry reads must constrain the registry kind');
requireMarker('client', 'where("memberUids", "array-contains", uid)', 'direct and group registry reads must be membership constrained');
requireMarker('client', 'where("kind", "==", "role_meta")', 'role registry reads must constrain the registry kind');
requireMarker('client', 'where("companyId", "==", companyId)', 'role registry reads must include the tenant boundary');
requireMarker('client', 'where("allowedRoles", "array-contains", currentRole())', 'role registry reads must include the caller role');
requireMarker('client', 'if (entry.id !== data.groupId) return;', 'legacy non-canonical registry records must remain hidden from the hardened client');
rejectMarker('client', 'await addDoc(collection(db,"channels",REGISTRY,"messages")', 'random registry document IDs are forbidden');
rejectMarker('client', 'state.conversations = BUILTINS', 'synthetic unregistered role channels are forbidden');

requireMarker('photo', 'const document = doc(db, "channels", REGISTRY, "messages", conversationId);', 'group images must resolve the canonical registry document directly');
requireMarker('photo', 'if (data.groupId !== conversationId) return null;', 'group images must reject mismatched registry identity');
rejectMarker('photo', 'where("groupId", "==", conversationId)', 'legacy groupId queries are forbidden');
rejectMarker('photo', 'addDoc(', 'group-image code must not fabricate registry records');

requireMarker('callable', 'request.data?.dryRun !== false', 'migration must default to dry-run mode');
requireMarker('callable', 'expectedPlanHash !== plan.planHash', 'migration apply must bind to the reviewed plan hash');
requireMarker('callable', 'MIGRATE CANONICAL MESSAGE REGISTRY', 'migration apply must require an explicit confirmation phrase');
requireMarker('callable', 'orderBy(admin.firestore.FieldPath.documentId()).limit(500)', 'migration inventory must paginate deterministically');
requireMarker('callable', 'createWriter.create(', 'migration must create missing canonical targets without overwriting races');
requireMarker('callable', 'await createWriter.close();', 'canonical target creation must finish before any legacy deletion');

const createFinished = source.callable?.indexOf('await createWriter.close();') ?? -1;
const deletionStarts = source.callable?.indexOf('if (deleteLegacy) {') ?? -1;
if (createFinished < 0 || deletionStarts < createFinished) {
  errors.push(`${files.callable}: legacy deletion must happen only after canonical target creation succeeds`);
}

requireMarker('core', 'security_metadata_mismatch', 'migration planning must fail closed on authorization metadata conflicts');
requireMarker('core', 'canonical_id_collision', 'migration planning must fail closed when IDs collide during normalization');
requireMarker('tests', "test('conflicting security metadata fails closed'", 'conflict regression coverage is missing');
requireMarker('tests', "test('different conversation IDs that normalize to one target fail closed'", 'canonical-ID collision regression coverage is missing');
requireMarker('tests', "test('malformed role channels cannot enter a migration plan'", 'malformed role-channel regression coverage is missing');
requireMarker('tests', "test('unscoped direct and group conversations cannot enter a migration plan'", 'unscoped conversation regression coverage is missing');

if (errors.length) {
  console.error('EvaraOS messaging registry contract audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`EvaraOS messaging registry contract audit: ${Object.keys(files).length} required assets checked.`);
console.log('Canonical registry IDs, tenant-scoped discovery, dry-run planning, plan-hash binding, conflict closure, and create-before-delete sequencing passed.');
