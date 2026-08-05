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

const core = read('functions/experience-config-core.js');
const service = read('functions/experience-config-service.js');
const entry = read('functions/index.js');
const packageJson = JSON.parse(read('functions/package.json'));
const firebase = JSON.parse(read('firebase.json'));
const workflow = read('.github/workflows/backend-security.yml');

const functions = [
  'getExperienceEditorState',
  'saveExperienceDraft',
  'publishExperienceConfig',
  'uploadExperienceAsset',
  'getPublicExperienceConfig'
];

check(core.includes("GLOBAL_PUBLISHER_ROLES = new Set(['owner', 'platform_admin'])"), 'global authority is limited to owner and platform administrator');
check(core.includes('canPublishGlobalExperience'), 'global publisher authority is centralized in the pure core');
check(!core.includes("permissions.has('studio.publish')"), 'tenant Studio permissions do not grant global Experience authority');
check(core.includes('MAX_CONFIG_BYTES = 700 * 1024'), 'configuration size is bounded below the Firestore document limit');
check(core.includes('detectImageType'), 'uploaded images require signature validation');
check(core.includes("minimumMs: 450"), 'welcome loader defaults preserve the current performance target');
check(core.includes("delayMs: 20"), 'internal loader defaults preserve the current navigation delay');
check(core.includes("enabled: false") && core.includes('minimumAwayMs: 45000'), 'blocking resume presentation is disabled by default');

check(service.includes("enforceAppCheck: true"), 'all editor callables use the App Check callable policy');
check(service.includes('canPublishGlobalExperience(profile)'), 'the backend revalidates global publisher authority');
check(service.includes("db.doc(`users/${uid}`).get()"), 'the backend re-reads the canonical user profile');
check(service.includes("throw new HttpsError('aborted'"), 'draft and publication use optimistic revision conflicts');
check(service.includes("targetCollection: 'experience_configs'"), 'draft, publication, and upload actions create audit evidence');
check(service.includes("data.published || DEFAULT_CONFIG"), 'the public endpoint reads only published configuration');
const publicStart = service.indexOf('exports.getPublicExperienceConfig');
const publicBody = publicStart >= 0 ? service.slice(publicStart) : '';
check(publicStart >= 0 && !publicBody.includes('data.draft'), 'the public endpoint cannot expose draft configuration');
check(service.includes("request.method !== 'GET'"), 'the public endpoint is read-only');
check(service.includes("Cache-Control', 'public,max-age=60,stale-while-revalidate=300"), 'the public endpoint has a bounded efficient cache policy');

check(entry.includes("require('./index-stats')"), 'the modular entrypoint preserves every existing Function export');
check(entry.includes("require('./experience-config-service')"), 'the modular entrypoint loads the trusted Experience service');
check(entry.includes('...existingFunctions') && entry.includes('...experienceFunctions'), 'existing and Experience exports are combined without mutating legacy modules');
functions.forEach((name) => {
  check(service.includes(`exports.${name} =`), `${name} is exported by the trusted Experience service`);
});

const rewrites = firebase.hosting?.rewrites || [];
const endpointIndex = rewrites.findIndex((rewrite) => rewrite.source === '/__experience/config');
const catchAllIndex = rewrites.findIndex((rewrite) => rewrite.source === '**');
check(endpointIndex >= 0, 'Firebase Hosting exposes the same-origin Experience endpoint');
check(catchAllIndex < 0 || endpointIndex < catchAllIndex, 'the Experience endpoint precedes the SPA catch-all rewrite');

check(packageJson.main === 'index.js', 'Firebase Functions uses the modular canonical entrypoint');
check(packageJson.scripts?.['test:experience'] === 'node --test experience-config-core.test.js', 'Functions exposes a focused Experience unit-test script');
check(String(packageJson.scripts?.test || '').includes('experience-config-core.test.js'), 'the default Functions test suite includes Experience tests');
check(workflow.includes('node --check functions/experience-config-core.js'), 'Backend Security Validation checks the Experience core syntax');
check(workflow.includes('node --check functions/experience-config-service.js'), 'Backend Security Validation checks the Experience service syntax');
check(workflow.includes('node --test functions/experience-config-core.test.js'), 'Backend Security Validation runs Experience unit tests');
check(workflow.includes('node tools/experience-backend-audit.js'), 'Backend Security Validation runs the Experience architecture audit');

if (failures.length) {
  console.error(`\nExperience backend audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nExperience backend architecture audit passed.');
