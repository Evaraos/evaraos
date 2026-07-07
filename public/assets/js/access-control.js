export const ROLE_GROUPS = Object.freeze({
  executive: ['owner', 'super_admin', 'admin'],
  organization: ['organization', 'organization_owner', 'office_owner', 'branch_owner'],
  vendor: ['vendor', 'lead_vendor', 'service_vendor', 'management_program'],
  hr: ['hr', 'hr_manager'],
  staff: ['staff', 'sales', 'sales_rep', 'technician', 'tech', 'cleaner', 'field_staff', 'crew_lead', 'customer_support', 'quality_control'],
  customer: ['customer']
});

export function normalizeAccessRole(role = '') {
  const value = String(role || '').trim().toLowerCase();
  if (['owner', 'super_admin'].includes(value)) return 'owner';
  if (['admin', 'manager', 'operations_manager', 'operations_coordinator', 'dispatcher', 'field_manager', 'sales_manager'].includes(value)) return 'admin';
  if (['organization', 'organization_owner', 'office_owner', 'branch_owner'].includes(value)) return 'organization';
  if (['vendor', 'lead_vendor', 'service_vendor', 'management_program'].includes(value)) return 'vendor';
  if (['hr', 'hr_manager'].includes(value)) return 'hr';
  if (['sales', 'sales_rep'].includes(value)) return 'sales';
  if (['technician', 'tech'].includes(value)) return 'technician';
  if (value === 'cleaner') return 'cleaner';
  if (ROLE_GROUPS.staff.includes(value)) return 'staff';
  return 'customer';
}

export function isExecutive(role = '') {
  return ['owner', 'admin'].includes(normalizeAccessRole(role));
}

export function isFieldRole(role = '') {
  return ['staff', 'sales', 'technician', 'cleaner'].includes(normalizeAccessRole(role));
}

export const PAGE_ACCESS = Object.freeze({
  public: ['index.html', 'login.html', 'signup.html', 'reset.html', 'staff_application.html'],
  system: ['settings.html', 'settings-v2.html'],
  executive: ['dashboard.html', 'website-builder.html', 'evara-studio.html', 'companies.html', 'users.html', 'org.html', 'applications.html', 'qa.html', 'enterprise-finance-dashboard.html', 'marketplace-payouts.html', 'governance-dashboard.html', 'governance-analytics.html', 'anomaly-dashboard.html', 'audit-dashboard.html', 'replay-dashboard.html', 'live-operations-command.html', 'operations-visibility.html', 'notifications.html', 'executive-queue.html', 'workflow-monitor-dashboard.html', 'alerts-dashboard.html', 'analytics-dashboard.html', 'territories.html'],
  operations: ['jobs.html', 'leads.html', 'dispatch.html', 'field.html', 'schedule.html', 'operations_map.html', 'territory-map.html', 'presence.html'],
  finance: ['revenue.html', 'payroll.html', 'ledger.html', 'payment_ops.html'],
  customer: ['customer_dashboard.html', 'customer-commerce.html', 'customer-messaging.html', 'customer-service-history.html', 'messages.html', 'customer_portal.html', 'customer_bills.html']
});

export const FEATURE_ACCESS = Object.freeze({
  studio: ['owner', 'admin'],
  publish: ['owner', 'admin'],
  manageUsers: ['owner', 'admin', 'hr'],
  manageApplications: ['owner', 'admin', 'hr'],
  viewFinance: ['owner', 'admin', 'organization', 'vendor', 'hr'],
  manageFinance: ['owner', 'admin'],
  managePayroll: ['owner', 'admin', 'hr'],
  manageJobs: ['owner', 'admin', 'organization', 'vendor'],
  completeJobs: ['owner', 'admin', 'staff', 'sales', 'technician', 'cleaner'],
  manageLeads: ['owner', 'admin', 'organization', 'vendor', 'sales'],
  customerSupport: ['owner', 'admin', 'organization', 'vendor', 'staff', 'sales', 'technician', 'cleaner'],
  orderServices: ['customer', 'owner', 'admin'],
  uploadProof: ['technician', 'cleaner', 'staff', 'owner', 'admin'],
  aiCommand: ['owner', 'admin', 'organization'],
  brandManager: ['owner', 'admin']
});

export function canUseFeature(feature = '', role = 'customer') {
  const normalized = normalizeAccessRole(role);
  const allowed = FEATURE_ACCESS[feature] || [];
  return allowed.includes(normalized);
}

export function canAccessPageName(pageName = '', role = 'customer') {
  const page = String(pageName || '').split('?')[0].split('#')[0].split('/').pop() || 'index.html';
  const normalized = normalizeAccessRole(role);
  if (PAGE_ACCESS.public.includes(page) || page === '') return true;
  if (PAGE_ACCESS.system.includes(page)) return true;
  if (PAGE_ACCESS.executive.includes(page)) return isExecutive(normalized);
  if (PAGE_ACCESS.finance.includes(page)) return isExecutive(normalized) || ['organization', 'vendor', 'hr'].includes(normalized);
  if (PAGE_ACCESS.operations.includes(page)) return isExecutive(normalized) || ['organization', 'vendor', 'sales', 'staff', 'technician', 'cleaner'].includes(normalized);
  if (PAGE_ACCESS.customer.includes(page)) return isExecutive(normalized) || ['organization', 'vendor', 'sales', 'staff', 'technician', 'cleaner', 'customer'].includes(normalized);
  if (normalized === 'customer') return false;
  if (isFieldRole(normalized)) return false;
  return true;
}

export function defaultRouteForRole(role = 'customer') {
  const normalized = normalizeAccessRole(role);
  if (normalized === 'customer') return '/customer_dashboard.html';
  return '/dashboard.html';
}

export function permissionsForRole(role = 'customer') {
  const normalized = normalizeAccessRole(role);
  return Object.keys(FEATURE_ACCESS).reduce((list, feature) => {
    if (canUseFeature(feature, normalized)) list.push(feature);
    return list;
  }, []);
}