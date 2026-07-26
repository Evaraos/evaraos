#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const requireText = (source, marker, message) => { if (!source.includes(marker)) failures.push(message); };
const forbidText = (source, marker, message) => { if (source.includes(marker)) failures.push(message); };

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else output.push(absolute);
  }
  return output;
}

const navEntry = read('public/assets/js/nav.js');
requireText(navEntry, './nav/nav-main-v7.js?v=nav-v61-role-authority', 'Nav entry does not boot the stable role-authority runtime');
requireText(navEntry, './nav/nav-role-lockdown-v2.js?v=2', 'Nav entry does not load actual-role lockdown');
requireText(navEntry, './app-builder-runtime-v2.js?v=2', 'Nav entry does not load global/company builder runtime v2');
requireText(navEntry, './owner-publish-runtime-v2.js?v=2', 'Nav entry does not load owner/admin publishing runtime v2');

const navAuthority = read('public/assets/js/nav/nav-authority-v1.js');
forbidText(navAuthority, 'evaraos-preview-role', 'Navigation authority still trusts a presentation preview role');
requireText(navAuthority, 'verified-route-guard-cache', 'Navigation authority does not accept the verified cached route session');
requireText(navAuthority, 'registryRole', 'Navigation authority does not map verified roles to the app registry');

const navUtils = read('public/assets/js/nav/nav-utils-v2.js');
forbidText(navUtils, 'evaraos-preview-role', 'Navigation utilities still read preview role state');
requireText(navUtils, 'actualRole()', 'Navigation utilities do not use actual role authority');

const navRender = read('public/assets/js/nav/nav-render-v2.js');
requireText(navRender, 'data-navigation-role', 'Rendered navigation does not expose its verified role for diagnostics');
requireText(navRender, 'isCurrentPage', 'Navigation does not limit page-specific behavior to active highlighting');
requireText(navRender, 'appsByCategory(registryRole(actualRole))', 'Navigation list is not generated only from the verified role');

const lockdown = read('public/assets/js/nav/nav-role-lockdown-v2.js');
forbidText(lockdown, 'previewRole', 'Navigation lockdown still changes links for role preview');
requireText(lockdown, 'const role = actualRole()', 'Navigation lockdown does not use actual role authority');

const sessionRuntime = read('public/assets/js/nav/nav-session-v2.js');
requireText(sessionRuntime, 'scheduleRefresh();', 'Navigation does not immediately reconcile a route session emitted before nav boot');
forbidText(sessionRuntime, 'evara:role-preview', 'Navigation still rebuilds itself from presentation preview events');

const access = read('public/assets/js/access-control-v2.js');
requireText(access, "const ULTIMATE_ROLES = new Set(['platform_admin', 'owner'])", 'Owner ultimate access contract is missing');
requireText(access, 'ULTIMATE_ROLES.has(normalizedRole) || allowed.includes(normalizedRole)', 'Owner does not bypass registered page restrictions');
requireText(access, 'if (ULTIMATE_ROLES.has(normalized)) return Object.keys(FEATURE_POLICY)', 'Owner does not receive all registered features');

const routeGuard = read('public/assets/js/route-guard-v2.js');
requireText(routeGuard, "source: 'verified-route-guard-cache'", 'Route guard has no exact-UID cache fallback');
requireText(routeGuard, 'profile: session.profile', 'Route guard does not publish the verified profile to page runtimes');
requireText(routeGuard, 'uid === user.uid', 'Cached profile fallback is not tied to the authenticated Firebase UID');

const portal = read('public/assets/js/customer-portal-v4.js');
for (const collectionName of ['jobs', 'customer_services', 'subscriptions', 'customer_service_history']) {
  requireText(portal, `'${collectionName}'`, `Customer portal does not include ${collectionName}`);
}
for (const field of ['customerUid', 'customerId', 'userId']) {
  requireText(portal, `'${field}'`, `Customer portal does not use ownership field ${field}`);
}
requireText(portal, "where(field, '==', uid)", 'Customer portal does not issue equality-scoped Firestore queries');
requireText(portal, 'state.successfulQueries === 0 && state.queryFailures.length', 'Customer portal can still report an empty history after total query failure');
requireText(portal, 'revealPortal();', 'Customer portal does not guarantee a visible page state');
forbidText(portal, 'fetchAllCollection', 'Customer portal still uses unrestricted collection reads');

const publisher = read('public/assets/js/owner-publish-runtime-v2.js');
requireText(publisher, "type: 'global'", 'Owner publisher has no global scope');
requireText(publisher, 'doc(db, GLOBAL_CONFIG_COLLECTION, GLOBAL_CONFIG_ID)', 'Owner publisher does not target public_app_config/global');
requireText(publisher, "currentRole === 'admin' && id", 'Admin publisher does not require a company ID');
requireText(publisher, 'No company workspace is required', 'Owner UI still claims a company workspace is required');

const builder = read('public/assets/js/app-builder-runtime-v2.js');
requireText(builder, "const GLOBAL_CACHE_ID = 'global'", 'App Builder has no global baseline cache');
requireText(builder, "doc(db, 'public_app_config', 'global')", 'App Builder does not load owner global settings');
requireText(builder, 'mergeConfig(globalConfig, companyConfig)', 'Company settings are not layered over the owner global baseline');
requireText(builder, "DEFAULT_LOGO = '/assets/img/evaraos_logo.png?v=brand-contract-2'", 'App Builder visible logo contract is incorrect');
requireText(builder, "DEFAULT_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-contract-2'", 'App Builder app icon contract is incorrect');

const rules = read('firebase/firestore.rules');
requireText(rules, 'match /public_app_config/{id}', 'Firestore has no global owner configuration rule');
requireText(rules, "allow create, update, delete: if id == 'global' && platform()", 'Global publishing is not restricted to platform owner authority');
requireText(rules, 'companyAppBuilderAdmin(id)', 'Firestore has no company-scoped admin appBuilder helper');
requireText(rules, "hasOnly(['appBuilder','appBuilderUpdatedAt'])", 'Admin company updates are not restricted to appBuilder fields');

const loader = read('public/assets/js/loader.js');
requireText(loader, "import('/assets/js/nav.js", 'Loader watchdog no longer provides the universal navigation fallback');

const publicRoot = path.join(root, 'public');
for (const absolute of walk(publicRoot).filter((file) => file.endsWith('.html'))) {
  const source = fs.readFileSync(absolute, 'utf8');
  if (!source.includes('id="universalNavRoot"') && !source.includes("id='universalNavRoot'")) continue;
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  const navReferences = source.match(/<script[^>]+src=["'][^"']*\/assets\/js\/nav\.js(?:\?[^"']*)?["'][^>]*>/g) || [];
  const loaderReferences = source.match(/<script[^>]+src=["'][^"']*\/assets\/js\/loader\.js(?:\?[^"']*)?["'][^>]*>/g) || [];
  if (navReferences.length > 1) failures.push(`${relative}: duplicate universal nav.js scripts (${navReferences.length})`);
  if (navReferences.length === 0 && loaderReferences.length === 0) failures.push(`${relative}: mounts universal navigation but has neither nav.js nor the loader watchdog`);
  if (/src=["'][^"']*nav-main-v\d+\.js/.test(source)) failures.push(`${relative}: directly loads a nav-main module instead of the stable entrypoint`);
}

console.log('Navigation, customer, and owner publishing audit complete.');
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exit(1);
