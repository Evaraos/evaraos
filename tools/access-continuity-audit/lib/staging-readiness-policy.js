'use strict';

const crypto = require('node:crypto');

const REQUIRED_AUDITOR_ROLES = Object.freeze([
  'roles/firebaseauth.viewer',
  'roles/datastore.viewer'
]);

const REQUIRED_SERVICES = Object.freeze([
  'iamcredentials.googleapis.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com'
]);

const TOKEN_CREATOR_ROLE = 'roles/iam.serviceAccountTokenCreator';

function normalize(value = '') {
  return String(value || '').trim();
}

function hashIdentity(value = '') {
  return crypto.createHash('sha256')
    .update(normalize(value).toLowerCase())
    .digest('hex')
    .slice(0, 16);
}

function membersForRole(policy = {}, role = '') {
  const members = new Set();
  for (const binding of policy.bindings || []) {
    if (binding?.role !== role) continue;
    for (const member of binding.members || []) members.add(String(member));
  }
  return [...members].sort();
}

function rolesForMember(policy = {}, member = '') {
  const roles = new Set();
  for (const binding of policy.bindings || []) {
    if ((binding.members || []).includes(member)) roles.add(String(binding.role));
  }
  return [...roles].sort();
}

function enabledServiceNames(services = []) {
  return new Set(services
    .filter((service) => !service?.state || service.state === 'ENABLED')
    .map((service) => String(service.config?.name || service.name || ''))
    .filter(Boolean));
}

function userManagedKeys(keys = []) {
  return keys.filter((key) => {
    const keyType = String(key.keyType || '').toUpperCase();
    const keyOrigin = String(key.keyOrigin || '').toUpperCase();
    return keyType === 'USER_MANAGED'
      || keyOrigin === 'USER_PROVIDED'
      || keyOrigin === 'USER_MANAGED';
  });
}

function check(id, passed, message, details = {}) {
  return Object.freeze({ id, passed: Boolean(passed), message, details });
}

function evaluateStagingReadiness(input = {}) {
  const projectId = normalize(input.projectId);
  const productionProjectId = normalize(input.productionProjectId || 'evaraos-web');
  const auditorEmail = normalize(input.auditorEmail);
  const auditorMember = auditorEmail ? `serviceAccount:${auditorEmail}` : '';
  const activeOperator = normalize(input.activeOperator);
  const operatorMember = activeOperator ? `user:${activeOperator}` : '';
  const project = input.project || null;
  const projectPolicy = input.projectPolicy || {};
  const serviceAccount = input.serviceAccount || null;
  const serviceAccountPolicy = input.serviceAccountPolicy || {};
  const keys = input.keys || [];
  const services = enabledServiceNames(input.services || []);

  const directRoles = rolesForMember(projectPolicy, auditorMember);
  const missingRoles = REQUIRED_AUDITOR_ROLES.filter((role) => !directRoles.includes(role));
  const unexpectedRoles = directRoles.filter((role) => !REQUIRED_AUDITOR_ROLES.includes(role));
  const tokenCreators = membersForRole(serviceAccountPolicy, TOKEN_CREATOR_ROLE);
  const unexpectedTokenCreators = tokenCreators.filter((member) => member !== operatorMember);
  const missingServices = REQUIRED_SERVICES.filter((service) => !services.has(service));
  const persistentKeys = userManagedKeys(keys);

  const checks = [
    check(
      'STAGING_PROJECT_ID_PRESENT',
      Boolean(projectId),
      projectId ? 'Staging project ID is present.' : 'Staging project ID is missing.'
    ),
    check(
      'PRODUCTION_PROJECT_BLOCKED',
      Boolean(projectId) && projectId !== productionProjectId,
      projectId === productionProjectId
        ? 'Production project was supplied where staging is required.'
        : 'Project is separate from production.',
      { productionProjectId }
    ),
    check(
      'PROJECT_EXISTS_AND_ACTIVE',
      Boolean(project) && String(project.lifecycleState || 'ACTIVE') === 'ACTIVE',
      project
        ? `Project lifecycle state is ${project.lifecycleState || 'ACTIVE'}.`
        : 'Google Cloud project was not found.'
    ),
    check(
      'AUDITOR_SERVICE_ACCOUNT_EXISTS',
      Boolean(serviceAccount?.email) && serviceAccount.email === auditorEmail,
      serviceAccount?.email
        ? 'Dedicated staging auditor service account exists.'
        : 'Dedicated staging auditor service account is missing.',
      { auditorEmail }
    ),
    check(
      'REQUIRED_VIEWER_ROLES_PRESENT',
      missingRoles.length === 0,
      missingRoles.length
        ? 'One or more required viewer roles are missing.'
        : 'Both required viewer roles are present.',
      { requiredRoles: REQUIRED_AUDITOR_ROLES, missingRoles }
    ),
    check(
      'NO_EXTRA_PROJECT_ROLES',
      unexpectedRoles.length === 0,
      unexpectedRoles.length
        ? 'Auditor has unexpected project-level roles.'
        : 'Auditor has no extra project-level roles.',
      { directRoles, unexpectedRoles }
    ),
    check(
      'NO_USER_MANAGED_KEYS',
      persistentKeys.length === 0,
      persistentKeys.length
        ? 'Persistent user-managed service-account keys exist.'
        : 'No persistent user-managed keys were found.',
      { userManagedKeyCount: persistentKeys.length }
    ),
    check(
      'ACTIVE_OPERATOR_IDENTIFIED',
      Boolean(activeOperator),
      activeOperator
        ? 'An active human gcloud operator is identified.'
        : 'No active human gcloud operator was found.',
      { operatorHash: activeOperator ? hashIdentity(activeOperator) : '' }
    ),
    check(
      'TOKEN_CREATOR_SCOPED_TO_OPERATOR',
      Boolean(operatorMember)
        && tokenCreators.includes(operatorMember)
        && unexpectedTokenCreators.length === 0,
      !tokenCreators.includes(operatorMember)
        ? 'Active operator cannot impersonate the auditor.'
        : unexpectedTokenCreators.length
          ? 'Additional principals can impersonate the auditor.'
          : 'Token Creator is scoped only to the active operator.',
      {
        operatorHash: activeOperator ? hashIdentity(activeOperator) : '',
        tokenCreatorCount: tokenCreators.length,
        unexpectedTokenCreatorCount: unexpectedTokenCreators.length
      }
    ),
    check(
      'REQUIRED_SERVICES_ENABLED',
      missingServices.length === 0,
      missingServices.length
        ? 'Required staging APIs are not all enabled.'
        : 'Required staging APIs are enabled.',
      { requiredServices: REQUIRED_SERVICES, missingServices }
    )
  ];

  const passed = checks.filter((item) => item.passed).length;
  const progress = Math.round((passed / checks.length) * 100);
  const blockers = checks.filter((item) => !item.passed).map((item) => item.id);

  return Object.freeze({
    status: blockers.length ? 'blocked' : 'ready_for_staging_audit',
    progress,
    passedChecks: passed,
    totalChecks: checks.length,
    projectId,
    auditorEmail,
    operatorHash: activeOperator ? hashIdentity(activeOperator) : '',
    checks,
    blockers
  });
}

module.exports = {
  REQUIRED_AUDITOR_ROLES,
  REQUIRED_SERVICES,
  TOKEN_CREATOR_ROLE,
  enabledServiceNames,
  evaluateStagingReadiness,
  membersForRole,
  rolesForMember,
  userManagedKeys
};
