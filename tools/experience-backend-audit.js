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
const tests = read('functions/experience-config-core.test.js');
const service = read('functions/experience-config-service.js');
const accessControl = read('public/assets/js/access-control.js');
const entry = read('functions/index-stats.js');
const packageJson = JSON.parse(read('functions/package.json'));
const firebase = JSON.parse(read('firebase.json'));
const workflow = read('.github/workflows/backend-security.yml');

const functions = [
  'getExperienceEditorState',
  'saveExperienceDraft',
  'publishExperienceConfig',
  'rollbackExperienceConfig',
  'uploadExperienceAsset',
  'getPublicExperienceConfig'
];

check(core.includes("GLOBAL_PUBLISHER_ROLES = new Set(['owner', 'platform_admin'])"), 'global authority is limited to owner and platform administrator');
check(core.includes('canPublishGlobalExperience'), 'global publisher authority is centralized in the pure core');
check(!core.includes("permissions.has('studio.publish')"), 'tenant Studio permissions do not grant global Experience authority');
check(core.includes("const status = cleanText(profile.status, 40).toLowerCase();"), 'Experience lifecycle does not default a missing status to active');
check(core.includes("const approval = cleanText(profile.approvalStatus, 40).toLowerCase();"), 'Experience lifecycle does not default a missing approval to approved');
check(core.includes("return ['active', 'approved'].includes(status) && approval === 'approved';"), 'Experience lifecycle requires active-or-approved status and approved approvalStatus');
check(!core.includes("profile.status || 'active'"), 'missing status cannot fail open');
check(!core.includes("profile.approvalStatus || 'approved'"), 'missing approvalStatus cannot fail open');
check(accessControl.includes("organization_owner: 'vendor'")
  && accessControl.includes("office_owner: 'vendor'")
  && accessControl.includes("branch_owner: 'vendor'"), 'canonical access authority classifies organization, office, and branch owners as vendor aliases');
check(core.includes("if (['organization_owner', 'office_owner', 'branch_owner'].includes(role)) return 'vendor';"), 'Experience role normalization preserves canonical vendor aliases');
check(!core.includes("if (['organization_owner', 'office_owner', 'branch_owner'].includes(role)) return 'owner';"), 'vendor aliases cannot escalate to global owner authority');
check(tests.includes("{ role: 'owner', status: 'active' }")
  && tests.includes("{ role: 'owner', approvalStatus: 'approved' }"), 'unit tests deny profiles with either lifecycle field missing');
check(tests.includes("{ role: 'owner', status: 'pending', approvalStatus: 'approved' }")
  && tests.includes("{ role: 'owner', status: 'active', approvalStatus: 'pending' }"), 'unit tests deny pending lifecycle states');
check(tests.includes("{ role: 'organization_owner', status: 'active', approvalStatus: 'approved' }")
  && tests.includes("{ role: 'office_owner', status: 'active', approvalStatus: 'approved' }")
  && tests.includes("{ role: 'branch_owner', status: 'active', approvalStatus: 'approved' }"), 'unit tests deny vendor aliases global publishing authority');
check(core.includes('MAX_CONFIG_BYTES = 700 * 1024'), 'configuration size is bounded below the Firestore document limit');
check(core.includes('detectImageType'), 'uploaded images require signature validation');
check(core.includes("minimumMs: 450"), 'welcome loader defaults preserve the current performance target');
check(core.includes("delayMs: 20"), 'internal loader defaults preserve the current navigation delay');
check(core.includes("enabled: false") && core.includes('minimumAwayMs: 45000'), 'blocking resume presentation is disabled by default');

