const ASSIGNMENT_INDEX_COLLECTIONS = Object.freeze({
  leads: 'assignedLeads',
  jobs: 'assignedJobs'
});

const ASSIGNEE_FIELDS = Object.freeze([
  'assignedToUid',
  'assignedTo',
  'assignedTeamIds',
  'assignedRep',
  'staffClaimedBy'
]);

export function isAssignableUserToCompany(user = {}, companyId = '') {
  const targetCompanyId = String(companyId || '').trim();
  const userCompanyId = String(user?.companyId || '').trim();
  const status = String(user?.status || '').trim().toLowerCase();
  const approvalStatus = String(user?.approvalStatus || '').trim().toLowerCase();
  const role = String(user?.role || '').trim().toLowerCase();
  return Boolean(
    targetCompanyId
    && userCompanyId === targetCompanyId
    && ['active', 'approved'].includes(status)
    && approvalStatus === 'approved'
    && role
  );
}

function values(value) {
  return Array.isArray(value) ? value : [value];
}

export function assignmentIndexCollection(collectionName) {
  const indexCollection = ASSIGNMENT_INDEX_COLLECTIONS[collectionName];
  if (!indexCollection) throw new Error('Assignment references only support leads and jobs.');
  return indexCollection;
}

export function assignedUserIds(record = {}) {
  const userIds = new Set();
  for (const field of ASSIGNEE_FIELDS) {
    for (const value of values(record?.[field])) {
      if (typeof value !== 'string') continue;
      const userId = value.trim();
      if (userId) userIds.add(userId);
    }
  }
  return [...userIds].sort();
}

export function planAssignmentIndexWrites(collectionName, recordId, before = {}, after = {}, actor = {}) {
  const indexCollection = assignmentIndexCollection(collectionName);
  const cleanRecordId = String(recordId || '').trim();
  if (!cleanRecordId) throw new Error('A saved record ID is required to update assignment references.');
  const actorUid = typeof actor.uid === 'string' ? actor.uid.trim() : '';
  const canManageAssignments = actor.canManageAssignments === true;
  if (!actorUid) throw new Error('A verified signed-in user is required to update assignment references.');

  const previousIds = new Set(assignedUserIds(before));
  const nextIds = new Set(assignedUserIds(after));
  const writes = [];

  for (const userId of nextIds) {
    if (canManageAssignments || userId === actorUid) {
      writes.push({ operation: 'set', userId, indexCollection, recordId: cleanRecordId });
    }
  }
  for (const userId of previousIds) {
    if (!nextIds.has(userId) && (canManageAssignments || userId === actorUid)) {
      writes.push({ operation: 'delete', userId, indexCollection, recordId: cleanRecordId });
    }
  }

  return writes;
}

export function groupAssignmentIndexWrites(writes = []) {
  return [
    writes.filter((write) => write.operation === 'set'),
    writes.filter((write) => write.operation === 'delete')
  ].filter((group) => group.length > 0);
}
