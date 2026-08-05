import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACCOUNT_LIFECYCLE_STATES,
  accountLifecycleCopy,
  resolveAccountLifecycle,
  routeForAccountLifecycle
} from '../public/assets/js/account-lifecycle.js';

const cases = [
  [{ uid: '1', role: 'owner', status: 'active', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.ACTIVE, true, '/dashboard.html'],
  [{ uid: '2', role: 'customer', status: 'approved', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.ACTIVE, true, '/customer_dashboard.html'],
  [{ uid: '3', role: 'customer', status: 'pending', approvalStatus: 'pending' }, ACCOUNT_LIFECYCLE_STATES.PENDING, false, '/account-status.html?state=pending'],
  [{ uid: '4', role: 'technician', status: 'active', approvalStatus: 'needs_more_info' }, ACCOUNT_LIFECYCLE_STATES.NEEDS_MORE_INFO, false, '/account-status.html?state=needs_more_info'],
  [{ uid: '5', role: 'manager', status: 'suspended', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.SUSPENDED, false, '/account-status.html?state=suspended'],
  [{ uid: '6', role: 'customer', status: 'disabled', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.DISABLED, false, '/account-status.html?state=disabled'],
  [{ uid: '7', role: 'customer', status: 'inactive', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.DISABLED, false, '/account-status.html?state=disabled'],
  [{ uid: '8', role: 'customer', status: 'active', approvalStatus: 'rejected' }, ACCOUNT_LIFECYCLE_STATES.REJECTED, false, '/account-status.html?state=rejected'],
  [{ uid: '9', role: 'unknown-role', status: 'active', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED, false, '/account-status.html?state=verification_required'],
  [{ uid: '10', role: 'customer', status: '', approvalStatus: 'approved' }, ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED, false, '/account-status.html?state=verification_required'],
  [{ uid: '11', role: 'customer', status: 'active', approvalStatus: '' }, ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED, false, '/account-status.html?state=verification_required'],
  [null, ACCOUNT_LIFECYCLE_STATES.MISSING_PROFILE, false, '/account-status.html?state=missing_profile']
];

for (const [profile, expectedState, expectedActive, expectedRoute] of cases) {
  const decision = resolveAccountLifecycle(profile);
  assert.equal(decision.state, expectedState, `Unexpected lifecycle state for ${JSON.stringify(profile)}`);
  assert.equal(decision.active, expectedActive, `Unexpected active decision for ${JSON.stringify(profile)}`);
  assert.equal(routeForAccountLifecycle(decision), expectedRoute, `Unexpected route for ${expectedState}`);
}

assert.equal(accountLifecycleCopy('pending').title, 'Your account is pending approval.');
assert.equal(accountLifecycleCopy('not-real').eyebrow, 'VERIFICATION REQUIRED');

const routeGuard = fs.readFileSync('public/assets/js/route-guard.js', 'utf8');
const verifiedProfile = fs.readFileSync('public/assets/js/verified-profile.js', 'utf8');
const auth = fs.readFileSync('public/assets/js/auth.js', 'utf8');
const accountStatusHtml = fs.readFileSync('public/account-status.html', 'utf8');
const accountStatusJs = fs.readFileSync('public/assets/js/account-status.js', 'utf8');
const rules = fs.readFileSync('firebase/firestore.rules', 'utf8');

assert.match(routeGuard, /readVerifiedUserProfile\(user\)/);
assert.match(routeGuard, /resolveAccountLifecycle\(profile\)/);
assert.match(routeGuard, /mode === 'account-status'/);
assert.match(routeGuard, /if \(!session\.lifecycle\.active\)/);
assert.doesNotMatch(routeGuard, /profile\.status \|\| ['"]active['"]/);
assert.doesNotMatch(routeGuard, /accountIsActive/);

assert.match(verifiedProfile, /if \(!snapshot\.exists\(\)\) return null;/);
assert.match(verifiedProfile, /role: clean\(data\.role\)/);
assert.match(verifiedProfile, /status: clean\(data\.status\)/);
assert.match(verifiedProfile, /approvalStatus: clean\(data\.approvalStatus\)/);
assert.doesNotMatch(verifiedProfile, /getSavedUserRole|getSavedUserProfile/);

assert.match(auth, /const DEFAULT_PUBLIC_STATUS = 'pending';/);
assert.match(auth, /const DEFAULT_PUBLIC_APPROVAL = 'pending';/);
assert.match(auth, /redirectForProfile\(profile\)/);
assert.match(auth, /routeForAccountLifecycle\(lifecycle\)/);
assert.doesNotMatch(auth, /navigateWithLoader\(['"]\/customer_dashboard\.html/);

assert.match(accountStatusHtml, /data-route-guard="account-status"/);
assert.match(accountStatusHtml, /\/assets\/js\/account-status\.js/);
assert.match(accountStatusJs, /source !== 'verified-route-guard'/);
assert.match(accountStatusJs, /await signOut\(auth\)/);

assert.match(
  rules,
  /function active\(\) \{ return userExists\(\) && user\(\)\.status in \['active', 'approved'\] && user\(\)\.approvalStatus == 'approved'; \}/
);
assert.match(
  rules,
  /request\.resource\.data\.status == 'pending' && request\.resource\.data\.approvalStatus == 'pending'/
);

console.log(`Account lifecycle authority audit passed: ${cases.length} lifecycle cases validated.`);
console.log('Active access, pending review, blocked states, missing profiles, and unknown roles all fail or route as expected.');
