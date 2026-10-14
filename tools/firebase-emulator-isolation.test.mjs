import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createFirebaseRuntimeConfig,
  FIREBASE_EMULATOR_PROJECT_ID,
  isFirebaseEmulatorHost
} from '../public/assets/js/firebase-runtime-config.mjs';
import {
  FIREBASE_PRODUCTION_REQUEST_PATTERN,
  installLocalFirebaseNetworkGuard,
  isFirebaseProductionServiceHost
} from '../tests/visual/local-emulator-safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('loopback hosts select an isolated demo Firebase project', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    assert.equal(isFirebaseEmulatorHost(host), true);
    const config = createFirebaseRuntimeConfig(host);
    assert.equal(config.projectId, FIREBASE_EMULATOR_PROJECT_ID);
    assert.match(config.projectId, /^demo-/);
    assert.equal(config.apiKey, 'demo-api-key');
    assert.notEqual(config.projectId, 'evaraos-web');
  }
});

test('non-loopback hosts retain the exact production Firebase app configuration', () => {
  assert.equal(isFirebaseEmulatorHost('evaraos.com'), false);
  assert.equal(isFirebaseEmulatorHost('qa.evaraos.com'), false);
  assert.equal(isFirebaseEmulatorHost('192.168.1.20'), false);
  assert.deepEqual(createFirebaseRuntimeConfig('evaraos.com'), {
    apiKey: 'AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4',
    authDomain: 'evaraos-web.firebaseapp.com',
    projectId: 'evaraos-web',
    storageBucket: 'evaraos-web.firebasestorage.app',
    messagingSenderId: '125377381598',
    appId: '1:125377381598:web:d63df45da3a09f0199ae4f',
    measurementId: 'G-296N94CKPR'
  });
});

