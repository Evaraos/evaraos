'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  planMessageRegistryMigration,
  safeSegment,
  validateRegistryShape
} = require('./messaging-registry-core');

function direct(groupId, overrides = {}) {
  return {
    kind: 'direct_meta',
    groupId,
    companyId: 'company-a',
    memberUids: ['manager-a', 'tech-a'],
    adminUids: ['manager-a'],
    createdBy: 'manager-a',
    ...overrides
  };
}

function role(groupId, overrides = {}) {
  return {
    kind: 'role_meta',
    groupId,
    companyId: 'company-a',
    allowedRoles: ['manager', 'technician'],
    memberUids: [],
    adminUids: [],
    createdBy: 'system',
    ...overrides
  };
}

test('safeSegment produces the canonical Firestore document ID', () => {
  assert.equal(safeSegment('company a / operations'), 'company_a_operations');
});

test('canonical registry documents require no migration', () => {
  const plan = planMessageRegistryMigration([
    { id: 'direct-a', data: direct('direct-a') },
    { id: 'company-a__operations', data: role('company-a__operations') }
  ]);

  assert.equal(plan.canonical, 2);
  assert.equal(plan.legacy, 0);
  assert.deepEqual(plan.operations, []);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.malformed, []);
});

test('legacy random IDs produce a deterministic canonicalization plan', () => {
  const records = [
    { id: 'random-b', data: direct('direct-a') },
    { id: 'random-a', data: role('company-a__operations') }
  ];
  const forward = planMessageRegistryMigration(records);
  const reverse = planMessageRegistryMigration([...records].reverse());

  assert.equal(forward.legacy, 2);
  assert.equal(forward.operations.length, 2);
  assert.equal(forward.planHash, reverse.planHash);
  assert.deepEqual(forward.operations.map((operation) => operation.targetId), [
    'company-a__operations',
    'direct-a'
  ]);
});

test('compatible canonical targets allow legacy cleanup without overwriting the target', () => {
  const plan = planMessageRegistryMigration([
    { id: 'direct-a', data: direct('direct-a') },
    { id: 'legacy-random', data: direct('direct-a') }
  ]);

  assert.equal(plan.operations.length, 1);
  assert.equal(plan.operations[0].targetExists, true);
  assert.deepEqual(plan.operations[0].sourceIds, ['legacy-random']);
  assert.deepEqual(plan.conflicts, []);
});

test('conflicting security metadata fails closed', () => {
  const plan = planMessageRegistryMigration([
    { id: 'legacy-a', data: direct('direct-a') },
    { id: 'legacy-b', data: direct('direct-a', { memberUids: ['manager-a', 'outsider'] }) }
  ]);

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].reason, 'security_metadata_mismatch');
});

test('different conversation IDs that normalize to one target fail closed', () => {
  const plan = planMessageRegistryMigration([
    { id: 'legacy-a', data: direct('direct/a') },
    { id: 'legacy-b', data: direct('direct a') }
  ]);

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].reason, 'canonical_id_collision');
});

test('malformed role channels cannot enter a migration plan', () => {
  const invalid = role('company-a__operations', { companyId: '' });
  const plan = planMessageRegistryMigration([{ id: 'legacy-role', data: invalid }]);

  assert.equal(validateRegistryShape(invalid), 'role_channel_missing_company');
  assert.equal(plan.operations.length, 0);
  assert.deepEqual(plan.malformed, [{ id: 'legacy-role', reason: 'role_channel_missing_company' }]);
});

test('unscoped direct and group conversations cannot enter a migration plan', () => {
  const invalid = direct('direct-a', { companyId: '' });
  const plan = planMessageRegistryMigration([{ id: 'legacy-direct', data: invalid }]);

  assert.equal(validateRegistryShape(invalid), 'conversation_missing_company');
  assert.equal(plan.operations.length, 0);
  assert.deepEqual(plan.malformed, [{ id: 'legacy-direct', reason: 'conversation_missing_company' }]);
});
