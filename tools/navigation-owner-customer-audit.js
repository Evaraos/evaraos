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

const contracts = [
  ['public/assets/js/nav.js', './nav/nav-main-v7.js?v=nav-v61-role-authority', 'Nav entry does not boot the stable role-authority runtime'],
  ['public/assets/js/nav.js', './nav/nav-role-lockdown-v2.js?v=2', 'Nav entry does not load actual-role lockdown'],
  ['public/assets/js/nav.js', './app-builder-runtime-v2.js?v=2', 'Nav entry does not load builder runtime v2'],
  ['public/assets/js/nav.js', './owner-publish-runtime-v2.js?v=2', 'Nav entry does not load owner publishing v2'],
  ['public/assets/js/nav/nav-authority-v1.js', 'verified-route-guard-cache', 'Navigation authority misses cached verified sessions'],
  ['public/assets/js/nav/nav-authority-v1.js', 'registryRole', 'Navigation authority does not map to registry roles'],
  ['public/assets/js/nav/nav-utils-v2.js', 'actualRole()', 'Navigation utilities do not use actual role'],
  ['public/assets/js/nav/nav-render-v2.js', 'data-navigation-role', 'Navigation lacks verified-role diagnostics'],
  ['public/assets/js/nav/nav-render-v2.js', 'appsByCategory(registryRole(actualRole))', 'Menu list is not role-only'],
  ['public/assets/js/nav/nav-session-v2.js', 'scheduleRefresh();', 'Navigation misses sessions emitted before boot'],
  ['public/assets/js/access-control-v2.js', "const ULTIMATE_ROLES = new Set(['platform_admin', 'owner'])", 'Owner ultimate access is missing'],
  ['public/assets/js/access-control-v2.js', 'if (ULTIMATE_ROLES.has(normalized)) return Object.keys(FEATURE_POLICY)', 'Owner lacks all registered features'],
  ['public/assets/js/route-guard-v2.js', "source: 'verified-route-guard-cache'", 'Route guard lacks exact-UID cache fallback'],
  ['public/assets/js/route-guard-v2.js', 'profile: session.profile', 'Route guard does not publish verified profile'],
  ['public/assets/js/route-guard-v2.js', 'uid === user.uid', 'Cached profile is not tied to Firebase UID'],
  ['public/assets/js/customer-portal-v4.js', "where(field, '==', uid)", 'Customer portal queries are not UID scoped'],
  ['public/assets/js/customer-portal-v4.js', 'state.successfulQueries === 0 && state.queryFailures.length', 'Customer portal cannot distinguish failure from empty history'],
  ['public/assets/js/owner-publish-runtime-v2.js', "type: 'global'", 'Owner global publishing scope is missing'],
  ['public/assets/js/owner-publish-runtime-v2.js', "currentRole === 'admin' && id", 'Admin company requirement is missing'],
  ['public/assets/js/owner-publish-runtime-v2.js', 'No company workspace is required', 'Owner UI still requires a company'],
  ['public/assets/js/app-builder-runtime-v2.js', "doc(db, 'public_app_config', 'global')", 'Builder does not load global owner settings'],
  ['public/assets/js/app-builder-runtime-v2.js', 'mergeConfig(globalConfig, companyConfig)', 'Company settings do not layer over global settings'],
  ['firebase/firestore.rules', 'match /public_app_config/{id}', 'Firestore global config rule is missing'],
  ['firebase/firestore.rules', "hasOnly(['appBuilder','appBuilderUpdatedAt'])", 'Admin updates are not appBuilder-only'],
  ['public/assets/js/adaptive-appearance-boot.js', 'NAV_FALLBACK_SRC', 'Universal appearance boot lacks nav recovery'],
  ['public/assets/js/loader.js', "import('/assets/js/nav.js", 'Loader watchdog lacks nav recovery']
];
for (const [file, marker, message] of contracts) requireText(read(file), marker, message);

forbidText(read('public/assets/js/nav/nav-authority-v1.js'), 'evaraos-preview-role', 'Navigation authority trusts Studio preview role');
forbidText(read('public/assets/js/nav/nav-utils-v2.js'), 'evaraos-preview-role', 'Navigation utilities trust Studio preview role');
forbidText(read('public/assets/js/nav/nav-role-lockdown-v2.js'), 'previewRole', 'Navigation lockdown changes for preview role');
forbidText(read('public/assets/js/nav/nav-session-v2.js'), 'evara:role-preview', 'Navigation rebuilds from preview events');
forbidText(read('public/assets/js/customer-portal-v4.js'), 'fetchAllCollection', 'Customer portal performs unrestricted collection reads');

const portal = read('public/assets/js/customer-portal-v4.js');
for (const name of ['jobs','customer_services','subscriptions','customer_service_history']) requireText(portal, `'${name}'`, `Customer portal omits ${name}`);
for (const field of ['customerUid','customerId','userId']) requireText(portal, `'${field}'`, `Customer portal omits ownership field ${field}`);

const publicRoot = path.join(root, 'public');
for (const absolute of walk(publicRoot).filter((file) => file.endsWith('.html'))) {
  const source = fs.readFileSync(absolute, 'utf8');
  if (!/id=["']universalNavRoot["']/.test(source)) continue;
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  const navRefs = source.match(/<script[^>]+src=["'][^"']*\/assets\/js\/nav\.js(?:\?[^"']*)?["'][^>]*>/g) || [];
  const loaderRefs = source.match(/<script[^>]+src=["'][^"']*\/assets\/js\/loader\.js(?:\?[^"']*)?["'][^>]*>/g) || [];
  const bootRefs = source.match(/<script[^>]+src=["'][^"']*\/assets\/js\/adaptive-appearance-boot\.js(?:\?[^"']*)?["'][^>]*>/g) || [];
  if (navRefs.length > 1) failures.push(`${relative}: duplicate universal nav.js scripts (${navRefs.length})`);
  if (!navRefs.length && !loaderRefs.length && !bootRefs.length) failures.push(`${relative}: universal nav mount has no canonical boot path`);
  if (/src=["'][^"']*nav-main-v\d+\.js/.test(source)) failures.push(`${relative}: directly loads a nav-main module`);
}

console.log('Navigation, customer, and owner publishing audit complete.');
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exit(1);
