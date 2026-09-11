#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function check(condition, message) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    console.error(`FAIL: ${message}`);
    failures.push(message);
  }
}

const runtimePath = 'public/assets/js/experience/experience-runtime.js';
const loaderPath = 'public/assets/js/loader.js';
const navPath = 'public/assets/js/nav.js';
const homePath = 'public/index.html';
const firebasePath = 'firebase.json';

for (const file of [runtimePath, loaderPath, navPath, homePath, firebasePath]) {
  check(fs.existsSync(path.join(root, file)), `${file} exists`);
}

if (!failures.length) {
  const runtime = read(runtimePath);
  const loader = read(loaderPath);
  const nav = read(navPath);
  const home = read(homePath);
  const firebase = JSON.parse(read(firebasePath));

  check(runtime.includes("EXPERIENCE_VERSION = 'experience-runtime-v1'"), 'runtime has one canonical version');
  check(runtime.includes("CACHE_KEY = 'evaraos-experience-config-v1'"), 'runtime uses the canonical first-paint cache');
  check(runtime.includes("ENDPOINT = '/__experience/config'"), 'runtime reads the same-origin published endpoint');
  check(runtime.includes('config: mergeObjects(DEFAULT_CONFIG, raw.config)'), 'runtime deep-merges published configuration with safe defaults');
  check(runtime.includes("document.querySelectorAll('[data-experience-text]')"), 'runtime applies registered text slots only');
  check(runtime.includes("document.querySelectorAll('[data-experience-image]')"), 'runtime applies registered media slots only');
  check(runtime.includes("document.querySelectorAll('[data-experience-style]')"), 'runtime applies registered style slots only');
  check(runtime.includes('function preserveVisibleBoot(config)'), 'disabled welcome presentation preserves visible canonical boot progress');
  check(runtime.includes('window.EvaraLoader?.showFastLoader?.()'), 'runtime delegates fallback progress to the canonical loader');
  check(!runtime.includes('MutationObserver'), 'runtime does not observe the full DOM');
  check(!runtime.includes('innerHTML'), 'runtime does not inject arbitrary HTML');
  check(!/eval\(|new Function\(/.test(runtime), 'runtime does not execute dynamic code');
  check(!/firebase-(?:app|auth|firestore|storage)|gstatic\.com\/firebasejs|getFirestore|setDoc|addDoc|updateDoc|uploadBytes/i.test(runtime), 'public runtime has no Firebase SDK or direct write authority');
  check(runtime.includes("window.addEventListener('evara:nav-ready', scheduleApply)"), 'runtime reapplies only on explicit lifecycle events');
  check(runtime.includes('requestAnimationFrame'), 'runtime batches slot application by animation frame');

  check(loader.includes("EXPERIENCE_CACHE_KEY=\"evaraos-experience-config-v1\""), 'loader reads the same canonical cache');
  check(loader.includes('configureExperience'), 'loader exposes one configuration handoff');
  check(loader.includes("addEventListener('evara:experience-config'"), 'loader accepts published configuration events');
  check(loader.includes("minimumMs:450"), 'welcome default remains 450 ms');
  check(loader.includes("delayMs:20"), 'internal navigation delay remains 20 ms');
  check(loader.includes("resume:{enabled:false"), 'blocking resume loader remains disabled by default');
  check(loader.includes('FORCE_UNLOCK=3500'), 'hard loader fallback remains 3.5 seconds');
  check(loader.includes('WATCHDOG_MS=1200'), 'shell watchdog remains 1.2 seconds');
  check((loader.match(/function configureExperience/g) || []).length === 1, 'loader has exactly one Experience configuration authority');

  check((nav.match(/experience\/experience-runtime\.js/g) || []).length === 1, 'canonical nav imports the Experience runtime exactly once');

  const requiredHomeSlots = [
    'home.kicker',
    'home.title',
    'home.subtitle',
    'home.primaryAction',
    'home.secondaryAction'
  ];
  requiredHomeSlots.forEach((slot) => {
    check(home.includes(`data-experience-text="${slot}"`), `homepage registers ${slot}`);
  });
  check(home.includes('evaraos-experience-config-v1'), 'homepage loader preboot reads the Experience cache');
  check(home.includes('var(--evara-loader-background,#eef5fb)'), 'homepage pre-rendered loader uses the configured background variable');
  check(home.includes('var(--evara-loader-radius,34px)'), 'homepage pre-rendered loader uses the configured radius variable');
  check(home.includes('var(--evara-loader-mark-size,42px)'), 'homepage pre-rendered loader uses the configured mark-size variable');

  const rewrites = firebase.hosting?.rewrites || [];
  const endpointIndex = rewrites.findIndex((rewrite) => rewrite.source === '/__experience/config');
  const endpoint = rewrites[endpointIndex];
  const deployment = read('public/assets/js/experience/experience-deployment.js');
  const mode = deployment.match(/EXPERIENCE_DELIVERY = '(hosting|functions)'/)?.[1];
  check(Boolean(mode), 'Experience delivery mode is explicit and recognized');
  if (mode === 'hosting') {
    check(endpoint?.destination === '/assets/config/experience.json' && !endpoint.function, 'Spark serves configuration from the checked-in Hosting asset');
    const payload = JSON.parse(read('public/assets/config/experience.json'));
    check(payload.schemaVersion === 'evara.experience.v1' && payload.publishedVersion === 0 && JSON.stringify(payload.config) === '{}', 'static delivery uses canonical defaults without claiming a server publication');
  } else {
    check(endpoint?.function?.functionId === 'getPublicExperienceConfig' && !endpoint.destination, 'online delivery uses the trusted Experience function');
  }
  const catchAllIndex = rewrites.findIndex((rewrite) => rewrite.source === '**');
  check(endpointIndex >= 0, 'Hosting exposes the published Experience endpoint');
  check(catchAllIndex < 0 || endpointIndex < catchAllIndex, 'Experience endpoint precedes the SPA catch-all');
}

if (failures.length) {
  console.error(`\nExperience runtime audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nRegistered-slot Experience runtime audit passed.');
