'use strict';

const crypto = require('node:crypto');

const REGISTRY_KINDS = new Set(['direct_meta', 'group_meta', 'role_meta']);

function clean(value = '', max = 320) {
  return String(value || '').trim().slice(0, max);
}

function safeSegment(value = '') {
  return clean(value, 160).replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function sortedStrings(values = [], { normalize = false } = {}) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => clean(value, 320))
    .filter(Boolean)
    .map((value) => normalize ? value.toLowerCase() : value))]
    .sort();
}

function validateRegistryShape(data = {}) {
  const kind = clean(data.kind, 40).toLowerCase();
  const groupId = clean(data.groupId, 160);
  if (!REGISTRY_KINDS.has(kind)) return 'unsupported_kind';
  if (!groupId || !safeSegment(groupId)) return 'missing_group_id';

  if (kind === 'role_meta') {
    if (!clean(data.companyId, 120)) return 'role_channel_missing_company';
    if (!Array.isArray(data.allowedRoles) || !sortedStrings(data.allowedRoles, { normalize: true }).length) {
      return 'role_channel_missing_roles';
    }
    return '';
  }

  if (!clean(data.companyId, 120)) return 'conversation_missing_company';
  if (!Array.isArray(data.memberUids) || !sortedStrings(data.memberUids).length) {
    return 'conversation_missing_members';
  }
  if (!Array.isArray(data.adminUids) || !sortedStrings(data.adminUids).length) {
    return 'conversation_missing_admins';
  }
  return '';
}

function securityShape(data = {}) {
  return {
    kind: clean(data.kind, 40).toLowerCase(),
    companyId: clean(data.companyId, 120),
    memberUids: sortedStrings(data.memberUids),
    adminUids: sortedStrings(data.adminUids),
    allowedRoles: sortedStrings(data.allowedRoles, { normalize: true }),
    createdBy: clean(data.createdBy, 160)
  };
}

function fingerprint(data = {}) {
  return crypto.createHash('sha256').update(JSON.stringify(securityShape(data))).digest('hex');
}

function planMessageRegistryMigration(records = []) {
  const normalized = [];
  const malformed = [];

  for (const record of records) {
    const id = clean(record?.id, 160);
    const data = record?.data && typeof record.data === 'object' ? record.data : {};
    const reason = !id ? 'missing_document_id' : validateRegistryShape(data);
    if (reason) {
      malformed.push({ id, reason });
      continue;
    }
    normalized.push({ id, data, targetId: safeSegment(data.groupId), fingerprint: fingerprint(data) });
  }

  const canonical = new Map(normalized
    .filter((record) => record.id === record.targetId)
    .map((record) => [record.id, record]));
  const legacyGroups = new Map();

  normalized
    .filter((record) => record.id !== record.targetId)
    .forEach((record) => {
      const group = legacyGroups.get(record.targetId) || [];
      group.push(record);
      legacyGroups.set(record.targetId, group);
    });

  const conflicts = [];
  const operations = [];

  [...legacyGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([targetId, sources]) => {
      const target = canonical.get(targetId) || null;
      const groupIds = new Set(sources.map((source) => clean(source.data.groupId, 160)));
      if (target) groupIds.add(clean(target.data.groupId, 160));
      if (groupIds.size !== 1) {
        conflicts.push({
          targetId,
          sourceIds: sources.map((source) => source.id).sort(),
          targetExists: Boolean(target),
          reason: 'canonical_id_collision'
        });
        return;
      }
      const fingerprints = new Set(sources.map((source) => source.fingerprint));
      if (target) fingerprints.add(target.fingerprint);
      if (fingerprints.size !== 1) {
        conflicts.push({
          targetId,
          sourceIds: sources.map((source) => source.id).sort(),
          targetExists: Boolean(target),
          reason: 'security_metadata_mismatch'
        });
        return;
      }

      const orderedSources = [...sources].sort((left, right) => left.id.localeCompare(right.id));
      operations.push({
        targetId,
        targetExists: Boolean(target),
        sourceIds: orderedSources.map((source) => source.id),
        sourceData: orderedSources[0].data,
        fingerprint: orderedSources[0].fingerprint
      });
    });

  const hashInput = operations.map((operation) => ({
    targetId: operation.targetId,
    targetExists: operation.targetExists,
    sourceIds: operation.sourceIds,
    fingerprint: operation.fingerprint
  }));
  const planHash = crypto.createHash('sha256').update(JSON.stringify(hashInput)).digest('hex');

  return {
    planHash,
    scanned: records.length,
    canonical: canonical.size,
    legacy: operations.reduce((total, operation) => total + operation.sourceIds.length, 0),
    malformed,
    conflicts,
    operations
  };
}

module.exports = {
  fingerprint,
  planMessageRegistryMigration,
  safeSegment,
  securityShape,
  validateRegistryShape
};
