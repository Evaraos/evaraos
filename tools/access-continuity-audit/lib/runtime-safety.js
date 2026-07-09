'use strict';

const READ_ONLY_ACK = 'I_UNDERSTAND_THIS_IS_READ_ONLY';
const PRODUCTION_ACK = 'I_APPROVE_HASHED_PRODUCTION_READ_ONLY_AUDIT';
const ALLOWED_ENVIRONMENTS = new Set(['staging', 'production']);

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function assertRuntimeSafety(args = {}, environment = process.env) {
  if (args.ack !== READ_ONLY_ACK) {
    throw new Error(`Missing safety acknowledgement. Pass --ack-read-only ${READ_ONLY_ACK}`);
  }

  if (!args.projectId) throw new Error('A Firebase project ID is required.');

  const targetEnvironment = normalize(args.environment);
  if (!ALLOWED_ENVIRONMENTS.has(targetEnvironment)) {
    throw new Error('Specify --environment staging or --environment production.');
  }

  if (environment.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Static credential-file authentication is blocked. Use short-lived service-account impersonation instead.'
    );
  }

  if (targetEnvironment === 'production') {
    if (args.productionAck !== PRODUCTION_ACK) {
      throw new Error(
        `Production acknowledgement required. Pass --ack-production-read-only ${PRODUCTION_ACK}`
      );
    }
    if (args.includeIdentifiers) {
      throw new Error('Raw identifiers are prohibited in production audits.');
    }
  }

  return {
    environment: targetEnvironment,
    credentialMode: 'application_default_credentials_without_key_file',
    identifiersAllowed: targetEnvironment !== 'production'
  };
}

module.exports = {
  ALLOWED_ENVIRONMENTS,
  PRODUCTION_ACK,
  READ_ONLY_ACK,
  assertRuntimeSafety
};
