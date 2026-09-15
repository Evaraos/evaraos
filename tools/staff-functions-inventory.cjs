'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Firebase functions:list --json returns normalized backend endpoints in result.
// Do not accept substring matches, a different project, or a partial inventory.
function verifyStaffInventory(inventory) {
  assert.equal(inventory.status, 'success', 'Functions inventory request failed');
  assert.ok(Array.isArray(inventory.result), 'Missing Functions inventory result');
  for (const id of ['reviewStaffApplication', 'updateStaffOnboardingTask']) {
    const matches = inventory.result.filter(endpoint => endpoint.id === id && endpoint.region === 'us-central1');
    assert.equal(matches.length, 1, `Expected exactly one us-central1 endpoint for ${id}`);
    const endpoint = matches[0];
    assert.equal(endpoint.project, 'evaraos-web', `${id}: wrong project`);
    assert.equal(endpoint.runtime, 'nodejs22', `${id}: wrong runtime`);
    // Some CLI/API versions omit state; when supplied it must be ACTIVE.
    if (endpoint.state !== undefined) assert.equal(endpoint.state, 'ACTIVE', `${id}: not active`);
  }
}
module.exports = {verifyStaffInventory};
if (require.main === module) {
  verifyStaffInventory(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  console.log('Both staff Functions verified in evaraos-web/us-central1 on nodejs22; ACTIVE when state is exposed.');
}
