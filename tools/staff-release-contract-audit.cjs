'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const workflow = read('.github/workflows/firebase-production-release.yml');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
const steps = workflow.split(/(?=      - name: )/);
const scopes = {
  'staff-functions': 'functions:reviewStaffApplication,functions:updateStaffOnboardingTask',
  'firestore-indexes': 'firestore:indexes',
  'firestore-rules': 'firestore:rules'
};
// Fail closed: every deployment step must have an exact equality scope guard.
// Thus a future unguarded or OR-guarded broad deployment cannot run alongside these scopes.
for (const step of steps.filter(step => /run:[\s\S]*firebase deploy/.test(step))) {
  const guard = step.match(/^        if: inputs.release_scope == '([^']+)'\s*$/m);
  check(guard, 'Every deploy command needs a single exact scope guard');
}
for (const [scope, targets] of Object.entries(scopes)) {
  const selected = steps.filter(step => step.includes(`if: inputs.release_scope == '${scope}'`) && step.includes('firebase deploy'));
  check(selected.length === 1, `${scope}: exactly one deployment step`);
  check(selected[0].match(/^        run: (.+)$/m)?.[1] === `firebase deploy --only ${targets} --project evaraos-web --non-interactive`, `${scope}: exact project and deployment targets`);
  check(selected[0].includes('GOOGLE_APPLICATION_CREDENTIALS: ${{ runner.temp }}/firebase-service-account.json'), `${scope}: production credential path`);
  check(workflow.includes(`          - ${scope}\n`), `${scope}: dispatch option`);
}
for (const marker of [
  'DEPLOY EVARAOS PRODUCTION',
  '"${{ inputs.confirmation }}" != "DEPLOY EVARAOS PRODUCTION"',
  '"${{ inputs.release_ref }}" =~ ^[0-9a-f]{40}$',
  'ref: ${{ inputs.release_ref }}',
  'test "$VALIDATED_SHA" = "${{ inputs.release_ref }}"',
  'ref: ${{ needs.validate.outputs.validated_sha }}',
  'run: test "$(git rev-parse HEAD)" = "${{ needs.validate.outputs.validated_sha }}"',
  'needs: validate', 'environment: production',
  'secrets.FIREBASE_SERVICE_ACCOUNT_EVARAOS_WEB'
]) check(workflow.includes(marker), `Preserve release gate: ${marker}`);
for (const name of ['Install Functions dependencies', 'Verify Firebase Functions inventory access']) {
  for (const step of steps.filter(step => step.startsWith(`      - name: ${name}\n`))) {
    check(step.includes("inputs.release_scope == 'staff-functions'"), `${name}: staff scope included`);
  }
}
const entry = read('functions/index-stats.js');
for (const [name, module] of [['reviewStaffApplication', 'staff-approval'], ['updateStaffOnboardingTask', 'staff-onboarding']]) {
  check(entry.includes(`exports.${name} = require("./${module}").${name}`), `Export ${name}`);
  check(/enforceAppCheck:\s*true/.test(read(`functions/${module}.js`)), `${name}: App Check enforcement`);
}
const client = read('public/assets/js/firebase.js');
check(client.includes('new ReCaptchaEnterpriseProvider('), 'Enterprise provider');
check(client.includes('isTokenAutoRefreshEnabled: true'), 'Token auto refresh');
check(client.indexOf('appCheck = initializeAppCheck(') >= 0 && client.indexOf('appCheck = initializeAppCheck(') < client.indexOf('export const functions = getFunctions('), 'App Check initialization precedes Functions client');
check(workflow.includes("firestoreRules: ['firestore-rules', 'firestore', 'backend', 'all']"), 'Rules evidence');
check(workflow.includes("firestoreIndexes: ['firestore-indexes', 'firestore', 'backend', 'all']"), 'Indexes evidence');
const inventorySteps = steps.filter(step => step.startsWith('      - name: Verify staff callable inventory\n'));
check(inventorySteps.length === 1, 'Exactly one staff post-deploy inventory gate');
const inventoryStep = inventorySteps[0];
check(/^        if: inputs.release_scope == 'staff-functions'$/m.test(inventoryStep), 'Inventory is staff-only');
check(!inventoryStep.includes('continue-on-error') && !inventoryStep.includes('||') && inventoryStep.includes('set -euo pipefail'), 'Inventory failure blocks evidence');
check(inventoryStep.includes('GOOGLE_APPLICATION_CREDENTIALS: ${{ runner.temp }}/firebase-service-account.json'), 'Inventory uses production deployment credential');
check(inventoryStep.includes('firebase functions:list --project evaraos-web --json > "$RUNNER_TEMP/staff-functions-list.json"'), 'Inventory queries actual project');
check(inventoryStep.includes('node tools/staff-functions-inventory.cjs "$RUNNER_TEMP/staff-functions-list.json"'), 'Inventory is parsed and validated');
check(workflow.indexOf('      - name: Deploy staff Functions only') < workflow.indexOf('      - name: Verify staff callable inventory') && workflow.indexOf('      - name: Verify staff callable inventory') < workflow.indexOf('      - name: Record complete release proof'), 'Inventory follows deployment and precedes confirmed evidence');
console.log(`Staff release contract: ${checks} checks passed; 0 failed. Source checks do not prove live App Check tokens or IAM.`);
