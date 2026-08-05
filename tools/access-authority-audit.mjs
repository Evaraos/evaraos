import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessPath,
  normalizeAccessRole,
  pagesForRole
} from '../public/assets/js/access-control.js';
import { resolveAccountLifecycle } from '../public/assets/js/account-lifecycle.js';

const duplicatePagePolicyPath = 'public/assets/js/permissions/page-access.js';
assert.equal(
  fs.existsSync(duplicatePagePolicyPath),
  false,
  `${duplicatePagePolicyPath} must remain deleted; access-control.js is the sole page-policy authority.`
);

const accessCases = [
  ['/dashboard.html', 'owner', true],
  ['/dashboard.html', 'customer', false],
  ['/customer_dashboard.html', 'customer', true],
  ['/customer_dashboard.html', 'owner', false],
  ['/settings/account.html', 'customer', true],
  ['/settings/workspace-v2.html?tab=team#members', 'manager', true],
  ['/untrusted/account.html', 'customer', false],
  ['/settings/unknown.html', 'owner', false],
  ['/dashboard.html', 'unknown-role', false],
  ['/staff_application.html', '', true],
  ['https://example.com/dashboard.html', 'owner', false],
  ['/settings/../dashboard.html', 'owner', false]
];

for (const [path, role, expected] of accessCases) {
  assert.equal(
    canAccessPageName(path, role),
    expected,
    `${role || 'guest'} access for ${path} should be ${expected}`
  );
}

assert.equal(normalizeAccessRole('super admin'), 'platform_admin');
assert.equal(normalizeAccessRole('not-a-role'), '');
assert.equal(normalizeAccessPath('/settings/account.html?tab=profile#name'), 'settings/account.html');
assert.equal(normalizeAccessPath('./public/settings/icons.html'), 'settings/icons.html');
assert.equal(defaultRouteForRole('customer'), '/customer_dashboard.html');
assert.equal(defaultRouteForRole('owner'), '/dashboard.html');
assert.equal(defaultRouteForRole('unknown-role'), '/login.html');
assert.ok(pagesForRole('customer').includes('settings/account.html'));
assert.deepEqual(pagesForRole('unknown-role'), []);

const activeLifecycle = resolveAccountLifecycle({
  uid: 'active-user',
  role: 'owner',
  status: 'active',
  approvalStatus: 'approved'
});
const pendingLifecycle = resolveAccountLifecycle({
  uid: 'pending-user',
  role: 'customer',
  status: 'pending',
  approvalStatus: 'pending'
});
const incompleteLifecycle = resolveAccountLifecycle({
  uid: 'incomplete-user',
  role: 'owner',
  status: '',
  approvalStatus: 'approved'
});

assert.equal(activeLifecycle.active, true);
assert.equal(pendingLifecycle.active, false);
assert.equal(incompleteLifecycle.active, false);

const routeGuardSource = fs.readFileSync('public/assets/js/route-guard.js', 'utf8');
const lifecycleSource = fs.readFileSync('public/assets/js/account-lifecycle.js', 'utf8');
const directAccessSource = fs.readFileSync('public/assets/js/direct-access-check.js', 'utf8');
const blueprintSecuritySource = fs.readFileSync('functions/blueprint-security.js', 'utf8');
const firestoreRulesSource = fs.readFileSync('firebase/firestore.rules', 'utf8');
const fieldOpsMapSource = fs.readFileSync('public/assets/js/field-ops-map-layer.js', 'utf8');
const fieldOpsRealtimeSource = fs.readFileSync('public/assets/js/field-ops-realtime.js', 'utf8');

assert.match(routeGuardSource, /window\.location\.pathname \|\| '\/index\.html'/);
assert.match(routeGuardSource, /source: 'verified-route-guard'/);
assert.match(routeGuardSource, /window\.EvaraRouteSession = session/);
assert.match(
  routeGuardSource,
  /from '\.\/account-lifecycle\.js'/,
  'The browser route guard must import the canonical lifecycle authority.'
);
assert.match(
  routeGuardSource,
  /lifecycle: resolveAccountLifecycle\(profile\)/,
  'The browser route guard must delegate lifecycle decisions to account-lifecycle.js.'
);
assert.doesNotMatch(
  routeGuardSource,
  /function accountIsActive\(/,
  'The browser route guard must not define a second lifecycle authority.'
);
assert.match(
  lifecycleSource,
  /ACTIVE_STATUSES\.has\(status\) && approvalStatus === 'approved' && role/,
  'The canonical lifecycle authority must require active-or-approved status, approved approvalStatus, and a recognized role.'
);
assert.doesNotMatch(
  lifecycleSource,
  /profile\?\.status \|\| 'active'/,
  'The canonical lifecycle authority must not default a missing account status to active.'
);

assert.match(
  blueprintSecuritySource,
  /if \(!\['active', 'approved'\]\.includes\(status\) \|\| approval !== 'approved'\)/,
  'Trusted Blueprint Functions must enforce the same strict account lifecycle as Firestore.'
);
assert.doesNotMatch(
  blueprintSecuritySource,
  /profile\.status \|\| 'active'/,
  'Trusted Blueprint Functions must not default a missing account status to active.'
);
assert.match(
  firestoreRulesSource,
  /function active\(\) \{ return userExists\(\) && user\(\)\.status in \['active', 'approved'\] && user\(\)\.approvalStatus == 'approved'; \}/,
  'Firestore must retain the canonical strict active-account contract.'
);

assert.doesNotMatch(directAccessSource, /localStorage|sessionStorage/);
assert.match(directAccessSource, /source !== 'verified-route-guard'/);
assert.match(directAccessSource, /location\.pathname \|\| '\/index\.html'/);

assert.doesNotMatch(
  fieldOpsMapSource,
  /getDocs\(collection\(db,\s*['"](?:leads|jobs)['"]\)\)/,
  'Field operations maps must not issue unrestricted collection reads.'
);
assert.doesNotMatch(
  fieldOpsRealtimeSource,
  /onSnapshot\(collection\(db,\s*['"](?:leads|jobs)['"]\)/,
  'Field operations realtime listeners must not subscribe to unrestricted collections.'
);
assert.match(
  fieldOpsMapSource,
  /where\('companyId', '==', context\.companyId\)/,
  'Manager map reads must remain company-scoped.'
);
for (const assignmentField of ['assignedToUid', 'assignedTo', 'assignedTeamIds', 'assignedRep', 'staffClaimedBy']) {
  assert.match(
    fieldOpsMapSource,
    new RegExp(`where\\('${assignmentField}'`),
    `Staff map reads must retain the ${assignmentField} assignment scope.`
  );
}
assert.match(
  fieldOpsRealtimeSource,
  /buildFieldOpsCollectionQueries\('leads', context\)/
);
assert.match(
  fieldOpsRealtimeSource,
  /buildFieldOpsCollectionQueries\('jobs', context\)/
);

console.log(`Validated ${accessCases.length} route decisions, one page-policy authority, delegated lifecycle authority, verified-session direct access, and role-scoped map reads.`);
