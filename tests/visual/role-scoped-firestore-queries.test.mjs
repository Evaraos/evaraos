import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildRoleScopedFilterSpecs, buildRoleScopedQueryRefs, buildRoleScopedReadPlan } from '../../public/assets/js/role-scoped-firestore-queries.mjs';
import { assignedUserIds, groupAssignmentIndexWrites, planAssignmentIndexWrites } from '../../public/assets/js/assignment-index-utils.mjs';
import { canAccessPageName, defaultRouteForRole } from '../../public/assets/js/access-control.js';
import { ROLE_DEFINITIONS } from './visual-matrix.mjs';

const userId = 'qa-user';
const baseProfile = { uid: userId, role: 'technician', companyId: 'qa-company' };

test('vendor navigation stays on authorized operations and excludes protected finance views', () => {
  assert.equal(defaultRouteForRole('vendor'), '/dispatch.html');
  assert.equal(canAccessPageName('/dispatch.html', 'vendor'), true);
  for (const route of ['/revenue.html', '/job_billing.html', '/marketplace-payouts.html']) {
    assert.equal(canAccessPageName(route, 'vendor'), false, `vendor must not enter ${route}`);
  }
  const vendor = ROLE_DEFINITIONS.find((role) => role.id === 'vendor');
  assert.ok(vendor);
  assert.ok(vendor.routes.includes('/dispatch.html'));
  assert.ok(!vendor.routes.some((route) => ['/revenue.html', '/job_billing.html', '/marketplace-payouts.html', '/territory-map.html'].includes(route)));
  assert.deepEqual(vendor.criticalRoutes, ['/dispatch.html', '/jobs.html', '/settings/appearance.html']);
});

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
    ['assignedRep', '==', userId],
    ['staffClaimedBy', '==', userId]
  ]);
});

test('assigned roles use a per-user work index for list-valued assignment fields', () => {
  assert.deepEqual(buildRoleScopedReadPlan('leads', baseProfile, userId), {
    kind: 'assigned-index',
    filters: [
      ['assignedToUid', '==', userId],
      ['assignedRep', '==', userId],
      ['staffClaimedBy', '==', userId]
    ],
    indexCollection: 'assignedLeads'
  });
  assert.deepEqual(buildRoleScopedReadPlan('jobs', baseProfile, userId), {
    kind: 'assigned-index',
    filters: [
      ['assignedToUid', '==', userId],
      ['assignedRep', '==', userId],
      ['staffClaimedBy', '==', userId]
    ],
    indexCollection: 'assignedJobs'
  });
  assert.throws(() => buildRoleScopedReadPlan('users', baseProfile, userId), /only supports jobs and leads/);
});

test('assignment index writes contain only deduplicated user IDs and record paths', () => {
  assert.deepEqual(assignedUserIds({
    assignedToUid: 'qa-user',
    assignedTo: [' qa-user ', 'team-user'],
    assignedTeamIds: ['team-user'],
    assignedRep: 'rep-user',
    staffClaimedBy: 'claimer'
  }), ['claimer', 'qa-user', 'rep-user', 'team-user']);
  assert.deepEqual(planAssignmentIndexWrites('leads', 'lead-7', {
    assignedTo: ['old-user', 'same-user']
  }, {
    assignedTo: ['same-user', 'new-user']
  }, { uid: 'manager-a', canManageAssignments: true }), [
    { operation: 'set', userId: 'new-user', indexCollection: 'assignedLeads', recordId: 'lead-7' },
    { operation: 'set', userId: 'same-user', indexCollection: 'assignedLeads', recordId: 'lead-7' },
    { operation: 'delete', userId: 'old-user', indexCollection: 'assignedLeads', recordId: 'lead-7' }
  ]);
  assert.deepEqual(planAssignmentIndexWrites('leads', 'lead-8', {
    assignedTo: ['staff-a', 'staff-b']
  }, {
    assignedTo: ['staff-a', 'staff-b']
  }, { uid: 'manager-a', canManageAssignments: true }), [
    { operation: 'set', userId: 'staff-a', indexCollection: 'assignedLeads', recordId: 'lead-8' },
    { operation: 'set', userId: 'staff-b', indexCollection: 'assignedLeads', recordId: 'lead-8' }
  ]);
  assert.deepEqual(planAssignmentIndexWrites('jobs', 'job-8', {
    assignedTo: ['staff-a', 'staff-b']
  }, {
    assignedTo: ['staff-a', 'staff-b']
  }, { uid: 'staff-a', canManageAssignments: false }), [
    { operation: 'set', userId: 'staff-a', indexCollection: 'assignedJobs', recordId: 'job-8' }
  ]);
  assert.deepEqual(planAssignmentIndexWrites('leads', 'lead-7', {
    assignedTo: ['old-user', 'same-user']
  }, {
    assignedTo: ['same-user', 'new-user']
  }, { uid: 'new-user', canManageAssignments: false }), [
    { operation: 'set', userId: 'new-user', indexCollection: 'assignedLeads', recordId: 'lead-7' }
  ]);
  assert.throws(() => planAssignmentIndexWrites('jobs', 'job-1', {}, {}), /verified signed-in user/);
  assert.throws(() => planAssignmentIndexWrites('users', 'user-1'), /only support leads and jobs/);
  assert.throws(() => planAssignmentIndexWrites('jobs', ''), /saved record ID/);
});