check(service.includes("enforceAppCheck: true"), 'all editor callables use the App Check callable policy');
check(service.includes('canPublishGlobalExperience(profile)'), 'the backend revalidates global publisher authority');
check(service.includes("db.doc(`users/${uid}`).get()"), 'the backend re-reads the canonical user profile');
const revisionGuards = service.match(/if \(!Number\.isInteger\(expectedDraftRevision\) \|\| expectedDraftRevision < 0\)/g) || [];
check(revisionGuards.length === 2, 'draft save and publication both require an explicit nonnegative integer revision');
check(!service.includes('expectedDraftRevision !== undefined'), 'draft saves cannot bypass concurrency checks by omitting the expected revision');
check(!service.includes('Number(request.data.expectedDraftRevision)'), 'revision validation does not coerce strings or null into accepted numbers');
check(service.includes('if (expectedDraftRevision !== currentRevision)')
  && service.includes('if (expectedDraftRevision !== draftRevision)'), 'draft save and publication both compare the exact expected revision');
check(service.includes("throw new HttpsError('aborted'"), 'draft, publication, and rollback use optimistic revision conflicts');
check(service.includes('function archivedPublishedState(data = {}, publisher, reason)'), 'published Experience history uses one canonical archive formatter');
check(service.includes("const archive = archivedPublishedState(current, publisher, 'superseded');")
  && service.includes('if (archive) transaction.set(historyRef, archive);'), 'publication archives the previously live configuration in the same transaction');
check(service.includes('exports.rollbackExperienceConfig = onCall(CALLABLE_OPTIONS'), 'rollback remains in the trusted App Check-protected Experience service');
check(service.includes("if (!Number.isInteger(expectedPublishedVersion) || expectedPublishedVersion < 1)"), 'rollback requires an explicit positive published version');
check(service.includes("CONFIG_REF.collection('history').orderBy('archivedAt', 'desc').limit(1).get()"), 'rollback selects only the latest archived publication');
check(service.includes('if (expectedPublishedVersion !== currentVersion)'), 'rollback fails when the live version changed before restoration');
check(service.includes("const currentArchive = archivedPublishedState(current, publisher, 'rollback_replaced');")
  && service.includes('if (currentArchive) transaction.set(currentHistoryRef, currentArchive);'), 'rollback archives the replaced live configuration atomically');
check(service.includes('const publishedVersion = currentVersion + 1;'), 'rollback advances the published version instead of moving backward');
check(service.includes('transaction.delete(restoreRef);'), 'rollback consumes the selected history record to preserve stack ordering');
check(service.includes("auditRecord(publisher, 'experience_config_rolled_back'"), 'rollback writes trusted audit evidence inside the transaction');
check(service.includes("targetCollection: 'experience_configs'"), 'draft, publication, rollback, and upload actions create audit evidence');
check(service.includes("data.published || DEFAULT_CONFIG"), 'the public endpoint reads only published configuration');
const publicStart = service.indexOf('exports.getPublicExperienceConfig');
const publicBody = publicStart >= 0 ? service.slice(publicStart) : '';
check(publicStart >= 0 && !publicBody.includes('data.draft'), 'the public endpoint cannot expose draft configuration');
check(publicStart >= 0 && !publicBody.includes("collection('history')"), 'the public endpoint cannot expose publication history');
check(service.includes("request.method !== 'GET'"), 'the public endpoint is read-only');
check(service.includes("Cache-Control', 'public,max-age=60,stale-while-revalidate=300"), 'the public endpoint has a bounded efficient cache policy');

check(entry.includes("const experienceConfig = require(\"./experience-config-service\")"), 'the canonical Functions entrypoint loads the trusted Experience service');
functions.forEach((name) => {
  check(entry.includes(`exports.${name} = experienceConfig.${name}`), `${name} is exported by the canonical Functions entrypoint`);
});

const rewrites = firebase.hosting?.rewrites || [];
const endpointIndex = rewrites.findIndex((rewrite) => rewrite.source === '/__experience/config');
const catchAllIndex = rewrites.findIndex((rewrite) => rewrite.source === '**');
check(endpointIndex >= 0, 'Firebase Hosting exposes the same-origin Experience endpoint');
check(catchAllIndex < 0 || endpointIndex < catchAllIndex, 'the Experience endpoint precedes the SPA catch-all rewrite');

check(packageJson.main === 'index-stats.js', 'Firebase Functions preserves the canonical index-stats.js entrypoint');
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
