import assert from 'node:assert/strict';
import { CANONICAL_ROLES, canAccessPageName } from '../public/assets/js/access-control.js';

// Pure navigation authority tests; these do not simulate authenticated browser QA.
const values = new Map([
  ['evaraos-user', JSON.stringify({ uid: 'cached-owner', email: 'cached@example.invalid', role: 'owner' })],
  ['evaraos-role', 'owner'], ['evaraos-preview-role', 'owner']
]);
globalThis.localStorage = globalThis.sessionStorage = { getItem: key => values.get(key) || null };
globalThis.window = { location: { pathname: '/' } };
globalThis.document = { body: { dataset: { routeGuard: 'public' } } };
const nav = await import('../public/assets/js/nav/nav-utils.js');
let checks = 0;
function expectGuest() {
  assert.equal(nav.isAuthenticated(), false);
  assert.equal(nav.getRole(), 'guest');
  checks += 2;
}
for (const route of ['/', '/index.html', '/login.html', '/signup.html', '/staff_application.html']) {
  window.location.pathname = route;
  for (const session of [undefined, {authenticated: true, role: 'owner'}, {authenticated:false, role:'owner', source:'verified-public-home'}]) {
    window.EvaraRouteSession = session;
    expectGuest();
  }
}
window.location.pathname = '/';
const verified = {authenticated:true, source:'verified-public-home', userId:'test-user', role:'owner', lifecycle:'active', status:'active', approvalStatus:'approved'};
for (const role of CANONICAL_ROLES) {
  window.EvaraRouteSession = {...verified, role};
  assert.equal(nav.isAuthenticated(), true);
  assert.equal(nav.getRole(), role);
  checks += 2;
}
for (const override of [{role:'unrecognized'}, {userId:''}, {status:'suspended'}, {approvalStatus:'pending'}, {lifecycle:'pending'}, {source:'cached-profile'}, {authenticated:false}]) {
  window.EvaraRouteSession = {...verified,...override};
  expectGuest();
}
for (const route of ['index.html','signup.html','staff_application.html']) {assert.equal(canAccessPageName(route,'guest'),true);checks++;}
for (const route of ['dashboard.html','jobs.html','users.html','notifications_center.html']) {assert.equal(canAccessPageName(route,'guest'),false);checks++;}
console.log(`PASS: ${checks} Home shell authority assertions, including poisoned caches, all canonical roles, revoked/pending sessions and guest destination policy.`);
