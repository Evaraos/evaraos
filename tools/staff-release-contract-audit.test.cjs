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
