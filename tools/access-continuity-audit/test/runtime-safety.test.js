'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCTION_ACK,
  READ_ONLY_ACK,
  assertRuntimeSafety
} = require('../lib/runtime-safety');

function args(overrides = {}) {
  return {
    projectId: 'evaraos-web',
    environment: 'staging',
    includeIdentifiers: false,
    ack: READ_ONLY_ACK,
    productionAck: '',
    ...overrides
  };
}

test('staging allows hashed read-only execution', () => {
  const result = assertRuntimeSafety(args(), {});
  assert.equal(result.environment, 'staging');
});

test('static service-account key files are always blocked', () => {
  assert.throws(
    () => assertRuntimeSafety(args(), { GOOGLE_APPLICATION_CREDENTIALS: '/tmp/key.json' }),
    /Static credential-file authentication is blocked/
  );
});

test('production requires a second explicit acknowledgement', () => {
  assert.throws(
    () => assertRuntimeSafety(args({ environment: 'production' }), {}),
    /Production acknowledgement required/
  );
});

test('production forbids raw identifiers', () => {
  assert.throws(
    () => assertRuntimeSafety(args({
      environment: 'production',
      productionAck: PRODUCTION_ACK,
      includeIdentifiers: true
    }), {}),
    /Raw identifiers are prohibited/
  );
});

test('production permits hashed execution with short-lived ADC', () => {
  const result = assertRuntimeSafety(args({
    environment: 'production',
    productionAck: PRODUCTION_ACK
  }), {});
  assert.equal(result.environment, 'production');
  assert.equal(result.credentialMode, 'application_default_credentials_without_key_file');
});
