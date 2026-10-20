import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLE_DEFINITIONS } from './visual-matrix.mjs';

const PROJECT_ID = 'demo-evaraos-ui';
const AUTH_HOST = '127.0.0.1';
const AUTH_PORT = '9099';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = '8080';
const HOSTING_PORT = String(process.env.EVARA_QA_LOCAL_HOSTING_PORT || '5180');
if (!/^\d{4,5}$/.test(HOSTING_PORT) || Number(HOSTING_PORT) < 1024 || Number(HOSTING_PORT) > 65535) {
  throw new Error('EVARA_QA_LOCAL_HOSTING_PORT must be a valid non-privileged local port.');
}
const HOSTING_ORIGIN = `http://127.0.0.1:${HOSTING_PORT}`;
const API_KEY = 'demo-api-key';
const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../..');
const accounts = [];
let matrixSummaryFinalized = false;

function sanitizeFailureText(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/([?&](?:key|token|code|auth|password|secret)=)[^&#\s]+/gi, '$1[redacted]')
    .replace(/\b(password|token|api[_-]?key|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 1400);
}

async function writeMatrixSummary(lines, finalized = true) {
  const summaryPath = process.env.EVARA_QA_FAILURE_SUMMARY?.trim();
  if (!summaryPath) return;
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
  matrixSummaryFinalized = finalized;
}

function requireLocalEmulator(name, value, host, port) {
  const [actualHost, actualPort] = String(value || '').split(':');
  if (actualHost !== host || actualPort !== port) {
    throw new Error(`${name} must be supplied by the local ${PROJECT_ID} emulator.`);
  }
}

function assertSafeEmulatorEnvironment() {
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
    throw new Error(`Refusing to run with non-demo Google Cloud project ${process.env.GCLOUD_PROJECT}.`);
  }
  requireLocalEmulator('FIREBASE_AUTH_EMULATOR_HOST', process.env.FIREBASE_AUTH_EMULATOR_HOST, AUTH_HOST, AUTH_PORT);
  requireLocalEmulator('FIRESTORE_EMULATOR_HOST', process.env.FIRESTORE_EMULATOR_HOST, FIRESTORE_HOST, FIRESTORE_PORT);
}

async function postJson(url, body, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  return payload;
}

function firestoreValue(value) {
  return { stringValue: String(value) };
}

async function createLocalRole(role, runId) {
  const email = `qa-${role.id}-${runId}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const authResult = await postJson(
    `http://${AUTH_HOST}:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { email, password, returnSecureToken: true },
    `Creating ${role.id} Auth Emulator account`
  );
  if (!authResult.localId || !authResult.idToken) throw new Error(`Auth Emulator did not return a ${role.id} account.`);

  const account = { uid: authResult.localId, idToken: authResult.idToken };
  accounts.push(account);

  const companyId = role.id === 'customer' ? '' : `qa-${runId}`;
  const displayName = `QA ${role.id}`;
  const fields = {
    uid: account.uid,
    id: account.uid,
    email,
    displayName,
    fullName: displayName,
    name: displayName,
    username: `qa-${role.id}-${runId}`,
    usernameLower: `qa-${role.id}-${runId}`,
    role: role.id,
    status: 'active',
    approvalStatus: 'approved',
    companyId,
    companyName: companyId ? 'Local QA Company' : ''
  };
  const url = new URL(`/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`, `http://${FIRESTORE_HOST}:${FIRESTORE_PORT}`);
  url.searchParams.set('documentId', account.uid);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer owner'
    },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)])) })
  });
  if (!response.ok) throw new Error(`Seeding ${role.id} Firestore Emulator profile failed with HTTP ${response.status}.`);
  const verificationUrl = new URL(`/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(account.uid)}`, `http://${FIRESTORE_HOST}:${FIRESTORE_PORT}`);
  const verification = await fetch(verificationUrl, {
    headers: { authorization: 'Bearer owner' }
  });
  const verifiedProfile = await verification.json().catch(() => ({}));
  const verifiedRole = verifiedProfile.fields?.role?.stringValue;
  if (!verification.ok || verifiedRole !== role.id) {
    throw new Error(`Firestore Emulator profile verification failed for ${role.id}.`);
  }
  return { role: role.id, email, password };
}

