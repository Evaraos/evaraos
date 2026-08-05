#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function check(condition, message) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    console.error(`FAIL: ${message}`);
    failures.push(message);
  }
}

const page = read('public/website-builder.html');
const editor = read('public/assets/js/studio/experience-editor.js');
const styles = read('public/assets/css/pages/studio-experience-editor.css');
const workflow = read('.github/workflows/runtime-shell-validation.yml');

check((page.match(/\/assets\/js\/studio\/experience-editor\.js/g) || []).length === 1,
  'canonical Studio loads exactly one Experience editor module');
check((page.match(/\/assets\/css\/pages\/studio-experience-editor\.css/g) || []).length === 1,
  'canonical Studio loads exactly one Experience editor stylesheet');
check(page.includes('/assets/js/studio/experience-editor.js?v=1')
  && page.includes('/assets/css/pages/studio-experience-editor.css?v=1'),
  'Experience editor is wired through the canonical website builder');
check(editor.includes("from '../firebase.js'"),
  'editor reuses the canonical Firebase and App Check runtime');
check(editor.includes("OWNER_ROLES = new Set(['owner', 'platform_admin'])"),
  'editor controls are limited to global owner authority');
check(editor.includes("httpsCallable(functions, 'getExperienceEditorState')")
  && editor.includes("httpsCallable(functions, 'saveExperienceDraft')")
  && editor.includes("httpsCallable(functions, 'publishExperienceConfig')")
  && editor.includes("httpsCallable(functions, 'rollbackExperienceConfig')"),
  'editor uses only the trusted Experience callables');
check(editor.includes('expectedDraftRevision: state.draftRevision'),
  'draft saves send the exact loaded draft revision');
check(editor.includes('expectedDraftRevision: Number(saved.draftRevision)'),
  'publication sends the exact saved draft revision');
check(editor.includes('expectedPublishedVersion: state.publishedVersion'),
  'rollback sends the exact loaded published version');
check(!/\b(getFirestore|doc|collection|setDoc|addDoc|updateDoc|deleteDoc)\b/.test(editor),
  'editor performs no direct Firestore reads or writes');
check(!editor.includes('fetch('),
  'editor cannot bypass callable authority with direct HTTP requests');
check(!editor.includes('localStorage'),
  'editor does not create a second draft persistence authority');
check(!editor.includes('innerHTML') && !editor.includes('insertAdjacentHTML') && !editor.includes('eval('),
  'editor does not inject arbitrary HTML or executable code');
check((editor.match(/window\.EvaraExperience\?\.refresh\?\.\(\)/g) || []).length === 2,
  'publish and rollback refresh the canonical public Experience runtime');
check(styles.includes('.experience-editor-drawer')
  && styles.includes('.experience-editor-trigger'),
  'editor styles define the native Studio drawer and trigger');
check(workflow.includes('node --experimental-default-type=module --check public/assets/js/studio/experience-editor.js'),
  'Runtime Shell validates Experience editor syntax');
check(workflow.includes('node tools/experience-editor-audit.js'),
  'Runtime Shell runs the Experience editor architecture audit');

if (failures.length) {
  console.error(`\nExperience editor audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nExperience editor architecture audit passed.');
