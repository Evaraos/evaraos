'use strict';

const CANONICAL_ROLES = Object.freeze([
  'platform_admin',
  'owner',
  'admin',
  'manager',
  'sales',
  'technician',
  'cleaner',
  'customer',
  'vendor'
]);

const ROLE_ALIASES = Object.freeze({
  platform_admin: 'platform_admin',
  super_admin: 'platform_admin',
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  operations_manager: 'manager',
  operations_coordinator: 'manager',
  field_manager: 'manager',
  sales_manager: 'manager',
  dispatcher: 'manager',
  hr: 'manager',
  hr_manager: 'manager',
  customer_support_manager: 'manager',
  customer_support: 'manager',
  sales: 'sales',
  sales_rep: 'sales',
  technician: 'technician',
  tech: 'technician',
  lead_technician: 'technician',
  cleaner: 'cleaner',
  lead_cleaner: 'cleaner',
  staff: 'technician',
  field_staff: 'technician',
  crew_lead: 'technician',
  quality_control: 'technician',
  customer: 'customer',
  vendor: 'vendor',
  lead_vendor: 'vendor',
  service_vendor: 'vendor',
  management_program: 'vendor',
  organization: 'vendor',
  organization_owner: 'vendor',
  office_owner: 'vendor',
  branch_owner: 'vendor'
});

const TENANT_ROLES = new Set([
  'admin',
  'manager',
  'sales',
  'technician',
  'cleaner',
  'customer',
  'vendor'
]);

const STAFF_DETAIL_ROLES = new Set([
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'sales_manager',
  'dispatcher',
  'hr',
  'hr_manager',
  'customer_support_manager',
  'customer_support',
  'sales',
  'sales_rep',
  'technician',
  'tech',
  'lead_technician',
  'cleaner',
  'lead_cleaner',
  'staff',
  'field_staff',
  'crew_lead',
  'quality_control'
]);

const BLOCKED_STATUSES = new Set([
  'inactive',
  'suspended',
  'disabled',
  'rejected',
  'deleted',
  'archived'
]);
const STRICT_ACTIVE_STATUSES = new Set(['active', 'approved']);

function normalizeValue(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeRole(role = '') {
  const detailedRole = normalizeValue(role);
  return {
    detailedRole,
    canonicalRole: ROLE_ALIASES[detailedRole] || '',
    known: Boolean(ROLE_ALIASES[detailedRole]),
    isAlias: Boolean(
      detailedRole
      && ROLE_ALIASES[detailedRole]
      && detailedRole !== ROLE_ALIASES[detailedRole]
    )
  };
}

function browserWouldTreatAsActive(profile = {}) {
  const status = normalizeValue(profile.status || 'active');
  const approval = normalizeValue(profile.approvalStatus || '');
  return !BLOCKED_STATUSES.has(status) && approval !== 'rejected';
}

function backendWouldTreatAsActive(profile = {}) {
  const status = normalizeValue(profile.status);
  const approval = normalizeValue(profile.approvalStatus);
  return STRICT_ACTIVE_STATUSES.has(status) && approval === 'approved';
}

module.exports = {
  BLOCKED_STATUSES,
  CANONICAL_ROLES,
  ROLE_ALIASES,
  STAFF_DETAIL_ROLES,
  STRICT_ACTIVE_STATUSES,
  TENANT_ROLES,
  backendWouldTreatAsActive,
  browserWouldTreatAsActive,
  normalizeRole,
  normalizeValue
};