test('assignment-index grants are committed before stale-reference cleanup', () => {
  const writes = planAssignmentIndexWrites('leads', 'lead-moved',
    { assignedTo: ['former-worker'] },
    { assignedTo: ['current-worker'] },
    { uid: 'manager', canManageAssignments: true });
  assert.deepEqual(groupAssignmentIndexWrites(writes), [
    [{ operation: 'set', userId: 'current-worker', indexCollection: 'assignedLeads', recordId: 'lead-moved' }],
    [{ operation: 'delete', userId: 'former-worker', indexCollection: 'assignedLeads', recordId: 'lead-moved' }]
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
  assert.equal(refs.length, 3);
  assert.deepEqual(refs[0], {
    ref: source,
    constraint: { type: 'where', args: ['assignedToUid', '==', userId] }
  });
  assert.throws(() => buildRoleScopedQueryRefs(source, baseProfile, userId, {}), /Firestore query helpers/);
});

test('platform administrator loads the owner navigation catalog', () => {
  const nav = fs.readFileSync('public/assets/js/nav.js', 'utf8');
  assert.match(nav, /ownerRoles = new Set\(\[\"platform_admin\", \"owner\", \"super_admin\", \"admin\"\]\)/);
});

test('dashboard waits for the verified role session before applying role-specific routes', () => {
  const dashboard = fs.readFileSync('public/assets/js/dashboard.js', 'utf8');
  assert.match(dashboard, /session\?\.authenticated !== true \|\| session\.source !== \"verified-route-guard\"/);
  assert.match(dashboard, /if \(bucket === \"pending\"\) return;/);
  assert.doesNotMatch(dashboard, /getSavedUserProfile\(\).*role/);
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
  assert.match(rules, /function assignedToUser\(data, userId\)/);
  const leadRule = rules.match(/match \/leads\/\{id\} \{([\s\S]*?)match \/activities/);
  const jobRule = rules.match(/match \/jobs\/\{id\} \{([\s\S]*?)match \/\{collectionId\}/);
  assert.ok(leadRule, 'the lead record rule remains present');
  assert.ok(jobRule, 'the job record rule remains present');
  assert.match(leadRule[1], /allow read: if platform\(\) \|\| customerOwns\(resource\.data\) \|\| assigned\(resource\.data\)/);
  assert.match(jobRule[1], /allow read: if platform\(\) \|\| customerOwns\(resource\.data\) \|\| assigned\(resource\.data\)/);
  assert.match(rules, /match \/assignedLeads\/\{leadId\} \{ allow read: if own\(userId\)/);
  assert.match(rules, /match \/assignedJobs\/\{jobId\} \{ allow read: if own\(userId\)/);
  assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\[\]\) && canCreateAssignmentIndex/);
});

test('assigned work subscriptions follow authorized record changes and fail closed on revoked reads', () => {
  const source = fs.readFileSync('public/assets/js/firestore-role-scoped-collections.js', 'utf8');
  assert.match(source, /onSnapshot\(doc\(db, collectionName, recordId\)/);
  assert.match(source, /error\?\.code === 'permission-denied'/);
  assert.match(source, /snapshot\.exists\(\)\) assignedSnapshots\.set\(recordId, snapshot\)/);
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

test('the UI matrix stubs read-only customer snapshots in demo-emulator mode', () => {
  const spec = fs.readFileSync('tests/visual/specs/authenticated-visual.spec.mjs', 'utf8');
  assert.match(spec, /EVARA_QA_LOCAL_EMULATOR_CHILD === '1'/);
  assert.match(spec, /getMarketplaceCommerceSnapshot/);
  assert.match(spec, /getMarketplaceOperationsSnapshot/);
  assert.match(spec, /localReadOnlyCallables\.has\(url\.pathname\.split\('\/'\)\.at\(-1\)\)/);
  assert.match(spec, /quotes: \[\],\s*invoices: \[\],\s*subscriptions: \[\]/);
  assert.match(spec, /orders: \[\],\s*notifications: \[\],\s*refunds: \[\]/);
});
