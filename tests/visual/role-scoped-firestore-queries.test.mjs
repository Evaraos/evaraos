import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildRoleScopedFilterSpecs, buildRoleScopedQueryRefs } from '../../public/assets/js/role-scoped-firestore-queries.mjs';

const userId = 'qa-user';
const baseProfile = { uid: userId, role: 'technician', companyId: 'qa-company' };

test('canonical and legacy platform roles retain only the rules-authorized collection scope', () => {
  for (const role of ['owner', 'super_admin', 'platform_admin']) {
    assert.deepEqual(buildRoleScopedFilterSpecs({ uid: userId, role }, userId), [null]);
  }
});

test('manager queries are constrained to the verified profile company', () => {
  assert.deepEqual(buildRoleScopedFilterSpecs({ ...baseProfile, role: 'manager' }, userId), [
    ['companyId', '==', 'qa-company']
  ]);
  assert.throws(() => buildRoleScopedFilterSpecs({ uid: userId, role: 'manager' }, userId), /company assignment/);
});

test('customer queries cover only the three Firestore customer ownership fields', () => {
  assert.deepEqual(buildRoleScopedFilterSpecs({ uid: userId, role: 'customer' }, userId), [
    ['customerUid', '==', userId],
    ['customerId', '==', userId],
    ['userId', '==', userId]
  ]);
});

test('assigned-role queries match only the Firestore assignment rule branches', () => {
  assert.deepEqual(buildRoleScopedFilterSpecs(baseProfile, userId), [
    ['assignedToUid', '==', userId],
    ['assignedTo', 'array-contains', userId],
    ['assignedTeamIds', 'array-contains', userId],
    ['assignedRep', '==', userId],
    ['assignedRep', 'array-contains', userId],
    ['staffClaimedBy', '==', userId]
  ]);
});

test('profile mismatch and missing identity fail closed', () => {
  assert.throws(() => buildRoleScopedFilterSpecs({ ...baseProfile, uid: 'someone-else' }, userId), /does not match/);
  assert.throws(() => buildRoleScopedFilterSpecs({ role: 'technician' }, ''), /signed-in user/);
  assert.throws(() => buildRoleScopedFilterSpecs({ uid: userId }, userId), /verified profile/);
});

test('query refs use fixed rule-aligned constraints and never accept caller-selected fields', () => {
  const source = { collection: 'jobs' };
  const where = (...args) => ({ type: 'where', args });
  const query = (ref, constraint) => ({ ref, constraint });
  const refs = buildRoleScopedQueryRefs(source, baseProfile, userId, { where, query });
  assert.equal(refs.length, 6);
  assert.deepEqual(refs[0], {
    ref: source,
    constraint: { type: 'where', args: ['assignedToUid', '==', userId] }
  });
  assert.throws(() => buildRoleScopedQueryRefs(source, baseProfile, userId, {}), /Firestore query helpers/);
});

test('role pages use scoped reads and the deployed read rules remain unchanged', () => {
  for (const path of [
    'public/assets/js/dispatch.js',
    'public/assets/js/field.js',
    'public/assets/js/jobs.js',
    'public/assets/js/leads.js'
  ]) {
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /firestore-role-scoped-collections\.js/);
    assert.doesNotMatch(source, /getDocs\(\s*collection\(db,\s*["'](?:jobs|leads)["']\s*\)/);
    assert.doesNotMatch(source, /onSnapshot\(\s*collection\(db,\s*["'](?:jobs|leads)["']\s*\)/);
  }
  const rules = fs.readFileSync('firebase/firestore.rules', 'utf8');
  assert.match(rules, /function assigned\(data\)/);
  assert.match(rules, /match \/leads\/\{id\} \{ allow read: if platform\(\) \|\| customerOwns\(resource\.data\) \|\| assigned\(resource\.data\)/);
  assert.match(rules, /match \/jobs\/\{id\} \{ allow read: if platform\(\) \|\| customerOwns\(resource\.data\) \|\| assigned\(resource\.data\)/);
});

test('messaging and payout screens have unique IDs and cleanup is reentrancy-safe', () => {
  for (const path of ['public/customer-messaging.html', 'public/marketplace-payouts.html']) {
    const source = fs.readFileSync(path, 'utf8');
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length, new Set(ids).size, `${path} has unique document IDs`);
  }
  const runtime = fs.readFileSync('public/assets/js/dashboard-runtime.js', 'utf8');
  assert.match(runtime, /runtime\.status === 'stopping' \|\| runtime\.status === 'stopped'/);
});

test('the UI matrix stubs only the read-only customer snapshot in demo-emulator mode', () => {
  const spec = fs.readFileSync('tests/visual/specs/authenticated-visual.spec.mjs', 'utf8');
  assert.match(spec, /EVARA_QA_LOCAL_EMULATOR_CHILD === '1'/);
  assert.match(spec, /page\.route\(\(url\) => url\.origin === 'http:\/\/127\.0\.0\.1:5001'[\s\S]*?url\.pathname === '\/demo-evaraos-ui\/us-central1\/getMarketplaceCommerceSnapshot'/);
  assert.match(spec, /quotes: \[\],\s*invoices: \[\],\s*subscriptions: \[\]/);
});
