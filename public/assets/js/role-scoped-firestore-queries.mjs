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
  ['assignedTo', 'array-contains'],
  ['assignedTeamIds', 'array-contains'],
  ['assignedRep', '=='],
  ['assignedRep', 'array-contains'],
  ['staffClaimedBy', '==']
];

function clean(value) {
  return String(value || '').trim();
}

export function buildRoleScopedFilterSpecs(profile = {}, userId = '') {
  const uid = clean(userId);
  const role = clean(profile.role).toLowerCase();
  const profileUid = clean(profile.uid || profile.id);

  if (!uid || !role) throw new Error('A signed-in user and verified profile are required for this query.');
  if (profileUid && profileUid !== uid) throw new Error('The profile does not match the signed-in user.');

  if (PLATFORM_ROLES.has(role)) return [null];

  if (COMPANY_MANAGER_ROLES.has(role)) {
    const companyId = clean(profile.companyId);
    if (!companyId) throw new Error('A company assignment is required for this query.');
    return [['companyId', '==', companyId]];
  }

  if (role === 'customer') {
    return [
      ['customerUid', '==', uid],
      ['customerId', '==', uid],
      ['userId', '==', uid]
    ];
  }

  return ASSIGNED_RECORD_FILTERS.map(([field, operator]) => [field, operator, uid]);
}

export function buildRoleScopedQueryRefs(source, profile, userId, firestore = {}) {
  const { query, where } = firestore;
  if (typeof query !== 'function' || typeof where !== 'function') {
    throw new Error('Firestore query helpers are required.');
  }

  return buildRoleScopedFilterSpecs(profile, userId).map((spec) => {
    if (spec === null) return source;
    return query(source, where(...spec));
  });
}
