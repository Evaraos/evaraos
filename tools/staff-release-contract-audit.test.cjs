'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'staff-release-contract-audit.cjs'), 'utf8');
function run(mutate = s => s) {
  vm.runInNewContext(source, {
    __dirname,
    console: {log() {}},
    require(name) {
      if (name === 'node:fs') return {readFileSync(file, encoding) {return mutate(fs.readFileSync(file, encoding), file);}};
      return require(name);
    }
  });
}
test('current release contract passes', () => run());
for (const [name, before, after] of [
  ['all Functions broadening', 'functions:reviewStaffApplication,functions:updateStaffOnboardingTask', 'functions'],
  ['unrelated Function', 'functions:reviewStaffApplication,functions:updateStaffOnboardingTask', 'functions:reviewStaffApplication,functions:updateStaffOnboardingTask,functions:openStudioBranch'],
  ['index scope publishes rules', '--only firestore:indexes --project', '--only firestore:indexes,firestore:rules --project'],
  ['rules scope publishes indexes', '--only firestore:rules --project', '--only firestore:rules,firestore:indexes --project'],
  ['scope guard fallthrough', "if: inputs.release_scope == 'storage'", "if: inputs.release_scope == 'storage' || inputs.release_scope == 'staff-functions'"],
  ['SHA checkout removed', 'ref: ${{ inputs.release_ref }}', 'ref: evaraos'],
  ['confirmation removed', '"${{ inputs.confirmation }}" != "DEPLOY EVARAOS PRODUCTION"', 'false'],
  ['App Check enforcement removed', 'enforceAppCheck: true', 'enforceAppCheck: false'],
  ['automatic refresh removed', 'isTokenAutoRefreshEnabled: true', 'isTokenAutoRefreshEnabled: false']
]) test(`rejects ${name}`, () => assert.throws(() => run(s => s.replaceAll(before, after))));

const {verifyStaffInventory} = require('./staff-functions-inventory.cjs');
const inventory = () => ({status: 'success', result: ['reviewStaffApplication', 'updateStaffOnboardingTask'].map(id => ({id, project: 'evaraos-web', region: 'us-central1', runtime: 'nodejs22', state: 'ACTIVE'}))});
test('accepts both exact deployed staff endpoints', () => verifyStaffInventory(inventory()));
test('accepts CLI inventory without optional state', () => {const value=inventory(); value.result.forEach(e=>delete e.state); verifyStaffInventory(value);});
for (const field of ['project', 'region', 'runtime', 'state']) test(`rejects incorrect ${field}`, () => {const value=inventory(); value.result[0][field]='wrong'; assert.throws(()=>verifyStaffInventory(value));});
for (const index of [0, 1]) test(`rejects missing staff endpoint ${index}`, () => {const value=inventory(); value.result.splice(index,1); assert.throws(()=>verifyStaffInventory(value));});
test('rejects substring function name', () => {const value=inventory(); value.result[0].id+='Extra'; assert.throws(()=>verifyStaffInventory(value));});
test('rejects unsuccessful inventory', () => assert.throws(()=>verifyStaffInventory({status:'error',result:[]})));
test('rejects malformed inventory', () => assert.throws(()=>verifyStaffInventory({status:'success',result:{}})));
test('rejects removed post-deploy gate', () => assert.throws(()=>run(s=>s.replace('name: Verify staff callable inventory','name: Removed staff gate'))));
test('rejects ignored inventory failure', () => assert.throws(()=>run(s=>s.replace('name: Verify staff callable inventory','name: Verify staff callable inventory\n        continue-on-error: true'))));
test('rejects bypassed inventory parser', () => assert.throws(()=>run(s=>s.replace('node tools/staff-functions-inventory.cjs','echo tools/staff-functions-inventory.cjs'))));
test('rejects inventory after evidence', () => assert.throws(()=>run(s=>s.replace('name: Verify staff callable inventory','name: Record complete release proof').replace('name: Record complete release proof\n        env:', 'name: Verify staff callable inventory\n        env:'))));
