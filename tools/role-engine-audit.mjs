#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const accessPath = path.join(root, 'public/assets/js/access-control-v2.js');
const accessModule = await import(`${pathToFileURL(accessPath).href}?audit=${Date.now()}`);

const {
  CANONICAL_ROLES,
  normalizeAccessRole,
  canAccessPageName,
  canUseFeature,
  defaultRouteForRole,
  isKnownRole,
  isPlatformOwner
} = accessModule;

const matrix = [
  ['super_admin', 'platform_admin'],
  ['platform-admin', 'platform_admin'],
  ['operations_manager', 'manager'],
  ['sales_rep', 'sales'],
  ['tech', 'technician'],
  ['lead_cleaner', 'cleaner'],
  ['field_staff', 'technician'],
  ['organization_owner', 'vendor'],
  ['customer', 'customer']
];

for (const [input, expected] of matrix) {
  assert.equal(normalizeAccessRole(input), expected, `${input} should normalize to ${expected}`);
}

assert.equal(normalizeAccessRole('made_up_role'), '', 'unknown roles must fail closed');
assert.equal(isKnownRole('made_up_role'), false, 'unknown role must not be known');
assert.equal(defaultRouteForRole('made_up_role'), '/login.html', 'unknown role must return to login');
assert.equal(new Set(CANONICAL_ROLES).size, CANONICAL_ROLES.length, 'canonical roles must be unique');

assert.equal(canAccessPageName('/customer_dashboard.html', 'customer'), true, 'customer must reach customer portal');
assert.equal(canAccessPageName('/dashboard.html', 'customer'), false, 'customer must not reach staff dashboard');
assert.equal(canAccessPageName('/website-builder.html', 'customer'), false, 'customer must not reach Studio');
assert.equal(canAccessPageName('/website-builder.html', 'owner'), true, 'owner must reach Studio');
assert.equal(canAccessPageName('/customer_dashboard.html', 'owner'), true, 'owner ultimate access must include customer portal');
assert.equal(canAccessPageName('/settings/notifications.html', 'customer'), true, 'customer must reach personal notification settings');
assert.equal(canAccessPageName('/notifications.html', 'customer'), false, 'customer must not reach operations notifications');
assert.equal(canAccessPageName('/jobs.html', 'vendor'), true, 'vendor UI policy must include jobs');
assert.equal(canUseFeature('orderServices', 'customer'), true, 'customer must be able to order services');
assert.equal(canUseFeature('manageUsers', 'customer'), false, 'customer must not manage users');
assert.equal(canUseFeature('orderServices', 'owner'), true, 'owner ultimate access must include all registered features');
assert.equal(isPlatformOwner('owner'), true, 'owner must be recognized as platform owner');

const accessEntry = read('public/assets/js/access-control.js');
assert.match(accessEntry, /access-control-v2\.js/, 'access-control.js must activate v2');

const rolesSource = read('public/assets/js/roles.js');
assert.match(rolesSource, /from '\.\/access-control\.js'/, 'roles.js must delegate to canonical access control');
assert.doesNotMatch(rolesSource, /owner:\s*\[\s*["']all["']/, 'roles.js must not carry a second handwritten permission matrix');

const appSource = read('public/assets/js/app.js');
assert.match(appSource, /from '\.\/access-control\.js'/, 'app.js must delegate to canonical access control');
assert.doesNotMatch(appSource, /const ROLE_PERMISSIONS\s*=/, 'app.js must not carry a third permission matrix');
assert.match(appSource, /Unsupported account role/, 'app.js must reject unsupported stored roles');

const routeEntry = read('public/assets/js/route-guard.js');
assert.match(routeEntry, /route-guard-v2\.js/, 'route guard entry must activate v2');
const routeGuardSource = read('public/assets/js/route-guard-v2.js');
assert.match(routeGuardSource, /source: 'verified-route-guard'/, 'route guard must publish a verified session');
assert.match(routeGuardSource, /source: 'verified-route-guard-cache'/, 'route guard must publish its UID-matched cache fallback');
assert.match(routeGuardSource, /if \(!session\.user \|\| !session\.profile \|\| !session\.role\)/, 'route guard must fail closed without verified role data');

const portalEntry = read('public/assets/js/customer-portal-v2.js');
assert.match(portalEntry, /customer-portal-v4\.js/, 'customer portal entry must activate v4');
const portalSource = read('public/assets/js/customer-portal-v4.js');
assert.match(portalSource, /where\(field, '==', uid\)/, 'customer portal must issue identity-scoped queries');
assert.doesNotMatch(portalSource, /fetchAllCollection/, 'customer portal must not enumerate unrestricted collections');
assert.match(portalSource, /evara:customer-portal-ready/, 'customer portal must publish visual readiness');

console.log(`Role engine audit passed for ${CANONICAL_ROLES.length} canonical roles.`);
