'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { assets, pageFailures } = require('./lib/ui-contract.cjs');
const { hasNonCanonicalPageBackdrop } = require('./lib/page-material-audit.cjs');
const home = fs.readFileSync('public/index.html','utf8');

test('actual Home contract passes and valid calculations remain supported', () => {
  assert.deepEqual(pageFailures(home,'index.html'),[]);
  assert.match(fs.readFileSync('public/assets/css/design-system/communications.css','utf8'),/calc\(var\(--communications-swipe-width\)\s*\*\s*-1\)/);
});
test('duplicates cannot hide behind a relative URL or a different cache revision', () => {
  const poisoned = home.replace('</head>', '<link rel="stylesheet" href="./assets/css/theme.css?v=stale"></head>');
  const failures = pageFailures(poisoned,'index.html');
  assert(failures.some(message=>message.includes('found 2')));
  assert(failures.some(message=>message.includes('must use')));
});
test('module consumers cannot silently load an unversioned theme instance', () => {
  assert(pageFailures(home.replace(assets.themeRuntime,'/assets/js/theme.js'),'index.html').some(message=>message.includes('themeRuntime must use')));
});
test('zoom and blocking prepaint are enforced', () => {
  assert(pageFailures(home.replace('viewport-fit=cover','viewport-fit=cover,user-scalable=no'),'index.html').some(message=>message.includes('zoom')));
  assert(pageFailures(home.replace('<script src="'+assets.prepaint,'<script async src="'+assets.prepaint),'index.html').some(message=>message.includes('first paint')));
});
test('only the named compatibility redirect may omit visible UI assets', () => {
  assert.deepEqual(pageFailures(fs.readFileSync('public/settings.html','utf8'),'settings.html'),[]);
  assert(pageFailures('<script>location.replace("/settings-v2.html")</script>','new-page.html').length>0);
  assert(pageFailures('<script>location.replace("/missing.html")</script>','settings.html').length>0);
});

test('comment tokens do not manufacture or count asset tags', () => {
  const fake = '<link rel="stylesheet" href="./assets/css/theme.css?v=stale">';
  assert.deepEqual(pageFailures(home.replace('</head>', '<!-- '+fake+' --></head>'),'index.html'),[]);
  assert.deepEqual(pageFailures(home+'<!-- unfinished '+fake,'index.html'),[]);
  assert(pageFailures(home.replace('</head>', '<!-- ignored -->'+fake+'</head>'),'index.html').some(message=>message.includes('found 2')));
});

test('message and owner-editor text fields have persistent accessible names', () => {
  const messages = fs.readFileSync('public/messages.html','utf8');
  const ownerEditor = fs.readFileSync('public/assets/js/owner-editor.js','utf8');
  assert.match(messages, /<input\b[^>]*id="conversationSearch"[^>]*aria-label="Search conversations"/);
  assert.match(messages, /<textarea\b[^>]*id="messageInput"[^>]*aria-label="Message text"/);
  assert.match(ownerEditor, /<textarea\s+data-owner-editor-text\s+aria-label="Selected content text"/);
});

test('field search has an accessible name and customer balance IDs remain unique', () => {
  const field = fs.readFileSync('public/field.html', 'utf8');
  const commerce = fs.readFileSync('public/customer-commerce.html', 'utf8');
  const commerceDashboard = fs.readFileSync('public/assets/js/customer-commerce-dashboard.js', 'utf8');
  assert.match(field, /<input\b[^>]*id="fieldSearch"[^>]*aria-label="Search assigned work"/);
  assert.match(commerce, /id="customerOutstandingHero"[^>]*data-customer-outstanding/);
  assert.match(commerce, /id="customerOutstanding"[^>]*data-customer-outstanding/);
  assert.equal((commerce.match(/id="customerOutstanding(?:Hero)?"/g) || []).length, 2);
  assert.match(commerce, /customer-commerce-dashboard\.js\?v=3/);
  assert.match(commerceDashboard, /querySelectorAll\('\[data-customer-outstanding\]'\)/);
});

test('changed role routes and dashboard renderers use refreshed entry URLs', () => {
  const expectations = [
    ['public/jobs.html', /assets\/js\/jobs\.js\?v=8/],
    ['public/dispatch.html', /assets\/js\/dispatch\.js\?v=5/],
    ['public/field.html', /assets\/js\/field\.js\?v=3/],
    ['public/leads.html', /assets\/js\/leads-entry\.js\?v=4/],
    ['public/customer-messaging.html', /assets\/js\/customer-messaging-dashboard\.js\?v=1/],
    ['public/marketplace-payouts.html', /assets\/js\/marketplace-payout-dashboard\.js\?v=1/]
  ];
  for (const [path, revision] of expectations) assert.match(fs.readFileSync(path, 'utf8'), revision, `${path} must request its refreshed page module`);
  assert.match(fs.readFileSync('public/assets/js/leads-entry.js', 'utf8'), /leads\.js\?v=6/);
  assert.match(fs.readFileSync('public/assets/js/leads-entry.js', 'utf8'), /lead-job-conversion\.js\?v=3/);
});


