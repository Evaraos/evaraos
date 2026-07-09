'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_AUDITOR_ROLES,
  REQUIRED_SERVICES,
  TOKEN_CREATOR_ROLE,
  evaluateStagingReadiness
} = require('../lib/staging-readiness-policy');

const projectId = 'evaraos-staging-test';
const auditorEmail = `evaraos-access-auditor@${projectId}.iam.gserviceaccount.com`;
const auditorMember = `serviceAccount:${auditorEmail}`;
const operator = 'operator@example.com';

function validInput(overrides = {}) {
  return {
    projectId,
    productionProjectId: 'evaraos-web',
    auditorEmail,
    activeOperator: operator,
    project: { projectId, lifecycleState: 'ACTIVE' },
    projectPolicy: {
      bindings: REQUIRED_AUDITOR_ROLES.map((role) => ({
        role,
        members: [auditorMember]
      }))
    },
    serviceAccount: { email: auditorEmail, disabled: false },
    serviceAccountPolicy: {
      bindings: [{
        role: TOKEN_CREATOR_ROLE,
        members: [`user:${operator}`]
      }]
    },
    keys: [{ keyType: 'SYSTEM_MANAGED', keyOrigin: 'GOOGLE_PROVIDED' }],
    services: REQUIRED_SERVICES.map((name) => ({
      state: 'ENABLED',
      config: { name }
    })),
    ...overrides
  };
}

test('fully constrained staging identity is ready', () => {
  const result = evaluateStagingReadiness(validInput());
  assert.equal(result.status, 'ready_for_staging_audit');
  assert.equal(result.progress, 100);
  assert.deepEqual(result.blockers, []);
});

test('production project is blocked from staging verification', () => {
  const result = evaluateStagingReadiness(validInput({
    projectId: 'evaraos-web',
    project: { projectId: 'evaraos-web', lifecycleState: 'ACTIVE' }
  }));
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.includes('PRODUCTION_PROJECT_BLOCKED'));
});

test('missing viewer role blocks readiness', () => {
  const result = evaluateStagingReadiness(validInput({
    projectPolicy: {
      bindings: [{
        role: 'roles/datastore.viewer',
        members: [auditorMember]
      }]
    }
  }));
  assert.ok(result.blockers.includes('REQUIRED_VIEWER_ROLES_PRESENT'));
});

test('extra project role blocks least-privilege readiness', () => {
  const input = validInput();
  input.projectPolicy.bindings.push({
    role: 'roles/editor',
    members: [auditorMember]
  });
  const result = evaluateStagingReadiness(input);
  assert.ok(result.blockers.includes('NO_EXTRA_PROJECT_ROLES'));
});

test('user-managed key blocks readiness', () => {
  const result = evaluateStagingReadiness(validInput({
    keys: [{ keyType: 'USER_MANAGED', keyOrigin: 'USER_PROVIDED' }]
  }));
  assert.ok(result.blockers.includes('NO_USER_MANAGED_KEYS'));
});

test('additional impersonator blocks readiness', () => {
  const result = evaluateStagingReadiness(validInput({
    serviceAccountPolicy: {
      bindings: [{
        role: TOKEN_CREATOR_ROLE,
        members: [`user:${operator}`, 'user:other@example.com']
      }]
    }
  }));
  assert.ok(result.blockers.includes('TOKEN_CREATOR_SCOPED_TO_OPERATOR'));
});

test('missing API blocks readiness', () => {
  const result = evaluateStagingReadiness(validInput({
    services: REQUIRED_SERVICES
      .filter((name) => name !== 'iamcredentials.googleapis.com')
      .map((name) => ({ state: 'ENABLED', config: { name } }))
  }));
  assert.ok(result.blockers.includes('REQUIRED_SERVICES_ENABLED'));
});

test('inactive project blocks readiness', () => {
  const result = evaluateStagingReadiness(validInput({
    project: { projectId, lifecycleState: 'DELETE_REQUESTED' }
  }));
  assert.ok(result.blockers.includes('PROJECT_EXISTS_AND_ACTIVE'));
});
