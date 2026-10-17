const PLATFORM_ROLES = new Set(['owner', 'super_admin', 'platform_admin']);
const COMPANY_MANAGER_ROLES = new Set([
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'sales_manager',
  'dispatcher',
  'hr',
  'hr_manager'
]);

const ASSIGNED_RECORD_FILTERS = [
  ['assignedToUid', '=='],
  ['assignedRep', '=='],
  ['staffClaimedBy', '=='],
  // Keep rule-proven legacy list queries while per-user index records are
  // populated for existing assignments. Each query constrains the exact
  // field checked by assignedToUser() in Firestore rules.
  ['assignedTo', 'array-contains'],
  ['assignedTeamIds', 'array-contains'],
  ['assignedRep', 'array-contains']
];

function clean(value) {
  return String(value || '').trim();
}

function verifiedIdentity(profile = {}, userId = '') {
  const uid = clean(userId);
  const role = clean(profile.role).toLowerCase();
  const profileUid = clean(profile.uid || profile.id);

  if (!uid || !role) throw new Error('A signed-in user and verified profile are required for this query.');
  if (profileUid && profileUid !== uid) throw new Error('The profile does not match the signed-in user.');
  return { uid, role, profile };
}

export function buildRoleScopedReadPlan(collectionName, profile = {}, userId = '') {
  if (!['jobs', 'leads'].includes(collectionName)) {
    throw new Error('This role-scoped reader only supports jobs and leads.');
  }

  const { uid, role } = verifiedIdentity(profile, userId);
  if (PLATFORM_ROLES.has(role)) return { kind: 'query', filters: [null] };

  if (COMPANY_MANAGER_ROLES.has(role)) {
    const companyId = clean(profile.companyId);
    if (!companyId) throw new Error('A company assignment is required for this query.');
    return { kind: 'query', filters: [['companyId', '==', companyId]] };
  }

  if (role === 'customer') {
    return {
      kind: 'query',
      filters: [
        ['customerUid', '==', uid],
        ['customerId', '==', uid],
        ['userId', '==', uid]
      ]
    };
  }

  const companyId = clean(profile.companyId);
  if (!companyId) throw new Error('A company assignment is required for this query.');
  return {
    kind: 'assigned-index',
    filters: ASSIGNED_RECORD_FILTERS.map(([field, operator]) => [
      ['companyId', '==', companyId],
      [field, operator, uid]
    ]),
    indexCollection: collectionName === 'leads' ? 'assignedLeads' : 'assignedJobs'
  };
}

export function buildRoleScopedFilterSpecs(profile = {}, userId = '') {
  const { role } = verifiedIdentity(profile, userId);
  if (PLATFORM_ROLES.has(role)) return [null];
  if (COMPANY_MANAGER_ROLES.has(role)) {
    const companyId = clean(profile.companyId);
    if (!companyId) throw new Error('A company assignment is required for this query.');
    return [['companyId', '==', companyId]];
  }
  if (role === 'customer') {
    const uid = clean(userId);
    return [
      ['customerUid', '==', uid],
      ['customerId', '==', uid],
      ['userId', '==', uid]
    ];
  }
  const uid = clean(userId);
  const companyId = clean(profile.companyId);
  if (!companyId) throw new Error('A company assignment is required for this query.');
  return ASSIGNED_RECORD_FILTERS.map(([field, operator]) => [
    ['companyId', '==', companyId],
    [field, operator, uid]
  ]);
}

export function buildRoleScopedQueryRefs(source, profile, userId, firestore = {}) {
  const { query, where } = firestore;
  if (typeof query !== 'function' || typeof where !== 'function') {
    throw new Error('Firestore query helpers are required.');
  }

  return buildRoleScopedFilterSpecs(profile, userId).map((spec) => {
    if (spec === null) return source;
    const filters = Array.isArray(spec[0]) ? spec : [spec];
    return query(source, ...filters.map((filter) => where(...filter)));
  });
}

