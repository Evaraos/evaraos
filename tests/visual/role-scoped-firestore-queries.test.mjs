import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildRoleScopedFilterSpecs, buildRoleScopedQueryRefs, buildRoleScopedReadPlan } from '../../public/assets/js/role-scoped-firestore-queries.mjs';
import { assignedUserIds, groupAssignmentIndexWrites, planAssignmentIndexWrites } from '../../public/assets/js/assignment-index-utils.mjs';
import { canAccessPageName, defaultRouteForRole } from '../../public/assets/js/access-control.js';
import { ROLE_DEFINITIONS, storageStatePath } from './visual-matrix.mjs';

const userId = 'qa-user';
const baseProfile = { uid: userId, role: 'technician', companyId: 'qa-company' };

test('vendor navigation stays on owned account surfaces and excludes unsupported work actions', () => {
  assert.equal(defaultRouteForRole('vendor'), '/settings/account.html');
  assert.equal(canAccessPageName('/settings/account.html', 'vendor'), true);
  for (const route of ['/dashboard.html', '/jobs.html', '/leads.html', '/dispatch.html', '/field.html', '/schedule.html', '/customer-service-history.html', '/revenue.html', '/job_billing.html', '/marketplace-payouts.html']) {
    assert.equal(canAccessPageName(route, 'vendor'), false, `vendor must not enter ${route}`);
  }
  const vendor = ROLE_DEFINITIONS.find((role) => role.id === 'vendor');
  assert.ok(vendor);
  assert.ok(vendor.routes.includes('/settings/account.html'));
  assert.ok(!vendor.routes.some((route) => ['/jobs.html', '/leads.html', '/dispatch.html', '/field.html', '/schedule.html', '/revenue.html', '/job_billing.html', '/marketplace-payouts.html', '/territory-map.html'].includes(route)));
  assert.deepEqual(vendor.criticalRoutes, ['/settings/account.html', '/settings/appearance.html']);
  for (const route of vendor.routes) {
    assert.equal(canAccessPageName(route, 'vendor'), true, `vendor matrix route ${route} must be authorized`);
  }
});

test('authenticated visual matrix uses browser-native Chromium and WebKit sessions', () => {
  assert.ok(storageStatePath('qa-user', 'chromium').endsWith('qa-user-chromium.json'));
  assert.ok(storageStatePath('qa-user', 'webkit').endsWith('qa-user-webkit.json'));
  const setup = fs.readFileSync('tests/visual/global-setup.mjs', 'utf8');
  const matrix = fs.readFileSync('tests/visual/specs/authenticated-visual.spec.mjs', 'utf8');
  assert.match(setup, /\{ name: 'chromium', launch: \(\) => chromium\.launch\(\) \}/);
  assert.match(setup, /\{ name: 'webkit', launch: \(\) => webkit\.launch\(\) \}/);
  assert.match(matrix, /qaRoleId: \['', \{ option: true \}\]/);
  assert.match(matrix, /storageState: async \(\{ browserName, qaRoleId \}, use\) =>/);
  assert.match(matrix, /test\.use\(\{ qaRoleId: role\.id \}\)/);
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
    ['staffClaimedBy', '==', userId],
    ['assignedTo', 'array-contains', userId],
    ['assignedTeamIds', 'array-contains', userId],
    ['assignedRep', 'array-contains', userId]
  ]);
});

test('assigned roles retain rule-proven legacy reads while using the per-user work index', () => {
  assert.deepEqual(buildRoleScopedReadPlan('leads', baseProfile, userId), {
    kind: 'assigned-index',
    filters: [
      ['assignedToUid', '==', userId],
      ['assignedRep', '==', userId],
      ['staffClaimedBy', '==', userId],
      ['assignedTo', 'array-contains', userId],
      ['assignedTeamIds', 'array-contains', userId],
      ['assignedRep', 'array-contains', userId]
    ],
    indexCollection: 'assignedLeads'
  });
  assert.deepEqual(buildRoleScopedReadPlan('jobs', baseProfile, userId), {
    kind: 'assigned-index',
    filters: [
      ['assignedToUid', '==', userId],
      ['assignedRep', '==', userId],
      ['staffClaimedBy', '==', userId],
      ['assignedTo', 'array-contains', userId],
      ['assignedTeamIds', 'array-contains', userId],
      ['assignedRep', 'array-contains', userId]
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
  assert.equal(refs.length, 6);
  assert.deepEqual(refs[0], {
    ref: source,
    constraint: { type: 'where', args: ['assignedToUid', '==', userId] }
  });
  assert.deepEqual(refs[3], {
    ref: source,
    constraint: { type: 'where', args: ['assignedTo', 'array-contains', userId] }
  });
  assert.deepEqual(refs[5], {
    ref: source,
    constraint: { type: 'where', args: ['assignedRep', 'array-contains', userId] }
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
