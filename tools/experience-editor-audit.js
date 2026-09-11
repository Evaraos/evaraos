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
check(page.includes('/assets/js/studio/experience-editor.js?v=2')
  && page.includes('/assets/css/pages/studio-experience-editor.css?v=2'),
  'Experience editor v2 is wired through the canonical website builder');

check(editor.includes("EXPERIENCE_EDITOR_VERSION = 'experience-editor-v2'"),
  'editor declares one canonical v2 implementation');
check(editor.includes("import { functions, httpsCallable } from '../firebase.js';"),
  'editor reuses only the canonical Firebase callable runtime');
check(!/getSavedUserProfile|getSavedUserRole|normalizeRole|OWNER_ROLES/.test(editor),
  'editor does not trust cached browser roles or profiles');
check(editor.includes("httpsCallable(functions, 'getExperienceEditorState')")
  && editor.includes("httpsCallable(functions, 'saveExperienceDraft')")
  && editor.includes("httpsCallable(functions, 'publishExperienceConfig')")
  && editor.includes("httpsCallable(functions, 'rollbackExperienceConfig')")
  && editor.includes("httpsCallable(functions, 'uploadExperienceAsset')"),
  'editor uses the complete trusted Experience callable surface');
check(editor.includes('const result = await invoke(callable.getState);')
  && editor.includes('applyTrustedState(result);')
  && editor.includes('mount();'),
  'trusted editor state authorizes the UI before controls mount');
check(editor.includes("dataset.evaraExperienceEditorAuthority = 'verified'")
  && editor.includes("dataset.evaraExperienceEditorAuthority = 'denied'"),
  'editor exposes a fail-closed authority state for diagnostics');
check(editor.includes("EXPERIENCE_DELIVERY === 'hosting'") && editor.includes("dataset.evaraExperienceEditorAuthority = 'unavailable'"),
  'static delivery explicitly pauses the online editor without granting authority');

check(editor.includes('expectedDraftRevision: state.draftRevision'),
  'draft saves send the exact loaded draft revision');
check(editor.includes('expectedDraftRevision: Number(saved.draftRevision)'),
  'publication sends the exact saved draft revision');
check(editor.includes('expectedPublishedVersion: state.publishedVersion'),
  'rollback sends the exact loaded published version');

check(editor.includes("ALLOWED_ASSET_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])")
  && editor.includes('MAX_ASSET_BYTES = 2 * 1024 * 1024'),
  'asset selection is limited to approved image types and two megabytes');
check(editor.includes("url.hostname !== 'firebasestorage.googleapis.com'")
  && editor.includes("expectedPrefix = '/v0/b/evaraos-web.firebasestorage.app/o/'")
  && editor.includes("url.searchParams.get('alt') !== 'media'"),
  'local preview accepts only canonical Experience asset origins');
check(editor.includes("field('Visible logo URL', 'markUrl'")
  && editor.includes("field('App icon URL', 'appIconUrl'")
  && editor.includes("field('Background', 'background'")
  && editor.includes("field('Card radius', 'radius'")
  && editor.includes("field('Logo size', 'markSize'")
  && editor.includes("field('Enabled', 'welcomeEnabled'")
  && editor.includes("field('Enabled', 'pageEnabled'")
  && editor.includes("field('Enabled', 'resumeEnabled'"),
  'editor exposes the normalized brand and loader controls without a second runtime');

check(!/\b(getFirestore|doc|collection|setDoc|addDoc|updateDoc|deleteDoc)\b/.test(editor),
  'editor performs no direct Firestore reads or writes');
check(!editor.includes('fetch('),
  'editor cannot bypass callable authority with direct HTTP requests');
check(!editor.includes('localStorage'),
  'editor does not create a second draft persistence authority');
check(!editor.includes('MutationObserver'),
  'editor does not mount through a broad DOM observer');
check(!editor.includes('innerHTML') && !editor.includes('insertAdjacentHTML') && !editor.includes('eval('),
  'editor does not inject arbitrary HTML or executable code');
check((editor.match(/window\.EvaraExperience\?\.refresh\?\.\(\)/g) || []).length === 2,
  'publish and rollback refresh the canonical public Experience runtime');

check(styles.includes('.experience-editor-drawer')
  && styles.includes('.experience-editor-trigger')
  && styles.includes('.experience-editor-live-preview')
  && styles.includes('.experience-editor-upload')
  && styles.includes('.experience-editor-toggle'),
  'editor styles define the native drawer, trusted asset controls, and local preview');
check(workflow.includes('node --experimental-default-type=module --check public/assets/js/studio/experience-editor.js'),
  'Runtime Shell validates Experience editor syntax');
check(workflow.includes('node tools/experience-editor-audit.js'),
  'Runtime Shell runs the Experience editor architecture audit');

if (failures.length) {
  console.error(`\nExperience editor audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nTrusted Experience editor architecture audit passed.');
