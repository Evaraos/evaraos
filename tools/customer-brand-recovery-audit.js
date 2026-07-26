#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const bytes = (relative) => fs.readFileSync(path.join(root, relative));
const requireText = (source, marker, message) => { if (!source.includes(marker)) failures.push(message); };

function assertPng(relative, label) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing ${label}: ${relative}`);
    return null;
  }
  const data = bytes(relative);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 1024) failures.push(`${label} is unexpectedly small: ${data.length} bytes`);
  if (!data.subarray(0, 8).equals(signature)) failures.push(`${label} is not a PNG payload`);
  return data;
}

const logo = assertPng('public/assets/img/evaraos_logo.png', 'OG PNG logo');
const markAlias = assertPng('public/assets/brand/evaraos-mark.png', 'visible-logo compatibility alias');
const icon = assertPng('public/assets/brand/evaraos-app-icon.png', 'E PNG app icon');
if (logo && markAlias && !logo.equals(markAlias)) failures.push('evaraos-mark.png must be a byte-for-byte alias of the OG PNG logo');
if (logo && icon && logo.equals(icon)) failures.push('The OG PNG logo and E PNG app icon must remain different assets');

const loader = read('public/assets/js/loader.js');
requireText(loader, "const BRAND_VERSION = 'brand-contract-2'", 'Loader brand contract version is missing');
requireText(loader, 'evaraos_logo.png?v=${BRAND_VERSION}', 'Loader does not use the OG PNG for visible branding');
requireText(loader, 'evaraos-app-icon.png?v=${BRAND_VERSION}', 'Loader does not use the E PNG for icon surfaces');
requireText(loader, "[data-evaraos-brand-logo],.sidebar-logo,.brand-logo,.login-badge", 'Loader does not repair visible logo surfaces');
if (loader.includes("startsWith('evaraos-app-builder-v1:')")) failures.push('Brand migration still deletes unrelated App Builder cache');

const home = read('public/index.html');
requireText(home, 'data-evaraos-brand-logo src="/assets/img/evaraos_logo.png?v=brand-contract-2"', 'Homepage first paint does not use the OG PNG logo');
requireText(home, 'href="/assets/brand/evaraos-app-icon.png?v=brand-contract-2"', 'Homepage icon links do not use the E PNG');

const manifest = JSON.parse(read('public/manifest.json'));
const manifestIcons = [...(manifest.icons || []), ...(manifest.shortcuts || []).flatMap((item) => item.icons || [])];
if (!manifestIcons.length) failures.push('Manifest has no icon declarations');
for (const item of manifestIcons) {
  if (item.src !== '/assets/brand/evaraos-app-icon.png?v=brand-contract-2') failures.push(`Manifest contains a noncanonical icon: ${item.src || 'missing'}`);
}

const iconStudio = read('public/assets/js/app-icon-studio-single-source.js');
if (/const\s+ICON\s*=\s*['"]data:image\//.test(iconStudio)) failures.push('App Icon Studio still embeds a legacy official image');
requireText(iconStudio, "const OFFICIAL_ICON = '/assets/brand/evaraos-app-icon.png?v=' + BRAND_VERSION", 'App Icon Studio does not use the E PNG');
const iconGuard = read('public/assets/js/app-icon-studio-final-guard.js');
if (iconGuard.includes('findEmbeddedOfficialIcon')) failures.push('Icon guard still promotes an embedded image');
if (iconGuard.includes('new MutationObserver')) failures.push('Icon guard still uses a mutation overwrite loop');
if (iconGuard.includes('setTimeout(repair')) failures.push('Icon guard still uses timed overwrite loops');
const preferences = read('public/assets/js/app-icon-preferences.js');
if (preferences.includes('URL.createObjectURL(new Blob')) failures.push('Icon preferences still replace the static manifest with a blob URL');

const routeGuard = read('public/assets/js/route-guard.js');
requireText(routeGuard, 'window.EvaraRouteSession = session', 'Route guard does not publish the verified route session');
requireText(routeGuard, "source: 'verified-route-guard'", 'Route guard does not identify verified private sessions');
const portal = read('public/assets/js/customer-portal-v2.js');
requireText(portal, 'filters: [{ field, op: "==", value: identity }]', 'Customer portal does not issue UID-scoped Firestore queries');
if (portal.includes('safeFetch("users")') || portal.includes("safeFetch('users')")) failures.push('Customer portal still downloads the entire users collection');
if (portal.includes('fetchAllCollection(collectionName, { max: 500 })')) failures.push('Customer portal still performs unrestricted collection reads');
requireText(portal, 'function showPortalFailure(message)', 'Customer portal has no visible failure state');
requireText(portal, 'PORTAL_TIMEOUT_MS = 12_000', 'Customer portal blank-screen timeout is missing');
const customerPage = read('public/customer_dashboard.html');
requireText(customerPage, '/assets/js/customer-portal-v2.js?v=2', 'Customer dashboard does not load repaired portal v2');
requireText(customerPage, '/assets/js/route-guard.js?v=36', 'Customer dashboard does not load verified-session route guard');

console.log('Customer and brand recovery audit complete.');
console.log('Contract: OG PNG logo for visible branding; E PNG for app/icon surfaces.');
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exit(1);
