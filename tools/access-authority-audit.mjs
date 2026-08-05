import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessPath,
  normalizeAccessRole,
  pagesForRole
} from '../public/assets/js/access-control.js';

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

const routeGuardSource = fs.readFileSync('public/assets/js/route-guard.js', 'utf8');
const directAccessSource = fs.readFileSync('public/assets/js/direct-access-check.js', 'utf8');
const blueprintSecuritySource = fs.readFileSync('functions/blueprint-security.js', 'utf8');
const firestoreRulesSource = fs.readFileSync('firebase/firestore.rules', 'utf8');

assert.match(routeGuardSource, /window\.location\.pathname \|\| '\/index\.html'/);
assert.match(routeGuardSource, /source: 'verified-route-guard'/);
assert.match(routeGuardSource, /window\.EvaraRouteSession = session/);
assert.match(
  routeGuardSource,
  /return \['active', 'approved'\]\.includes\(status\) && approval === 'approved';/,
  'The browser route guard must require an active-or-approved status and approved approvalStatus.'
);
assert.doesNotMatch(
  routeGuardSource,
  /profile\.status \|\| 'active'/,
  'The browser route guard must not default a missing account status to active.'
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

console.log(`Validated ${accessCases.length} route decisions, one page-policy authority, strict lifecycle parity, and the verified-session direct-access contract.`);