test('vendor route policy and navigation expose only rules-permitted account surfaces', () => {
  const access = fs.readFileSync('public/assets/js/access-control.js', 'utf8');
  const dashboard = fs.readFileSync('public/assets/js/dashboard.js', 'utf8');
  const apps = fs.readFileSync('public/assets/js/navigation/app-registry.js', 'utf8');
  const matrix = fs.readFileSync('tests/visual/visual-matrix.mjs', 'utf8');
  assert.match(access, /if \(normalizedRole === 'vendor'\) return '\/settings\/account\.html';/);
  assert.match(access, /'dispatch\.html': \['platform_admin', 'owner', 'admin', 'manager'\]/);
  assert.match(access, /dispatchWork: \['platform_admin', 'owner', 'admin', 'manager'\]/);
  assert.match(access, /'marketplace-payouts\.html': \['platform_admin', 'owner', 'admin'\]/);
  assert.match(dashboard, /if \(bucket === "vendor"\) \{\s*routeTo\(ROUTES\.account\);/);
  assert.match(apps, /id: "dispatch"[^\n]*roles: \["owner", "organization", "admin"\]/);
  assert.doesNotMatch(apps, /id: "(?:jobs|leads|field|schedule|operations-map|service-history)"[^\n]*"vendor"/);
  assert.doesNotMatch(apps, /id: "(?:revenue|ledger)"[^\n]*"vendor"/);
  assert.match(matrix, /id: 'vendor'[\s\S]*?criticalRoutes: \['\/settings\/account\.html', '\/settings\/appearance\.html'\]/);
  assert.doesNotMatch(matrix, /id: 'vendor'[\s\S]*?criticalRoutes:[^\n]*marketplace-payouts/);
});

test('wallpaper focus indicators use two contrasting rings', () => {
  const css = fs.readFileSync('public/assets/css/theme/text-legibility.css', 'utf8');
  assert.match(css, /outline:\s*3px solid #fff/);
  assert.match(css, /box-shadow:\s*0 0 0 6px #111318/);
  assert.match(css, /forced-colors: active[\s\S]*?box-shadow: none !important/);
});

test('same-page drawer navigation restores focus before closing', () => {
  const events = fs.readFileSync('public/assets/js/nav/nav-events.js', 'utf8');
  assert.match(events, /function openNavHref[\s\S]*?closeMenu\(true\);[\s\S]*?navigateWithLoader/);
  const nav = fs.readFileSync('public/assets/js/nav.js', 'utf8');
  assert.match(nav, /nav-main-v6\.js\?v=universal-role-policy-1/);
  const navMain = fs.readFileSync('public/assets/js/nav/nav-main-v6.js', 'utf8');
  const navSession = fs.readFileSync('public/assets/js/nav/nav-session.js', 'utf8');
  assert.match(navMain, /nav-events\.js\?v=universal-role-policy-1/);
  assert.match(navSession, /nav-events\.js\?v=universal-role-policy-1/);
});

test('page glass uses shared theme presets or bounded Studio customization', () => {
  assert.equal(hasNonCanonicalPageBackdrop('.card{backdrop-filter:blur(24px)}'), true);
  assert.equal(hasNonCanonicalPageBackdrop('.card{backdrop-filter:var(--lg-backdrop-elevated)}'), false);
  assert.equal(hasNonCanonicalPageBackdrop('.preview{backdrop-filter:none!important}'), false);
  assert.equal(hasNonCanonicalPageBackdrop('.node{backdrop-filter:blur(calc(var(--node-glass, 72) * 0.45px)) saturate(var(--lg-saturation))}'), false);
  assert.equal(hasNonCanonicalPageBackdrop('.builder{backdrop-filter:blur(var(--studio-glass-blur)) saturate(var(--lg-saturation))}'), false);
  const studioBuilder = fs.readFileSync('public/assets/js/studio/studio-visual-builder.js', 'utf8');
  assert.match(studioBuilder, /clamp\(node\.style\.glass,\s*20,\s*100\)/);
  assert.match(studioBuilder, /Math\.max\(14,\s*state\.theme\.glass\s*\/\s*2\)/);
});
