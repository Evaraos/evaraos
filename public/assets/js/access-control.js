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
  if (['admin'].includes(value)) return 'admin';
  if (['manager', 'operations_manager', 'operations_coordinator'].includes(value)) return 'admin';
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

export function isStaff(role = '') {
  return ['staff', 'sales', 'technician', 'cleaner'].includes(normalizeAccessRole(role));
}

export const PAGE_ACCESS = Object.freeze({
  executive: [
    'dashboard.html', 'website-builder.html', 'evara-studio.html', 'companies.html', 'users.html', 'org.html', 'applications.html', 'qa.html',
    'enterprise-finance-dashboard.html', 'marketplace-payouts.html', 'governance-dashboard.html', 'governance-analytics.html', 'anomaly-dashboard.html', 'audit-dashboard.html', 'replay-dashboard.html',
    'live-operations-command.html', 'operations-visibility.html', 'notifications.html', 'executive-queue.html', 'workflow-monitor-dashboard.html', 'alerts-dashboard.html', 'analytics-dashboard.html', 'territories.html'
  ],
  operations: ['jobs.html', 'leads.html', 'dispatch.html', 'field.html', 'schedule.html', 'operations_map.html', 'territory-map.html', 'presence.html'],
  finance: ['revenue.html', 'payroll.html', 'ledger.html', 'payment_ops.html'],
  customer: ['customer_dashboard.html', 'customer-commerce.html', 'customer-messaging.html', 'customer-service-history.html', 'messages.html'],
  system: ['settings.html', 'settings-v2.html']
});

export function canAccessPageName(pageName = '', role = 'customer') {
  const page = String(pageName || '').split('?')[0].split('#')[0].split('/').pop() || 'index.html';
  const normalized = normalizeAccessRole(role);
  if (page === 'index.html' || page === '') return true;
  if (PAGE_ACCESS.system.includes(page)) return true;
  if (PAGE_ACCESS.executive.includes(page)) return isExecutive(normalized);
  if (PAGE_ACCESS.finance.includes(page)) return isExecutive(normalized) || ['organization', 'vendor', 'hr'].includes(normalized);
  if (PAGE_ACCESS.operations.includes(page)) return isExecutive(normalized) || ['organization', 'vendor', 'staff', 'sales', 'technician', 'cleaner'].includes(normalized);
  if (PAGE_ACCESS.customer.includes(page)) return isExecutive(normalized) || ['organization', 'vendor', 'staff', 'sales', 'technician', 'cleaner', 'customer'].includes(normalized);
  if (normalized === 'customer') return false;
  if (['staff', 'sales', 'technician', 'cleaner'].includes(normalized)) return false;
  return true;
}

export function defaultRouteForRole(role = 'customer') {
  const normalized = normalizeAccessRole(role);
  if (normalized === 'customer') return '/customer_dashboard.html';
  if (['staff', 'sales', 'technician', 'cleaner'].includes(normalized)) return '/dashboard.html';
  return '/dashboard.html';
}
