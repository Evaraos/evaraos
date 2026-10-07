'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { assets, pageFailures } = require('./lib/ui-contract.cjs');
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
