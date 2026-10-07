import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditGovernance } from './source-integration-governance-audit.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evara-governance-'));
  fs.cpSync('.github/workflows', path.join(root, '.github/workflows'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function change(root, name, transform) {
  const file = path.join(root, '.github/workflows', name);
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
}
test('all current workflows preserve reviewed integration', (t) => {
  assert.deepEqual(auditGovernance(fixture(t)).errors, []);
});
test('rejects a new direct source writer and source write permissions', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.github/workflows/new-writer.yml'), 'permissions:\n  contents: write\njobs:\n  mutate:\n    steps:\n      - run: git push origin HEAD:evaraos\n');
  assert.equal(auditGovernance(root).errors.filter(e => e.startsWith('new-writer.yml')).length, 2);
});
test('rejects reactivating a retired migration', (t) => {
  const root = fixture(t);
  change(root, 'patch-messaging-firestore-rules.yml', text => text.replace('if: ${{ false }}', 'if: ${{ true }}'));
  assert.ok(auditGovernance(root).errors.some(e => e.includes('historical source writer')));
});
test('rejects losing evidence or allowing the gate to skip changed paths', (t) => {
  const root = fixture(t);
  change(root, 'firebase-production-release.yml', text => text.replaceAll('actions/upload-artifact@v4', 'actions/checkout@v4'));
  change(root, 'canonical-pr-gate.yml', text => text.replace('  pull_request:', '  pull_request:\n    paths: [docs/**]'));
  const errors = auditGovernance(root).errors;
  assert.ok(errors.some(e => e.includes('evidence artifact')));
  assert.ok(errors.some(e => e.includes('every canonical PR')));
});
test('rejects validating only a PR head rather than the integrated candidate', (t) => {
  const root = fixture(t);
  change(root, 'canonical-pr-gate.yml', text => text.replace('ref: ${{ github.sha }}', 'ref: ${{ github.event.pull_request.head.sha }}'));
  assert.ok(auditGovernance(root).errors.some(e => e.includes('integration commit')));
});
