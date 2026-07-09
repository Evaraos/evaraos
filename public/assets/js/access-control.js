export const CANONICAL_ROLES = Object.freeze([
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
  customer_support: 'manager',
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

const ALL_AUTHENTICATED = Object.freeze([...CANONICAL_ROLES]);
const TENANT_LEADERSHIP = Object.freeze(['owner', 'admin', 'manager']);
const TENANT_EXECUTIVES = Object.freeze(['owner', 'admin']);
const FIELD_ROLES = Object.freeze(['sales', 'technician', 'cleaner']);
const OPERATIONS_ROLES = Object.freeze(['owner', 'admin', 'manager', 'vendor', ...FIELD_ROLES]);

export const PUBLIC_PAGES = Object.freeze(new Set([
  '',
  'index.html',
  'login.html',
  'signup.html',
  'reset.html',
  'staff_application.html'
]));

export const PAGE_POLICY = Object.freeze({
  'dashboard.html': ALL_AUTHENTICATED.filter((role) => role !== 'customer'),
  'customer_dashboard.html': ['customer'],
  'settings.html': ALL_AUTHENTICATED,
  'settings-v2.html': ALL_AUTHENTICATED,
  'messages.html': ALL_AUTHENTICATED,
  'customer-messaging.html': ALL_AUTHENTICATED,

  'website-builder.html': ['platform_admin', 'owner', 'admin'],
  'evara-studio.html': ['platform_admin', 'owner', 'admin'],
  'companies.html': ['platform_admin', 'owner', 'admin'],
  'users.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'org.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'applications.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'qa.html': ['platform_admin', 'owner', 'admin'],
  'qa-v2.html': ['platform_admin', 'owner', 'admin'],

  'jobs.html': OPERATIONS_ROLES,
  'leads.html': ['platform_admin', 'owner', 'admin', 'manager', 'vendor', 'sales'],
  'dispatch.html': ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  'dispatch_map.html': ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  'dispatch_intelligence.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'proximity_dispatch.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'field.html': OPERATIONS_ROLES,
  'schedule.html': OPERATIONS_ROLES,
  'operations_map.html': OPERATIONS_ROLES,
  'territory-map.html': OPERATIONS_ROLES,
  'territories.html': ['platform_admin', 'owner', 'admin', 'manager', 'sales'],
  'territory_intelligence.html': ['platform_admin', 'owner', 'admin', 'manager', 'sales'],
  'presence.html': OPERATIONS_ROLES,

  'revenue.html': ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  'payroll.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'ledger.html': ['platform_admin', 'owner', 'admin'],
  'payment_ops.html': ['platform_admin', 'owner', 'admin'],
  'job_billing.html': ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  'enterprise-finance-dashboard.html': ['platform_admin', 'owner', 'admin'],
  'marketplace-payouts.html': ['platform_admin', 'owner', 'admin', 'vendor'],

  'governance-dashboard.html': ['platform_admin', 'owner', 'admin'],
  'governance-analytics.html': ['platform_admin', 'owner', 'admin'],
  'anomaly-dashboard.html': ['platform_admin', 'owner', 'admin'],
  'audit-dashboard.html': ['platform_admin', 'owner', 'admin'],
  'replay-dashboard.html': ['platform_admin', 'owner', 'admin'],
  'live-operations-command.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'operations-visibility.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'notifications.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'notifications_center.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'executive-queue.html': ['platform_admin', 'owner', 'admin'],
  'workflow-monitor-dashboard.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'alerts-dashboard.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'analytics-dashboard.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'analytics.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'predictive_ops.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'company_intelligence.html': ['platform_admin', 'owner', 'admin', 'manager'],

  'ai.html': ['platform_admin', 'owner', 'admin', 'manager'],
  'ai_command.html': ['platform_admin', 'owner', 'admin', 'manager'],

  'customer-commerce.html': ['customer'],
  'customer-service-history.html': ['customer', ...TENANT_LEADERSHIP],
  'customer_portal.html': ['customer'],
  'customer_bills.html': ['customer', ...TENANT_LEADERSHIP],
  'onboarding.html': ALL_AUTHENTICATED
});

export const FEATURE_POLICY = Object.freeze({
  studioView: ['platform_admin', 'owner', 'admin'],
  studioEdit: ['platform_admin', 'owner', 'admin'],
  blueprintPreview: ['platform_admin', 'owner', 'admin'],
  blueprintPublish: ['platform_admin', 'owner'],
  blueprintRollback: ['platform_admin', 'owner'],

  manageUsers: ['platform_admin', 'owner', 'admin', 'manager'],
  assignOwner: ['platform_admin'],
  assignAdmin: ['platform_admin', 'owner'],
  assignManager: ['platform_admin', 'owner', 'admin'],
  assignStaff: ['platform_admin', 'owner', 'admin', 'manager'],
  manageApplications: ['platform_admin', 'owner', 'admin', 'manager'],

  viewFinance: ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  manageFinance: ['platform_admin', 'owner', 'admin'],
  managePayroll: ['platform_admin', 'owner', 'admin', 'manager'],

  manageJobs: ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  completeAssignedJobs: ['technician', 'cleaner'],
  manageLeads: ['platform_admin', 'owner', 'admin', 'manager', 'vendor', 'sales'],
  createLeads: ['platform_admin', 'owner', 'admin', 'manager', 'vendor', 'sales', 'customer'],
  dispatchWork: ['platform_admin', 'owner', 'admin', 'manager', 'vendor'],
  uploadJobProof: ['platform_admin', 'owner', 'admin', 'manager', 'technician', 'cleaner'],

  orderServices: ['customer'],
  payInvoices: ['customer'],
  viewOwnAccount: ALL_AUTHENTICATED,
  viewOwnMessages: ALL_AUTHENTICATED,
  manageVendorTeam: ['platform_admin', 'owner', 'admin', 'vendor'],

  aiCommand: ['platform_admin', 'owner', 'admin', 'manager'],
  brandManager: ['platform_admin', 'owner', 'admin'],
  viewAudit: ['platform_admin', 'owner', 'admin'],
  platformAdministration: ['platform_admin']
});

export function normalizeAccessRole(role = '') {
  const value = String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[value] || 'customer';
}

export function isPlatformAdmin(role = '') {
  return normalizeAccessRole(role) === 'platform_admin';
}

export function isTenantExecutive(role = '') {
  return TENANT_EXECUTIVES.includes(normalizeAccessRole(role));
}

export function isTenantLeadership(role = '') {
  return TENANT_LEADERSHIP.includes(normalizeAccessRole(role));
}

export function isFieldRole(role = '') {
  return FIELD_ROLES.includes(normalizeAccessRole(role));
}

export function canUseFeature(feature = '', role = 'customer') {
  const allowed = FEATURE_POLICY[feature];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(normalizeAccessRole(role));
}

export function canAccessPageName(pageName = '', role = 'customer') {
  const page = String(pageName || '').split('?')[0].split('#')[0].split('/').pop() || 'index.html';
  if (PUBLIC_PAGES.has(page)) return true;
  const allowed = PAGE_POLICY[page];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(normalizeAccessRole(role));
}

export function defaultRouteForRole(role = 'customer') {
  return normalizeAccessRole(role) === 'customer'
    ? '/customer_dashboard.html'
    : '/dashboard.html';
}

export function permissionsForRole(role = 'customer') {
  const normalized = normalizeAccessRole(role);
  return Object.keys(FEATURE_POLICY).filter((feature) => FEATURE_POLICY[feature].includes(normalized));
}

export function pagesForRole(role = 'customer') {
  const normalized = normalizeAccessRole(role);
  return Object.entries(PAGE_POLICY)
    .filter(([, allowed]) => allowed.includes(normalized))
    .map(([page]) => page);
}

export function accessDecision({ page = '', feature = '', role = 'customer' } = {}) {
  const normalizedRole = normalizeAccessRole(role);
  if (feature) {
    return Object.freeze({
      allowed: canUseFeature(feature, normalizedRole),
      role: normalizedRole,
      resource: feature,
      type: 'feature'
    });
  }
  return Object.freeze({
    allowed: canAccessPageName(page, normalizedRole),
    role: normalizedRole,
    resource: page,
    type: 'page'
  });
}