test('the browser connects all supported data services to local emulators only', () => {
  const firebase = read('public/assets/js/firebase.js');
  for (const connection of [
    'connectAuthEmulator(auth, `http://${host}:9099`',
    'connectFirestoreEmulator(db, host, 8080)',
    'connectFunctionsEmulator(functions, host, 5001)',
    'connectStorageEmulator(storage, host, 9199)'
  ]) {
    assert.ok(firebase.includes(connection), `Missing local emulator connection: ${connection}`);
  }
  assert.match(firebase, /isFirebaseEmulatorRuntime\s*=\s*isFirebaseEmulatorHost\(host\)/);
  assert.match(firebase, /if\s*\(!appCheck\s*&&\s*!isFirebaseEmulatorRuntime\)/);
  assert.match(read('firebase.json'), /"auth"\s*:\s*\{\s*"port"\s*:\s*9099/);
  assert.match(read('firebase.json'), /"firestore"\s*:\s*\{\s*"port"\s*:\s*8080/);
  assert.match(read('firebase.json'), /"functions"\s*:\s*\{\s*"port"\s*:\s*5001/);
  assert.match(read('firebase.json'), /"storage"\s*:\s*\{\s*"port"\s*:\s*9199/);
  assert.match(read('firebase.json'), /"hosting"\s*:\s*\{\s*"target"\s*:\s*"production"/);
  assert.match(read('firebase.json'), /"port"\s*:\s*5000/);
  const localRunner = read('tests/visual/run-local-emulator-matrix.mjs');
  assert.match(localRunner, /delete firebaseConfig\.hosting\.target/);
  assert.match(localRunner, /firebaseConfig\.hosting\.site = PROJECT_ID/);
  assert.match(localRunner, /EVARA_QA_LOCAL_EMULATOR_CHILD/);
});

test('local mode does not register push tokens or load production messaging in its service worker', () => {
  const push = read('public/assets/js/push-notifications-client.js');
  const serviceWorker = read('public/firebase-messaging-sw.js');
  assert.match(push, /import\s+\{\s*isFirebaseEmulatorHost\s*\}\s+from\s+["']\.\/firebase-runtime-config\.mjs\?v=1["']/);
  assert.doesNotMatch(push, /isFirebaseEmulatorRuntime\s*\}\s*from\s+["']\.\/firebase\.js/);
  assert.match(push, /if\s*\(isFirebaseEmulatorRuntime\)\s*\{[\s\S]*?return\s+"unavailable"/);
  assert.match(push, /if\s*\(isFirebaseEmulatorRuntime\)\s*\{[\s\S]*?return\s+stopPushNotifications/);
  assert.match(push, /"Notification"\s+in\s+window\s*\?\s*Notification\.permission\s*:\s*["']unsupported["']/);
  assert.match(push, /if\s*\(!\(["']Notification["']\s+in\s+window\)\)\s*\{[\s\S]*?dispatchStatus\(["']unsupported["']/);
  assert.match(serviceWorker, /if\s*\(!isLocalFirebaseEmulator\)\s*\{[\s\S]*?importScripts\(["']https:\/\/www\.gstatic\.com\/firebasejs/);
  assert.match(serviceWorker, /projectId:\s*["']evaraos-web["']/);
});

test('the local browser guard blocks Firebase production APIs without blocking unrelated Google APIs', () => {
  for (const hostname of [
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firestore.googleapis.com',
    'firebasestorage.googleapis.com',
    'us-central1-evaraos-web.cloudfunctions.net',
    'evaraos-web.firebaseapp.com',
    'evaraos-web.firebasestorage.app',
    'evaraos-web.web.app',
    'evaraos-web.appspot.com'
  ]) {
    assert.equal(isFirebaseProductionServiceHost(hostname), true, `${hostname} must be blocked`);
  }
  assert.equal(isFirebaseProductionServiceHost('maps.googleapis.com'), false);
  assert.equal(isFirebaseProductionServiceHost('www.gstatic.com'), false);
  assert.equal(FIREBASE_PRODUCTION_REQUEST_PATTERN.test('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel'), true);
  assert.equal(FIREBASE_PRODUCTION_REQUEST_PATTERN.test('https://us-central1-evaraos-web.cloudfunctions.net/reviewStaffApplication'), true);
  assert.equal(FIREBASE_PRODUCTION_REQUEST_PATTERN.test('http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel'), false);
  assert.equal(FIREBASE_PRODUCTION_REQUEST_PATTERN.test('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'), false);
  assert.equal(FIREBASE_PRODUCTION_REQUEST_PATTERN.test('https://maps.googleapis.com/maps/api/js'), false);
  assert.equal(FIREBASE_PRODUCTION_REQUEST_PATTERN.test('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'), false);
});

test('the browser guard registers one targeted production-Firebase route only for loopback origins', async () => {
  const registrations = [];
  const page = { route: async (pattern, handler) => registrations.push({ pattern, handler }) };
  assert.equal(await installLocalFirebaseNetworkGuard(page, 'http://localhost:5180'), true);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].pattern, FIREBASE_PRODUCTION_REQUEST_PATTERN);
  assert.equal(await installLocalFirebaseNetworkGuard(page, 'https://qa.evaraos.com'), false);
  assert.equal(registrations.length, 1);
});

test('authenticated QA failure diagnostics omit account identifiers and login text', () => {
  const setup = read('tests/visual/global-setup.mjs');
  assert.match(setup, /hasUserId:\s*Boolean\(session\.userId\)/);
  assert.match(setup, /hasLoginMessage:\s*Boolean\(/);
  assert.doesNotMatch(setup, /routeSession:\s*window\.EvaraRouteSession/);
  assert.doesNotMatch(setup, /loginMessage:\s*document\.querySelector/);
});

test('Universal UI CI runs the role matrix with isolated demo emulators', () => {
  const workflow = read('.github/workflows/universal-ui-validation.yml');
  assert.match(workflow, /local-emulator-role-matrix:/);
  assert.match(workflow, /uses:\s*actions\/setup-java@v4[\s\S]*?java-version:\s*'21'/);
  assert.match(workflow, /firebase-tools@15\.33\.0/);
  assert.match(workflow, /EVARA_QA_FIREBASE_CLI:\s*firebase/);
  assert.match(workflow, /node tests\/visual\/run-local-emulator-matrix\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v4[\s\S]*?universal-ui-role-matrix-summary/);
  assert.match(workflow, /EVARA_QA_FAILURE_SUMMARY/);
  const runner = read('tests/visual/run-local-emulator-matrix.mjs');
  assert.match(runner, /sanitizeFailureText/);
  assert.match(runner, /writeMatrixSummary/);
  assert.match(runner, /distinct check\(s\)/);
  assert.match(runner, /new Map\(\)/);
  assert.match(runner, /await runPlaywright\(childEnvironment\);[\s\S]*?await writeMatrixSummary\([\s\S]*?completed without test failures/);
  assert.match(runner, /Result: Playwright failed without test-level failure details/);
  const visualSpec = read('tests/visual/specs/authenticated-visual.spec.mjs');
  assert.match(visualSpec, /EVARA_QA_LOCAL_EMULATOR_CHILD === '1'[\s\S]*?page\.route\(\(url\) => url\.origin === 'http:\/\/127\.0\.0\.1:5001'[\s\S]*?getMarketplaceCommerceSnapshot/);
  assert.match(visualSpec, /access-control-allow-headers.*requestedHeaders/);
});
