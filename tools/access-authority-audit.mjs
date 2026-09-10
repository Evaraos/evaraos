import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANONICAL_ROLES,
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
  ['/operations_map.html', 'technician', true],
  ['/dispatch_map.html', 'technician', true],
  ['/leads.html', 'sales', true],
  ['/leads.html', 'technician', false],
  ['/operations_map.html', 'customer', false],
  ['/dispatch_map.html', 'customer', false],
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

for (const role of CANONICAL_ROLES) {
  assert.equal(normalizeAccessRole(role), role, `Canonical role ${role} must normalize to itself`);
  assert.equal(normalizeAccessRole(normalizeAccessRole(role)), role, `Normalization must be idempotent for ${role}`);
  assert.equal(resolveAccountLifecycle({ uid: 'role-check', role, status: 'active', approvalStatus: 'approved' }).active, true);
  assert.equal(resolveAccountLifecycle({ uid: 'role-check', role, status: 'suspended', approvalStatus: 'approved' }).active, false);
}
assert.equal(canAccessPageName('/dashboard.html', 'platform_admin'), true);
assert.equal(canAccessPageName('/unknown-private-route.html', 'platform_admin'), false);

assert.equal(normalizeAccessRole('super admin'), 'platform_admin');
for (const unknown of ['not-a-role', 'constructor', '__proto__', 'toString']) {
  assert.equal(normalizeAccessRole(unknown), '');
  assert.equal(canAccessPageName('/dashboard.html', unknown), false);
}
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
const dashboardMapCardSource = fs.readFileSync('public/assets/js/dashboard-live-map-card.js', 'utf8');
const dashboardEntrySource = fs.readFileSync('public/assets/js/dashboard-entry.js', 'utf8');
const leadsEntrySource = fs.readFileSync('public/assets/js/leads-entry.js', 'utf8');
const compactOperationsMapSource = fs.readFileSync('public/operations_map.html', 'utf8');
const expandedDispatchMapSource = fs.readFileSync('public/dispatch_map.html', 'utf8');
const mapViewParametersSource = fs.readFileSync('public/assets/js/map-view-parameters.js', 'utf8');
const bottomNavSource = fs.readFileSync('public/assets/js/nav/nav-bottom.js', 'utf8');
const navRenderSource = fs.readFileSync('public/assets/js/nav/nav-render.js', 'utf8');
const appRegistrySource = fs.readFileSync('public/assets/js/navigation/app-registry.js', 'utf8');

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

assert.match(
  dashboardEntrySource,
  /dashboard-live-map-card\.js/,
  'The dashboard must load the shared compact Operations Map preview.'
);
assert.match(
  leadsEntrySource,
  /dashboard-live-map-card\.js/,
  'The Leads page must reuse the shared compact Operations Map preview.'
);
assert.doesNotMatch(
  leadsEntrySource,
  /leads-map-v2\.js/,
  'The Leads page must not restore a second map wrapper.'
);
assert.equal(
  fs.existsSync('public/assets/js/leads-map-v2.js'),
  false,
  'The obsolete Leads-only map wrapper must remain deleted.'
);
assert.match(
  dashboardMapCardSource,
  /frameSrc: '\/operations_map\.html\?embed=1'/,
  'The dashboard map window must embed the compact Operations Map.'
);
assert.match(
  dashboardMapCardSource,
  /openHref: '\/operations_map\.html'/,
  'The dashboard map action must open the compact Operations Map.'
);
assert.match(
  dashboardMapCardSource,
  /frameSrc: '\/operations_map\.html\?embed=1&type=lead'/,
  'The Leads map window must embed the canonical compact map filtered to leads.'
);
assert.match(
  dashboardMapCardSource,
  /openHref: '\/operations_map\.html\?type=lead'/,
  'The Leads map action must open the canonical lead-filtered Operations Map.'
);
assert.match(
  dashboardMapCardSource,
  /sectionId: 'leadsMapWorkspace'/,
  'The shared preview must retain the Leads mount target.'
);
assert.doesNotMatch(
  dashboardMapCardSource,
  /href="\/dispatch_map\.html"/,
  'Embedded previews must not bypass the compact Operations Map when opening the expanded workspace.'
);
assert.match(
  compactOperationsMapSource,
  /data-map-view="compact"/,
  'operations_map.html must remain the compact map workspace.'
);
assert.match(
  compactOperationsMapSource,
  /href="\/dispatch_map\.html"[^>]*data-map-expand|data-map-expand[^>]*href="\/dispatch_map\.html"/,
  'The compact Operations Map must expose the expanded Dispatch Map through its Expand control.'
);
assert.match(
  expandedDispatchMapSource,
  /data-map-view="expanded"/,
  'dispatch_map.html must remain the expanded map workspace.'
);
assert.match(
  expandedDispatchMapSource,
  /href="\/operations_map\.html"/,
  'The expanded Dispatch Map must provide a return path to the compact Operations Map.'
);
assert.match(
  compactOperationsMapSource,
  /map-view-parameters\.js/,
  'The compact Operations Map must apply canonical URL filter parameters.'
);
assert.match(
  expandedDispatchMapSource,
  /map-view-parameters\.js/,
  'The expanded Dispatch Map must apply canonical URL filter parameters.'
);
assert.match(
  mapViewParametersSource,
  /new Set\(\['all', 'lead', 'job', 'staff'\]\)/,
  'Shared map URL filtering must remain restricted to recognized record types.'
);

assert.match(
  appRegistrySource,
  /id: "operations-map"[\s\S]*?roles: \[[^\]]*"staff"[^\]]*\]/,
  'The app registry must expose Operations Map to the staff navigation group.'
);
assert.match(
  navRenderSource,
  /canAccessPageName\(app\.route, role\)/,
  'The drawer must filter registry entries through canonical page access.'
);
assert.match(
  bottomNavSource,
  /if \(role === "sales"\) return \["dashboard", "leads", "map", "messages", "settings"\]/,
  'Sales bottom navigation must expose Leads and Map.'
);
assert.match(
  bottomNavSource,
  /if \(\["technician", "cleaner"\]\.includes\(role\)\) return \["dashboard", "jobs", "schedule", "map", "messages"\]/,
  'Technician and cleaner bottom navigation must expose Jobs, Schedule, and Map.'
);
assert.match(
  bottomNavSource,
  /canAccessPageName\(REGISTRY\[id\]\.page, role\)/,
  'Saved bottom-navigation items must remain filtered through canonical page access.'
);

console.log(`Validated ${accessCases.length} route decisions, one page-policy authority, delegated lifecycle authority, verified-session direct access, role-scoped map reads, compact-to-expanded flow, one shared lead-map runtime, and role-specific Map navigation.`);
