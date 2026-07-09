'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targets = [
  path.join(__dirname, 'index.js'),
  path.join(__dirname, 'internal-audit.js'),
  path.join(__dirname, 'staging-readiness.js'),
  path.join(__dirname, 'demo.js'),
  path.join(__dirname, 'lib', 'runtime-safety.js'),
  path.join(__dirname, 'lib', 'staging-readiness-policy.js')
];
const source = targets.map((target) => fs.readFileSync(target, 'utf8')).join('\n');
const forbidden = [
  /setCustomUserClaims\s*\(/,
  /revokeRefreshTokens\s*\(/,
  /auth\.createUser\s*\(/,
  /auth\.updateUser\s*\(/,
  /auth\.deleteUser\s*\(/,
  /db\.doc\s*\(/,
  /runTransaction\s*\(/,
  /\.batch\s*\(/,
  /bulkWriter\s*\(/,
  /FieldValue\.(delete|increment|arrayUnion|arrayRemove)\s*\(/,
  /\.collection\([^)]*\)\.add\s*\(/,
  /add-iam-policy-binding/,
  /remove-iam-policy-binding/,
  /set-iam-policy/,
  /service-accounts['"],\s*['"]create/,
  /service-accounts['"],\s*['"]delete/,
  /services['"],\s*['"]enable/,
  /services['"],\s*['"]disable/,
  /projects['"],\s*['"]delete/,
  /firebase['"],\s*['"]deploy/
];

const violations = forbidden.filter((pattern) => pattern.test(source));
if (violations.length) {
  console.error('Read-only verification failed:', violations.map(String));
  process.exit(1);
}

const requiredReadOperations = [
  /auth\.listUsers\s*\(/,
  /\.collection\s*\(/,
  /\.get\s*\(/,
  /get-iam-policy/,
  /keys['"],\s*['"]list/,
  /services['"],\s*['"]list/
];

const missingReadOperations = requiredReadOperations.filter(
  (pattern) => !pattern.test(source)
);
if (missingReadOperations.length) {
  console.error(
    'Read-only verification failed: expected read operations are missing.',
    missingReadOperations.map(String)
  );
  process.exit(1);
}

if (!/GOOGLE_APPLICATION_CREDENTIALS/.test(source)) {
  console.error('Read-only verification failed: static-key blocking is missing.');
  process.exit(1);
}

if (!/I_APPROVE_HASHED_PRODUCTION_READ_ONLY_AUDIT/.test(source)) {
  console.error('Read-only verification failed: production acknowledgement is missing.');
  process.exit(1);
}

if (!/describe_get_policy_and_list_only/.test(source)) {
  console.error('Read-only verification failed: staging command policy marker is missing.');
  process.exit(1);
}

console.log('Read-only verification passed: Firebase reads, staging command allowlist, and production safety gates detected.');
