export const ROLE_GROUPS = Object.freeze({
  executive: ['owner', 'super_admin', 'admin'],
  operations: ['manager', 'operations_manager', 'operations_coordinator', 'dispatcher', 'field_manager', 'sales_manager', 'hr', 'hr_manager'],
  staff: ['staff', 'sales', 'sales_rep', 'technician', 'cleaner', 'field_staff', 'crew_lead', 'customer_support', 'quality_control'],
  customer: ['customer']
});

export const PAGE_ACCESS = Object.freeze({
  executive: [
    'website-builder.html', 'evara-studio.html', 'companies.html', 'users.html', 'org.html', 'applications.html',
    'enterprise-finance-dashboard.html', 'marketplace-payouts.html', 'governance-dashboard.html', 'governance-analytics.html',
    'anomaly-dashboard.html', 'audit-dashboard.html', 'replay-dashboard.html', 'live-operations-command.html',
    'operations-visibility.html', 'notifications.html', 'executive-queue.html', 'workflow-monitor-dashboard.html',
    'alerts-dashboard.html', 'analytics-dashboard.html', 'territories.html', 'qa.html'
  ],
  staff: [
    'dashboard.html', 'leads.html', 'jobs.html', 'presence.html', 'territory-map.html', 'customer-messaging.html',
    'messages.html', 'settings.html', 'settings-v2.html', 'settings/account.html', 'settings/workspace.html'
  ],
  customer: [
    'customer_dashboard.html', 'customer-commerce.html', 'customer-messaging.html', 'messages.html',
    'customer-service-history.html', 'customer_portal.html', 'customer_bills.html', 'settings.html', 'settings-v2.html',
    'settings/account.html', 'settings/workspace.html'
  ],
  public: ['index.html', 'login.html', 'signup.html', 'reset.html', 'staff_application.html']
});

export function normalizeAccessRole(role = '') {
  const value = String(role || '').trim().toLowerCase();
  if (ROLE_GROUPS.executive.includes(value)) return value === 'super_admin' ? 'owner' : value;
  if (ROLE_GROUPS.operations.includes(value)) return 'operations';
  if (ROLE_GROUPS.staff.includes(value)) return 'staff';
  if (ROLE_GROUPS.customer.includes(value)) return 'customer';
  return 'guest';
}

export function normalizeAccessPage(path = '') {
  const clean = String(path || '').split('?')[0].split('#')[0].replace(/^\//, '');
  return clean || 'index.html';
}

export function canAccessPage(path = '', role = 'guest') {
  const page = normalizeAccessPage(path);
  const normalized = normalizeAccessRole(role);
  if (PAGE_ACCESS.public.includes(page)) return true;
  if (normalized === 'owner' || normalized === 'admin') return true;
  if (normalized === 'operations') return !PAGE_ACCESS.executive.includes(page);
  if (normalized === 'staff') return PAGE_ACCESS.staff.includes(page);
  if (normalized === 'customer') return PAGE_ACCESS.customer.includes(page);
  return false;
}

export function defaultRouteForRole(role = 'guest') {
  const normalized = normalizeAccessRole(role);
  if (normalized === 'customer') return '/customer_dashboard.html';
  if (normalized === 'guest') return '/login.html';
  return '/dashboard.html';
}
