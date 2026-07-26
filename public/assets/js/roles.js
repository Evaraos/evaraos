import {
  CANONICAL_ROLES,
  canAccessPageName,
  canUseFeature,
  defaultRouteForRole,
  normalizeAccessRole,
  pagesForRole,
  permissionsForRole
} from './access-control.js';

const SECTION_PAGE_MAP = Object.freeze({
  dashboard: 'dashboard.html',
  customer_dashboard: 'customer_dashboard.html',
  companies: 'companies.html',
  users: 'users.html',
  applications: 'applications.html',
  sales_reps: 'sales_reps.html',
  leads: 'leads.html',
  jobs: 'jobs.html',
  audit: 'audit-dashboard.html',
  org: 'org.html',
  performance: 'performance.html',
  settings: 'settings-v2.html',
  profile: 'settings/account.html',
  security: 'governance-dashboard.html',
  qa: 'qa.html',
  messages: 'messages.html'
});

const SECTION_FEATURE_MAP = Object.freeze({
  self: 'viewOwnAccount',
  order_services: 'orderServices',
  pay_invoices: 'payInvoices',
  manage_jobs: 'manageJobs',
  manage_users: 'manageUsers',
  manage_applications: 'manageApplications',
  manage_finance: 'manageFinance',
  studio: 'studioView'
});

function compatibilityPermissions(role) {
  const pages = pagesForRole(role).map((page) => page.replace(/\.html$/i, ''));
  const features = permissionsForRole(role);
  return Object.freeze([...new Set([...pages, ...features])]);
}

export const ROLE_PERMISSIONS = Object.freeze({
  ...Object.fromEntries(CANONICAL_ROLES.map((role) => [role, compatibilityPermissions(role)])),
  guest: Object.freeze([])
});

export function normalizeRole(role = '') {
  return normalizeAccessRole(role) || 'guest';
}

export function getSavedRole() {
  try {
    return (
      localStorage.getItem('evaraos-role') ||
      sessionStorage.getItem('evaraos-role') ||
      localStorage.getItem('evaraos_role') ||
      sessionStorage.getItem('evaraos_role') ||
      'guest'
    );
  } catch {
    return 'guest';
  }
}

export function canAccess(role = 'guest', section = '') {
  const normalizedRole = normalizeAccessRole(role);
  if (!normalizedRole) return false;

  const normalizedSection = String(section || '').trim();
  if (!normalizedSection) return false;

  const feature = SECTION_FEATURE_MAP[normalizedSection];
  if (feature) return canUseFeature(feature, normalizedRole);

  const mappedPage = SECTION_PAGE_MAP[normalizedSection];
  if (mappedPage) return canAccessPageName(mappedPage, normalizedRole);

  if (/\.html(?:[?#].*)?$/i.test(normalizedSection) || normalizedSection.includes('/')) {
    return canAccessPageName(normalizedSection, normalizedRole);
  }

  return false;
}

export function hasPermission(section = '', role = getSavedRole()) {
  return canAccess(role, section);
}

export function protectPage(section = '', options = {}) {
  if (hasPermission(section)) return true;

  const role = normalizeRole(getSavedRole());
  if (options.silent !== true) alert('You do not have access to this page.');

  window.location.href = role === 'guest'
    ? '/login.html'
    : defaultRouteForRole(role);
  return false;
}

try {
  window.EvaraRoles = {
    ROLE_PERMISSIONS,
    normalizeRole,
    getSavedRole,
    canAccess,
    hasPermission,
    protectPage
  };
} catch {}