function runPlaywright(environment) {
  const cli = path.resolve(repositoryRoot, 'tests/visual/node_modules/@playwright/test/cli.js');
  const args = [
    cli,
    'test',
    path.resolve(repositoryRoot, 'tests/visual/specs/authenticated-visual.spec.mjs'),
    '--config', path.resolve(repositoryRoot, 'tests/visual/playwright.config.mjs'),
    '--grep-invert', 'visual baselines'
  ];
  const project = process.env.EVARA_QA_LOCAL_PROJECT?.trim();
  const availableProjects = new Set(['desktop-chromium', 'tablet-chromium', 'iphone-webkit', 'android-chromium']);
  if (project && !availableProjects.has(project)) {
    throw new Error('EVARA_QA_LOCAL_PROJECT must name a configured visual QA project.');
  }
  if (project) args.push('--project', project);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repositoryRoot,
      env: environment,
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Local role/device matrix exited ${signal ? `with signal ${signal}` : `with code ${code}`}.`));
    });
  });
}

async function summarizePlaywrightFailures(resultsPath) {
  const report = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
  const failures = [];
  const visit = (suites, parents = []) => {
    for (const suite of suites || []) {
      const pathParts = [...parents, suite.title].filter(Boolean);
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const failedAttempts = (test.results || []).filter((result) => ['failed', 'timedOut', 'interrupted'].includes(result.status));
          if (!failedAttempts.length && test.status !== 'unexpected') continue;
          const error = failedAttempts.flatMap((result) => result.errors || []).find((entry) => entry.message)?.message || 'Unexpected test result.';
          failures.push({
            title: [`[${test.projectName || 'unknown project'}]`, ...pathParts, spec.title].filter(Boolean).join(' › '),
            error: String(error).replace(/\s+/g, ' ').slice(0, 1600)
          });
        }
      }
      visit(suite.suites, pathParts);
    }
  };
  visit(report.suites);
  return failures;
}

async function reportPlaywrightFailures(resultsPath) {
  try {
    const failures = await summarizePlaywrightFailures(resultsPath);
    if (!failures.length) {
      await writeMatrixSummary(['# Local Firebase role matrix', '', 'Result: Playwright failed without test-level failure details.']);
      return;
    }
    const uniqueFailures = new Map();
    for (const failure of failures) {
      const key = `${failure.title}\n${failure.error}`;
      const existing = uniqueFailures.get(key);
      if (existing) existing.attempts += 1;
      else uniqueFailures.set(key, { ...failure, attempts: 1 });
    }
    const distinctFailures = [...uniqueFailures.values()];
    console.error(`Local authenticated matrix failures: ${failures.length} failed attempt(s), ${distinctFailures.length} distinct check(s).`);
    const summary = ['# Local Firebase role matrix', '', `Result: ${failures.length} failed attempt(s), ${distinctFailures.length} distinct check(s).`, ''];
    for (const failure of distinctFailures.slice(0, 40)) {
      console.error(`- ${sanitizeFailureText(failure.title)}: ${sanitizeFailureText(failure.error)}`);
      summary.push(`- ${sanitizeFailureText(failure.title)} (${failure.attempts} attempt(s)): ${sanitizeFailureText(failure.error)}`);
    }
    if (distinctFailures.length > 40) console.error(`- ${distinctFailures.length - 40} additional distinct failures omitted.`);
    await writeMatrixSummary(summary);
  } catch {
    console.error('The local Playwright JSON report was unavailable for failure details.');
    await writeMatrixSummary(['# Local Firebase role matrix', '', 'Result: failed before a usable Playwright failure report was available.']);
  }
}

async function runLocalEmulators() {
  const firebaseConfigPath = path.join(repositoryRoot, `firebase.ui-emulator-${process.pid}.json`);
  const firebaseConfig = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'firebase.json'), 'utf8'));
  delete firebaseConfig.hosting.target;
  firebaseConfig.hosting.site = PROJECT_ID;
  firebaseConfig.emulators.hosting = {
    ...firebaseConfig.emulators.hosting,
    host: '127.0.0.1',
    port: Number(HOSTING_PORT)
  };
  await fs.writeFile(firebaseConfigPath, JSON.stringify(firebaseConfig, null, 2));

  try {
    const exitCode = await new Promise((resolve, reject) => {
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const firebaseArgs = [
        'emulators:exec',
        '--config', path.basename(firebaseConfigPath),
        '--project', PROJECT_ID,
        '--only', 'auth,firestore,hosting',
        'node tests/visual/run-local-emulator-matrix.mjs'
      ];
      const configuredFirebaseCli = process.env.EVARA_QA_FIREBASE_CLI?.trim();
      const command = configuredFirebaseCli || npx;
      const args = configuredFirebaseCli
        ? firebaseArgs
        : ['-y', 'firebase-tools@latest', ...firebaseArgs];
      const child = spawn(command, args, {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          EVARA_QA_LOCAL_HOSTING_PORT: HOSTING_PORT,
          EVARA_QA_LOCAL_EMULATOR_CHILD: '1'
        },
        stdio: 'inherit'
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    if (exitCode !== 0) throw new Error(`Firebase Local Emulator Suite exited with code ${exitCode}.`);
  } finally {
    await fs.rm(firebaseConfigPath, { force: true });
  }
}

async function cleanup() {
  await Promise.allSettled(accounts.flatMap(({ uid, idToken }) => [
    fetch(`http://${FIRESTORE_HOST}:${FIRESTORE_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer owner' }
    }),
    postJson(
      `http://${AUTH_HOST}:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
      { idToken },
      'Deleting local Auth Emulator account'
    )
  ]));
}

async function main() {
  if (process.env.EVARA_QA_LOCAL_EMULATOR_CHILD !== '1') {
    await runLocalEmulators();
    return;
  }

  assertSafeEmulatorEnvironment();
  await writeMatrixSummary(['# Local Firebase role matrix', '', 'Result: runner started; final outcome was not recorded.'], false);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'evaraos-ui-emulator-'));
  const authDir = path.join(tempRoot, 'auth');
  const runId = randomBytes(6).toString('hex');
  const childEnvironment = { ...process.env };

  try {
    for (const role of ROLE_DEFINITIONS) {
      const credentials = await createLocalRole(role, runId);
      childEnvironment[`EVARA_QA_${role.secret}_EMAIL`] = credentials.email;
      childEnvironment[`EVARA_QA_${role.secret}_PASSWORD`] = credentials.password;
    }

    childEnvironment.EVARA_QA_BASE_URL = HOSTING_ORIGIN;
    childEnvironment.EVARA_QA_REQUIRE_ALL_ROLES = '1';
    childEnvironment.EVARA_QA_MATRIX = 'critical';
    childEnvironment.EVARA_QA_CRITICAL_RESPONSIVE = '1';
    childEnvironment.EVARA_QA_AUTH_DIR = authDir;
    childEnvironment.EVARA_QA_OUTPUT_DIR = path.join(tempRoot, 'results');
    delete childEnvironment.EVARA_QA_APP_CHECK_DEBUG_TOKEN;

    console.log('Running the critical nine-role responsive matrix against local Firebase emulators.');
    try {
      await runPlaywright(childEnvironment);
      await writeMatrixSummary([
        '# Local Firebase role matrix',
        '',
        'Result: Playwright completed without test failures.'
      ]);
    } catch (error) {
      await reportPlaywrightFailures(path.join(tempRoot, 'results', 'results.json'));
      throw error;
    }
  } finally {
    await cleanup();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  if (process.env.EVARA_QA_LOCAL_EMULATOR_CHILD === '1' && !matrixSummaryFinalized) {
    writeMatrixSummary(['# Local Firebase role matrix', '', `Result: setup failed. ${sanitizeFailureText(error.message)}`], true).catch(() => {});
  }
  console.error(error.message);
  process.exitCode = 1;
});
