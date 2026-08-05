import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessPath,
  normalizeAccessRole,
  pagesForRole
} from '../public/assets/js/access-control.js';

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

assert.match(routeGuardSource, /window\.location\.pathname \|\| '\/index\.html'/);
assert.match(routeGuardSource, /source: 'verified-route-guard'/);
assert.match(routeGuardSource, /window\.EvaraRouteSession = session/);
assert.doesNotMatch(directAccessSource, /localStorage|sessionStorage/);
assert.match(directAccessSource, /source !== 'verified-route-guard'/);
assert.match(directAccessSource, /location\.pathname \|\| '\/index\.html'/);

console.log(`Validated ${accessCases.length} route decisions and the verified-session direct-access contract.`);
